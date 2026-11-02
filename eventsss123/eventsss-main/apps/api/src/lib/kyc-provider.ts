import { HttpError } from "./errors";

type ProviderSessionResponse = {
  status?: string;
  verification?: { id?: string; url?: string };
};

/** Starts an identity session in Veriff's hosted applicant flow. */
export async function startIdentitySession(input: {
  requestId: string;
  userId: string;
  country: string;
}): Promise<{ provider: "VERIFF"; sessionId: string; redirectUrl: string }> {
  const apiKey = process.env.VERIFF_API_KEY?.trim();
  const baseUrl = process.env.VERIFF_API_URL?.trim();
  if (!apiKey || !baseUrl) {
    throw new HttpError(503, "KYC_PROVIDER_NOT_CONFIGURED", "Secure identity verification is not available yet. Please try again later.");
  }

  let endpoint: URL;
  try { endpoint = new URL(baseUrl); } catch {
    throw new HttpError(503, "KYC_PROVIDER_MISCONFIGURED", "Identity verification is temporarily unavailable.");
  }
  if (endpoint.protocol !== "https:" && endpoint.hostname !== "localhost") {
    throw new HttpError(503, "KYC_PROVIDER_MISCONFIGURED", "Identity verification is temporarily unavailable.");
  }
  endpoint.pathname = endpoint.pathname.replace(/\/+$/, "") + "/v1/sessions";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-AUTH-CLIENT": apiKey },
    body: JSON.stringify({
      verification: {
        vendorData: input.requestId,
        endUserId: input.userId,
        document: { country: input.country },
      },
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new HttpError(502, "KYC_PROVIDER_UNAVAILABLE", "We could not start identity verification. Please try again.");
  }

  const data = await response.json() as ProviderSessionResponse;
  const sessionId = data.verification?.id;
  const redirectUrl = data.verification?.url;
  if (data.status !== "success" || !sessionId || !redirectUrl) {
    throw new HttpError(502, "KYC_PROVIDER_INVALID_RESPONSE", "The identity provider returned an incomplete session.");
  }
  let redirect: URL;
  try { redirect = new URL(redirectUrl); } catch {
    throw new HttpError(502, "KYC_PROVIDER_INVALID_URL", "The identity provider returned an invalid verification link.");
  }
  if (redirect.protocol !== "https:") {
    throw new HttpError(502, "KYC_PROVIDER_INVALID_URL", "The identity provider returned an insecure verification link.");
  }
  return { provider: "VERIFF", sessionId, redirectUrl: redirect.toString() };
}
