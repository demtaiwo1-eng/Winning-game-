const functionPath = "/functions/v1/ess-api-proxy";
const allowedMethods = "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS";
const allowedRequestHeaders = "authorization, content-type, idempotency-key, x-requested-with";
const maxRequestBodyBytes = 1_048_576;
const hopByHopHeaders = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function allowedOrigins() {
  return new Set([
    "capacitor://localhost",
    "https://localhost",
    "http://localhost",
    ...(Deno.env.get("ALLOWED_ORIGINS") ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ]);
}

function corsHeaders(origin: string | null) {
  const headers = new Headers({
    "Access-Control-Allow-Methods": allowedMethods,
    "Access-Control-Allow-Headers": allowedRequestHeaders,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    Vary: "Origin",
  });
  if (origin && allowedOrigins().has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
}

function apiPath(requestUrl: URL) {
  const functionIndex = requestUrl.pathname.indexOf(functionPath);
  const requestPath = functionIndex >= 0
    ? requestUrl.pathname.slice(functionIndex + functionPath.length) || "/"
    : requestUrl.pathname;

  if (requestPath === "/health" || requestPath === "/ready" || requestPath === "/api/v1" ||
      requestPath.startsWith("/api/v1/")) {
    return requestPath;
  }
  return null;
}

function responseWithCors(response: Response, cors: Headers) {
  const headers = new Headers(cors);
  response.headers.forEach((value, key) => {
    if (!hopByHopHeaders.has(key.toLowerCase()) && !key.toLowerCase().startsWith("access-control-")) {
      headers.set(key, value);
    }
  });
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function handleRequest(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  const cors = corsHeaders(origin);

  if (origin && !allowedOrigins().has(origin)) {
    return new Response("Origin is not allowed.", { status: 403, headers: cors });
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (!allowedMethods.split(", ").includes(request.method)) {
    return new Response("Method not allowed.", { status: 405, headers: cors });
  }

  const requestUrl = new URL(request.url);
  const path = apiPath(requestUrl);
  if (!path) {
    return new Response("Route not found.", { status: 404, headers: cors });
  }

  const configuredApiUrl = Deno.env.get("ESS_API_BASE_URL");
  if (!configuredApiUrl) {
    console.error("ESS_API_BASE_URL is not configured for the Supabase API proxy.");
    return new Response("The upstream API is not configured.", { status: 503, headers: cors });
  }

  let upstreamBase: URL;
  try {
    upstreamBase = new URL(configuredApiUrl);
    if (upstreamBase.protocol !== "https:" || upstreamBase.username || upstreamBase.password ||
        upstreamBase.pathname !== "/" || upstreamBase.search || upstreamBase.hash) {
      throw new Error("ESS_API_BASE_URL must be an HTTPS origin without credentials or a path.");
    }
  } catch (error) {
    console.error("ESS_API_BASE_URL must be configured as a valid HTTPS origin.", error);
    return new Response("The upstream API configuration is invalid.", { status: 503, headers: cors });
  }

  let body: ArrayBuffer | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > maxRequestBodyBytes) {
      return new Response("Request body is too large.", { status: 413, headers: cors });
    }
    body = await request.arrayBuffer();
    if (body.byteLength > maxRequestBodyBytes) {
      return new Response("Request body is too large.", { status: 413, headers: cors });
    }
  }

  const target = new URL(path + requestUrl.search, upstreamBase);
  const upstreamHeaders = new Headers(request.headers);
  for (const header of hopByHopHeaders) upstreamHeaders.delete(header);
  upstreamHeaders.delete("origin");
  upstreamHeaders.delete("access-control-request-headers");
  upstreamHeaders.delete("access-control-request-method");

  try {
    const upstreamResponse = await fetch(target, {
      method: request.method,
      headers: upstreamHeaders,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(25_000),
    });
    return responseWithCors(upstreamResponse, cors);
  } catch (error) {
    console.error("Unable to reach the configured upstream API.", error);
    return new Response("The upstream API is temporarily unavailable.", { status: 502, headers: cors });
  }
}
