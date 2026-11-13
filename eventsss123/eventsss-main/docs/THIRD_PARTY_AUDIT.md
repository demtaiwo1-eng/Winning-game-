# EPHINTA third-party, source-ownership, and licence audit

**Updated:** 2026-11-13  
**Scope:** Git tree, source references, package-lock metadata, media paths, commit history, and build/runtime references in `eventsss123/eventsss-main`. This is a technical due-diligence audit, not a legal opinion or a complete public/proprietary code-similarity scan.

## Executive result

| Area | Finding | Current action |
|---|---|---|
| Project-level licence | No root or application-level `LICENSE` was present. The legal copyright holder has not been confirmed. | Do not invent a copyright owner or publish a misleading licence. Owner confirmation and legal review are still required. |
| Third-party Remotion content | The product repository contained a large Remotion agent-skill/documentation bundle, with example code and sample assets. It is unrelated to EPHINTA's runtime/build. | Removed from this release branch: 284 skill/document/example files. |
| Audio recordings | Six Wale Waves-labelled recordings existed twice (repository root and web public assets). No commercial distribution grant or master/composition rights record was found. | Removed all 12 tracked copies from this release branch. Audio playback now stays disabled unless an owner-configured, rights-cleared HTTPS source is supplied. |
| YouTube playlist automation | OAuth scripts and a scheduled playlist-sync workflow existed, but the player did not use the generated catalogue. | Removed the unused Google OAuth/YouTube playlist automation, documentation, and workflow. |
| Solidity escrow prototype | `contracts/EventEscrowVault.sol` carried an explicit `SPDX-License-Identifier: MIT` and was not imported or deployed by the application. | Removed the unused contract from the current application tree. This does not revoke permissions granted by earlier public MIT-labelled revisions. |
| npm dependencies | The lockfile snapshot contains 750 third-party package entries across 12 declared licence expressions; no third-party package had unknown/unlicensed metadata in the recorded inventory. | Keep package licences and notices separate from EPHINTA's own commercial terms; regenerate for each release. |
| Other integrations | OPay, Bytid KYC, Capacitor/Capgo updater, SMTP/Nodemailer, and S3-compatible storage are service/provider integrations. | Keep only under valid provider terms, keys, consent, privacy disclosures, and operational controls. These integrations are not evidence of copied source code. |
| Contributor ownership | Git history includes contributions by `demtaiwo1-eng` and `deytaiwo2`. The repository owner previously identified `deytaiwo2` as a collaborator. | Obtain written IP assignment or a commercial licence covering collaborator contributions before claiming exclusive ownership of all code. |
| Plagiarism certification | No specific copied EPHINTA application source file has been proven by this audit. | A complete similarity scan against public and proprietary code databases and manual review of flagged matches remain outstanding. |

## Remediation already applied in this branch

1. Removed the unused Remotion agent-skill bundle. It contained video, mapping, multimedia, and SaaS examples that were not imported by the EPHINTA app.
2. Removed the six Wale Waves recordings from both the repository root and web public folder (12 tracked files total). Their ownership/licensing was not evidenced in the repository.
3. Removed the unused Wale Waves YouTube OAuth bootstrap, playlist-sync script, workflow, and setup guide. This removes an unnecessary Google account/token/quota surface from the current product.
4. Reworked the audio player so it makes no audio request, displays no consent prompt, and makes no claim of original music when no approved source is configured. A future source must be explicitly supplied via `VITE_EPHINTA_LICENSED_AUDIO_URL` or the component prop and must have a corresponding rights record.
5. Removed the unused Solidity escrow prototype, which was separately labelled MIT. The production application continues to use its existing server-side wallet/ledger/escrow workflow; no deployed chain contract was found in the inspected app tree.
6. Added automated checks to prevent unregistered bundled audio and the removed Remotion bundle from returning.

## Dependency licence inventory

The current lockfile inventory recorded:

- 750 third-party package entries.
- 12 declared licence types/expressions.
- Zero third-party package entries with unknown or unlicensed metadata in that snapshot.
- Licence families include MIT, ISC, Apache-2.0, BSD-2-Clause, BSD-3-Clause, MPL-2.0, BlueOak-1.0.0, Unlicense, CC-BY-4.0, MIT-0, 0BSD, and a dual MIT OR CC0-1.0 expression.

