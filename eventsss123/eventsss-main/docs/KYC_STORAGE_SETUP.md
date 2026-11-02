# Private KYC document storage

EPHINTA's KYC upload path uses the private S3-compatible bucket provisioned on the Neon staging project's `main` branch.

- Project: `blue-waterfall-17555581` (`ephinta-opay-staging`)
- Branch: `br-shiny-forest-b560t8r4` (`main`)
- Bucket: `ephinta-kyc-private`
- Access: `private`
- Region: `us-east-2`

## API environment

Configure these variables on the API hosting service. Obtain the S3 credentials from the Neon branch's storage environment; do not commit them or expose them to the browser.

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_ENDPOINT_URL_S3`
- `AWS_REGION` (expected: `us-east-2`)
- `KYC_STORAGE_BUCKET` (expected: `ephinta-kyc-private`)

The endpoint must be the branch-specific HTTPS S3 endpoint supplied by Neon. Use the branch-scoped credentials for this same branch. Do not use a public bucket or credentials from a different branch.

## Data handling

- Uploads are limited to 650 KB and accepted as PDF, JPG, JPEG, PNG, or WEBP.
- Objects use random keys under `documents/`; original filenames and user IDs are not included in object keys.
- Database rows store only a `neon-kyc://` object reference, never document bytes or a public URL.
- Reviewer downloads are authenticated and limited to ADMIN and CONSULTANT roles.
- Downloads use private, no-store cache headers and `X-Content-Type-Options: nosniff`.
- If storage is not configured or unavailable, the API fails closed and does not create a pending verification request.

## Rollout checks still required

1. Add the five environment variables to the API runtime without printing secret values.
2. Verify the API runtime uses the same Neon branch as the bucket.
3. Submit a test identity document in a non-production test account.
4. Confirm the object is present in the private bucket and the reviewer-only download works.
5. Verify unauthorized users cannot download the document.
6. Confirm retention, deletion, and provider-webhook handling before production KYC launch.
