import { handleRequest } from "./handler.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("proxies API paths, query strings, and authorization to the configured HTTPS host", async () => {
  Deno.env.set("ESS_API_BASE_URL", "https://api.example.com");
  Deno.env.set("ALLOWED_ORIGINS", "https://app.example.com");
  const originalFetch = globalThis.fetch;
  let capturedUrl: URL | undefined;
  let capturedHeaders: Headers | undefined;
  globalThis.fetch = async (input, init) => {
    capturedUrl = new URL(String(input));
    capturedHeaders = new Headers(init?.headers);
    return Response.json({ status: "ready" });
  };

  try {
    const response = await handleRequest(new Request(
      "https://project.supabase.co/functions/v1/ess-api-proxy/api/v1/events?cursor=abc",
      {
        headers: {
          Authorization: "Bearer app-session",
          Origin: "https://app.example.com",
        },
      },
    ));

    assert(response.status === 200, "expected upstream success status");
    assert(capturedUrl?.href === "https://api.example.com/api/v1/events?cursor=abc", "expected exact upstream URL");
    assert(capturedHeaders?.get("authorization") === "Bearer app-session", "expected app authorization to be forwarded");
    assert(capturedHeaders?.has("origin") === false, "browser origin should be handled by the gateway");
    assert(response.headers.get("access-control-allow-origin") === "https://app.example.com", "expected configured CORS origin");
    assert(response.headers.get("cache-control") === "no-store", "proxied API responses must not be cached");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("exposes health and readiness endpoints for deployment checks", async () => {
  Deno.env.set("ESS_API_BASE_URL", "https://api.example.com");
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  globalThis.fetch = async (input) => {
    capturedUrl = String(input);
    return Response.json({ status: "ok" });
  };

  try {
    for (const path of ["/health", "/ready"]) {
      const response = await handleRequest(new Request(
        `https://project.supabase.co/functions/v1/ess-api-proxy${path}`,
      ));
      assert(response.status === 200, `expected ${path} to succeed`);
      assert(capturedUrl === `https://api.example.com${path}`, `expected ${path} to reach upstream`);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("rejects origins not explicitly allowed", async () => {
  Deno.env.set("ALLOWED_ORIGINS", "https://app.example.com");
  const response = await handleRequest(new Request(
    "https://project.supabase.co/functions/v1/ess-api-proxy/health",
    { headers: { Origin: "https://untrusted.example" } },
  ));
  assert(response.status === 403, "expected unlisted origin to be rejected");
});

Deno.test("handles browser preflight requests without forwarding them", async () => {
  Deno.env.set("ALLOWED_ORIGINS", "https://app.example.com");
  const response = await handleRequest(new Request(
    "https://project.supabase.co/functions/v1/ess-api-proxy/api/v1/events",
    {
      method: "OPTIONS",
      headers: {
        Origin: "https://app.example.com",
        "Access-Control-Request-Method": "POST",
      },
    },
  ));
  assert(response.status === 204, "expected successful preflight response");
  assert(response.headers.get("access-control-allow-methods")?.includes("POST"), "expected POST to be allowed");
});

Deno.test("refuses a non-HTTPS or path-bearing upstream configuration", async () => {
  for (const baseUrl of ["http://api.example.com", "https://api.example.com/api/v1"]) {
    Deno.env.set("ESS_API_BASE_URL", baseUrl);
    const response = await handleRequest(new Request(
      "https://project.supabase.co/functions/v1/ess-api-proxy/health",
    ));
    assert(response.status === 503, `expected unsafe upstream URL to be rejected: ${baseUrl}`);
  }
});

Deno.test("rejects request bodies larger than the upstream API limit", async () => {
  Deno.env.set("ESS_API_BASE_URL", "https://api.example.com");
  const body = "x".repeat(1_048_577);
  const response = await handleRequest(new Request(
    "https://project.supabase.co/functions/v1/ess-api-proxy/api/v1/events",
    { method: "POST", body },
  ));
  assert(response.status === 413, "expected oversized request body to be rejected");
});