Important:
- Package metadata is not a substitute for reading the actual licence and notice files.
- CC-BY-4.0 has attribution requirements; MPL-2.0 has source/notice obligations for covered files; Apache-2.0 requires preserving notices and applicable patent/trademark terms.
- Do not apply EPHINTA's proprietary terms to third-party packages.
- Generate the release notice bundle from the exact installed dependency tree and retain each package's actual licence and NOTICE files.
- Gradle wrapper scripts include their upstream Apache-2.0 notice in their headers; keep those headers intact.

Run:

```bash
npm ci
node scripts/qa/ephinta-license-inventory.mjs
```

The script and CI workflow produce the package inventory and third-party notice report. Review any package with missing text or unusual licence expressions before distributing a release.

## Provider and service integrations

These are external services, not code that EPHINTA owns. Use the official documented APIs and do not copy provider SDK code or branding outside the permitted integration:

| Integration | Purpose | Required controls |
|---|---|---|
| OPay | NGN wallet deposits and supported payout workflows | Merchant approval, sandbox/live separation, webhook signature checks, idempotency, payout permission, reconciliation, fee disclosure |
| Bytid | Hosted identity/KYC verification | Provider contract, privacy/DPA review, explicit user consent, data minimisation, retention controls, verified webhook |
| Capacitor / Android / iOS | Native application shell | Preserve upstream licence notices and comply with platform terms |
| Capgo updater | Optional mobile update delivery | Service terms, privacy/security review, signed release policy, rollback controls |
| SMTP / Nodemailer | Email delivery | SMTP provider terms, anti-abuse controls, transactional email policy |
| S3-compatible storage | KYC/document/object storage | Provider terms, encryption, access control, retention/deletion and regional data-transfer review |

Legacy Paystack/Flutterwave/Stripe adapters and webhook compatibility code remain in the source tree for historical/other-market records. The inspected provider selector routes NGN through OPay; do not configure or use other processors for new NGN traffic. Before removing legacy webhook compatibility, reconcile all outstanding intents and confirm no historical transaction still depends on it. If EPHINTA is to be OPay-only in every country/currency, that is a separate product/payment policy change and must be applied consistently to UI, API, reporting, and data migrations.

## KYC country/document matrix risk

The original country matrix described itself as “FATF-aligned” and exposed fixed jurisdiction document lists. That wording could be mistaken for a legal/compliance determination. It has been rewritten as an EPHINTA-maintained UX suggestion catalogue, and the API now accepts platform-supported document categories without rejecting a document solely because a country hint omits it. This is not a substitute for provider capability checks or local legal review. See `docs/KYC_COUNTRY_DATA_PROVENANCE.md`.

## Source and asset provenance still requiring owner evidence

- EPHINTA logos, launcher icons, splash images, and three people/avatar SVGs appear to be product branding/illustration assets, but the Git tree alone does not prove who created them or which licences apply.
- The collaborator's contributions need a signed assignment or a sufficiently broad commercial licence if the platform owner intends to own and commercially sublicense the complete application.
- Confirm the legal person or company that owns EPHINTA and use that exact name in the proprietary licence and copyright notices.
- If the repository remains public, GitHub's terms allow viewing and forking; a proprietary commercial licence does not make a public repository private. Move the source to a private repository before relying on source confidentiality.

## What this audit does not prove

- It is not a legal opinion and does not certify regulatory compliance.
- It does not compare every source file with every public repository or proprietary code database.
- It does not prove the owner of any logo, image, font, recording, or contributor-authored code.
- Removing files from the current branch does not erase prior public Git history, forks, caches, or copies already obtained.
- Passing the dependency inventory does not automatically satisfy every notice, attribution, source-disclosure, patent, trademark, or redistribution obligation.

## Release checklist

- [x] Remove unused third-party Remotion agent content from the product branch.
- [x] Remove audio recordings without a documented commercial distribution grant from the current release tree.
- [x] Disable default audio playback until a rights-cleared source is explicitly configured.
- [x] Remove unused YouTube playlist OAuth automation.
- [x] Remove the unused MIT-labelled Solidity prototype from the current app tree.
- [x] Add automated audio/third-party-content release checks.
- [x] Inventory declared npm dependency licences from the lockfile.
- [ ] Generate and retain the complete per-package licence/NOTICE bundle for every release.
- [ ] Confirm rights for EPHINTA brand logos and remaining SVG illustrations.
- [ ] Obtain signed IP assignment/commercial licence covering collaborator contributions.
- [ ] Confirm the legal copyright holder and approve a proprietary EPHINTA licence.
- [ ] Move the source repository to private before treating the code as confidential.
- [ ] Complete an independent code-similarity review and legal review before commercial distribution.
