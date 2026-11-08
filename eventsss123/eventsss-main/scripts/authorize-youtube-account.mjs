#!/usr/bin/env node
/**
 * One-time OAuth bootstrap for the EPHINTA-owned YouTube account.
 *
 * Configure a Google OAuth "Web application" client with the exact
 * YOUTUBE_OAUTH_REDIRECT_URI in its authorised redirect URIs.
 * Run this in Codespaces with that forwarded port made public.
 * The script never asks for or stores a Google password.
 */
import { createServer } from "node:http";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile, chmod } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const clientId = process.env.YOUTUBE_CLIENT_ID?.trim();
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET?.trim();
const redirectUri = process.env.YOUTUBE_OAUTH_REDIRECT_URI?.trim();
const output = resolve(process.env.YOUTUBE_TOKEN_OUTPUT || ".secrets/youtube-oauth.json");
const scopes = ["https://www.googleapis.com/auth/youtube.readonly"];
const port = Number(new URL(redirectUri || "http://127.0.0.1:53682/callback").port || 53682);
const state = randomBytes(32).toString("hex");
const codeVerifier = randomBytes(48).toString("base64url");
const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

if (!clientId || !clientSecret || !redirectUri) {
  console.error("Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET and YOUTUBE_OAUTH_REDIRECT_URI.");
  process.exit(1);
}
const redirect = new URL(redirectUri);
if (!["http:", "https:"].includes(redirect.protocol) || !redirect.pathname) {
  throw new Error("YOUTUBE_OAUTH_REDIRECT_URI must be an exact HTTP(S) callback URL.");
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.search = new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: "code",
  scope: scopes.join(" "),
  access_type: "offline",
  prompt: "consent",
  include_granted_scopes: "true",
  state,
  code_challenge: codeChallenge,
  code_challenge_method: "S256",
}).toString();

console.log("\nOpen this URL and choose the YouTube account that owns your EPHINTA playlists:\n");
console.log(authUrl.toString());
console.log("\nWaiting for Google's OAuth callback on the configured redirect URI…\n");

const server = createServer(async (req, res) => {
  const callback = new URL(req.url || "/", redirect.origin);
  if (callback.pathname !== redirect.pathname) {
    res.writeHead(404).end("Not found");
    return;
  }
  const returnedState = callback.searchParams.get("state") || "";
  const a = Buffer.from(returnedState);
  const b = Buffer.from(state);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.writeHead(400).end("OAuth state check failed. Close this page and retry.");
    server.close();
    process.exitCode = 1;
    return;
  }
  const error = callback.searchParams.get("error");
  const code = callback.searchParams.get("code");
  if (error || !code) {
    res.writeHead(400).end("Google authorisation was not completed. You may close this page.");
    console.error("Google OAuth was not completed:", error || "missing authorization code");
    server.close();
    process.exitCode = 1;
    return;
  }
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(tokens.error_description || tokens.error || "Token exchange failed");
    if (!tokens.refresh_token) {
      throw new Error("Google did not return a refresh token. Revoke the app's prior access and rerun with prompt=consent.");
    }
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify({
      token_type: tokens.token_type,
      scope: tokens.scope,
      refresh_token: tokens.refresh_token,
      created_at: new Date().toISOString(),
    }, null, 2) + "\n", { mode: 0o600 });
    await chmod(output, 0o600).catch(() => {});
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(
      "<!doctype html><title>EPHINTA YouTube connected</title><h1>YouTube account authorised</h1><p>You can close this tab and return to your terminal.</p>",
    );
    console.log("Authorisation succeeded. Refresh token saved locally to:", output);
    console.log("Do not commit this file. Add its refresh_token value to GitHub Actions secret YOUTUBE_REFRESH_TOKEN.");
  } catch (err) {
    res.writeHead(500).end("EPHINTA could not finish authorisation. Return to the terminal for details.");
    console.error("OAuth token exchange failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
const listenHost = redirect.hostname === "127.0.0.1" || redirect.hostname === "localhost" ? "127.0.0.1" : "0.0.0.0";
server.listen(port, listenHost);
