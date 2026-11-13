# EPHINTA KYC country catalogue — provenance and safe-use policy

## What this catalogue is

`apps/api/src/lib/kyc-countries.ts` contains an EPHINTA-maintained set of country/region/currency defaults and suggested identity/business document categories. It is a product UX aid, not a government register, legal opinion, FATF certification, AML policy, or official provider support matrix.

## What it is not

- It is not an authoritative statement of every document accepted by a government, bank, payment provider, or identity-verification vendor.
- It does not establish that EPHINTA may collect or process a particular national identifier.
- It does not certify KYC, KYB, AML, sanctions, privacy, or data-residency compliance in any country.
- It is not a complete ISO 3166 or ISO 4217 dataset. Country/currency values and jurisdiction notes must be independently checked before market activation.

## Code-level safety change

The API now treats country profile document lists as recommendations. It no longer rejects a platform-supported identity document solely because a hard-coded country profile omits it. The platform still validates the document category, stores a pending request, and requires an authorised reviewer or a contracted provider decision to determine whether the document is acceptable.

## Required controls before enabling a market

1. Confirm the provider's current country and document coverage in its official contract/API documentation.
2. Have qualified local counsel/compliance staff verify applicable identity, KYB, AML, sanctions, privacy, and retention requirements.
3. Confirm the lawful basis, user consent wording, data minimisation, retention/deletion, data residency, and cross-border transfer controls.
4. Use provider-hosted capture where available; avoid receiving raw BVN/NIN/biometric values unless the approved workflow requires them.
5. Test the complete provider decision webhook, signature verification, replay protection, error handling, manual review, and deletion workflow in sandbox.
6. Record the provider, effective date, official source, owner approval, and legal reviewer in the private market-approval register.

No market should be marked production-ready based solely on the EPHINTA country catalogue or its research script.
