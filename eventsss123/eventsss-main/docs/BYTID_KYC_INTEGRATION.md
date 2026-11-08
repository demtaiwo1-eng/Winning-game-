# Bytid identity verification integration

EPHINTA uses Bytid's hosted verification link for Nigerian identity checks. The hosted journey supports `bvn`, `nin`, `drivers_license`, `voters_card`, and `bvn_igree` (customer-consented BVN iGree), performs provider liveness and face matching, and returns a provider outcome. EPHINTA does not receive or persist raw BVN/NIN values, selfie images, or biometric templates.

## API flow

- An authenticated user calls `POST /api/v1/kyc/bytid/requests`.
- EPHINTA creates a pending `VerificationRequest`, starts a Bytid hosted KYC request, and returns its HTTPS verification URL.
- The user completes the hosted BVN/NIN/licence/voter-card journey and liveness check.
- The client can refresh with `GET /api/v1/kyc/bytid/requests/:id`.
- Bytid posts signed `kyc.completed` events to `POST /api/v1/kyc/bytid/webhook`.
- EPHINTA only marks the identity request VERIFIED when the provider reports a completed, verified ID, matched face, and passed liveness. When document verification is required, the document must also be verified. Other definitive outcomes are rejected; provider errors remain pending for review.

The webhook uses the raw request body, HMAC-SHA256 signature, a five-minute timestamp tolerance, and event-ID deduplication. Provider API keys and webhook secrets are never returned to clients or written to application logs.

## Render environment

Set these on the **API service** in Render (not the static web site):

| Variable | Value |
| --- | --- |
| `BYTID_API_KEY` | Free sandbox key from the Bytid dashboard; starts with `uvk_test_` |
| `BYTID_API_URL` | `https://api.bytid.com/v1` |
| `BYTID_WEBHOOK_SECRET` | Signing secret from the Bytid sandbox webhook configuration |
| `BYTID_ALLOW_LIVE` | `false` until the owner explicitly approves paid live checks |
| `BYTID_REQUIRE_DOCUMENT` | `false` by default; set `true` only when the extra document check is wanted |

Do not put these values in Vite variables, GitHub source, APK assets, or chat messages. The sandbox key does not call live registries and sandbox liveness simulation is free. A live key is blocked unless `BYTID_ALLOW_LIVE=true`; live verification is pay-as-you-go and requires a funded provider wallet.

## Bytid dashboard setup

1. Create an account and generate a **sandbox** API key.
2. Create a sandbox webhook pointing to `https://YOUR-API-HOST/api/v1/kyc/bytid/webhook`.
3. Subscribe to `kyc.completed` events and copy the webhook signing secret into Render's `BYTID_WEBHOOK_SECRET`.
4. Add the sandbox API key to Render's API service as `BYTID_API_KEY`.
5. Deploy the API service and verify that the authenticated endpoint creates a hosted verification URL.
6. Complete a sandbox flow and confirm the webhook or status-refresh path updates the EPHINTA verification request.

Do not use real customer identity data for sandbox testing. Use the provider's published deterministic sandbox cases.

## Safety and release limitations

- A sandbox API key is required before the live provider call can be exercised end-to-end; this repository change cannot create a key or register a webhook in the owner's Bytid account.
- The default live gate is off. Do not enable it until the owner has reviewed provider pricing, consent wording, privacy notice, retention and applicable Nigerian data-protection requirements.
- Bytid's published liveness documentation states that it is not ISO/IEC 30107-3 certified and browser checks cannot fully rule out injected virtual-camera video. Use manual review and additional risk controls for high-risk account or payment actions.
- The local app PIN/biometric lock remains a separate device privacy control; it is not a substitute for account authentication or KYC.
- Existing NFC/Bluetooth features remain event guest check-in mechanisms, not identity verification.
