# EPHINTA source-similarity and plagiarism investigation

**Audit date:** 2026-11-14  
**Repository:** `demtaiwo1-eng/Winning-game-`  
**Reviewed release candidate:** `integration/ephinta-release-candidate-final-20261114` at `a306266289458905d9e905738e1846f23db17e82`  
**Status:** Technical investigation in progress — **not a plagiarism-free certification**

## 1. Executive summary

This investigation reviewed the repository's existing third-party audit, asset register, contributor register, dependency licence inventory, source/asset CI gate, selected application source and targeted public GitHub code-search results.

No exact public-repository match was found for the targeted EPHINTA-specific identifiers `safeLicensedAudioUrl` or `ephinta-config` / `LICENSED_AUDIO_URL`. The identifier `promotionPaymentsEnabled` was found only in this EPHINTA repository in the search performed. Generic authentication helper wording and names such as `friendlyAuthError` occur in unrelated repositories; those results are not evidence of copying because common helper names and ordinary error messages are not distinctive source expression.

**No specific copied EPHINTA application source file has been proven by the evidence collected. Equally, no exhaustive comparison against all public Git repositories, commercial code databases, private repositories, training data, or offline source collections has been completed.** GitHub search is indexed, partial, and does not establish provenance or legal ownership.

## 2. Investigation scope and method

| Area | Work performed | Finding / limitation |
|---|---|---|
| Existing provenance documentation | Read `docs/THIRD_PARTY_AUDIT.md`, `docs/ASSET_RIGHTS_REGISTER.md`, and `docs/CONTRIBUTOR_IP_REGISTER.md` | These identify known third-party content, missing ownership evidence and remediation already applied |
| Targeted public code search | Searched exact EPHINTA-specific identifiers and selected auth/billing identifiers across public GitHub code search | No exact matches for two EPHINTA-specific identifiers; one billing identifier was only found in this repository; generic auth helper matches exist elsewhere |
| Dependency licences | Reviewed CI output for the lockfile inventory | 750 third-party package entries, 12 licence expressions, 0 unknown/unlicensed metadata, 0 missing licence texts in that run; 107 entries used official SPDX text fallback |
| Asset provenance | Reviewed the rights register and machine-readable manifest | Audio manifest is empty; unverified audio recordings were removed; logo/avatar origin still needs owner evidence |
| Source/asset CI gate | Read the completed workflow log | 8 checks passed, including no tracked `node_modules`, no retired Remotion skill bundle, no unregistered bundled audio and no hard-coded default music track |
| Contributor chain of title | Reviewed Git contributor register | Git history identifies `demtaiwo1-eng` and `deytaiwo2`; repository records do not prove a signed IP assignment |
| Application source | Inspected representative app/API files including billing routes, auth middleware, app router and public landing page | Selected code was inspected; this is not a complete line-by-line manual review of every source file |

## 3. Targeted public search observations

The following searches were made against GitHub's indexed public code:

- Exact `safeLicensedAudioUrl`: no result returned.
- Exact `ephinta-config` with `LICENSED_AUDIO_URL`: no result returned.
- Exact `promotionPaymentsEnabled`: result was the EPHINTA billing route in this repository.
- `friendlyAuthError` with a generic sign-in error phrase: results appeared in several unrelated repositories. The helper name and user-facing error wording are common patterns and do not by themselves demonstrate copied code.
- `PAID_SUBSCRIPTIONS_UNAVAILABLE`: the exact string also appeared in one unrelated repository result, but the returned excerpt was a constant/message and not enough to establish a copied implementation. It requires manual contextual comparison if this identifier is considered proprietary.

These observations are search leads only. Search index omissions, private repositories and non-indexed sources are outside this method. Exact string matching can miss rewritten or structurally similar code, while common identifiers can produce false positives.

## 4. Known third-party material and remediation

The current third-party audit records the following changes in the release candidate:

1. Removed 284 unused Remotion agent-skill/documentation/example files from the product tree.
2. Removed 2,431 tracked files from a stale parent-level `node_modules` tree and removed the obsolete parent package manifest/lockfile.
3. Removed 12 tracked copies of six Wale Waves-labelled audio recordings because no commercial distribution evidence was found in the repository. This is a precaution, not a finding of theft or lack of ownership.
4. Removed unused YouTube OAuth and playlist-sync automation that was not used by the product player.
5. Removed an unused Solidity escrow prototype that carried an MIT SPDX identifier and was not imported or deployed by the inspected app. Earlier public MIT-labelled revisions remain part of Git history; removing the file does not revoke permissions previously granted.
6. Added CI checks for bundled audio rights records, dependency-tree hygiene and the absence of the removed bundle.

The full technical detail and third-party integration obligations are in `docs/THIRD_PARTY_AUDIT.md`.

## 5. Licence inventory evidence

The completed CI inventory reported:

| Measure | Result |
|---|---:|
| Third-party package entries | 750 |
| Declared licence expressions | 12 |
| Unknown/unlicensed metadata entries | 0 |
| Packages missing usable licence text | 0 |
| Packages using official SPDX text fallback | 107 |

A successful inventory is not a legal approval. SPDX fallback provides a standard licence text, not necessarily the package-specific copyright holder, exceptions, dual-licence choice or NOTICE statements. Preserve upstream notices and review obligations for Apache-2.0, MPL-2.0, CC-BY and other licences.

## 6. Ownership and provenance blockers

The following matters remain unresolved and block an exclusive proprietary ownership claim:

- **Legal rights holder:** no confirmed legal individual/company name is recorded for EPHINTA.
- **Collaborator contribution:** obtain a signed assignment or a perpetual, worldwide, transferable and sublicensable commercial licence from `deytaiwo2` covering the actual contributed work, plus any employer/client restrictions.
- **Brand and illustrations:** obtain creation records, commissioned-work agreements or commercial licence evidence for logos, launcher/splash assets and avatar illustrations.
- **Project licence:** do not add a proprietary root licence with an assumed owner name. The owner-approval document remains pending.
- **Public repository:** public visibility means source confidentiality cannot be promised. A proprietary licence notice does not itself make a public repository private.

Keep private contracts and identity documents outside the public repository.

## 7. What would be required for a stronger external plagiarism review

A higher-confidence review should include:

1. A complete clean checkout of the exact release commit and a source-only file inventory (excluding generated output, lockfiles, vendored packages and build artifacts).
2. A structural clone/similarity scan over first-party source files, with thresholds and false-positive review.
3. Public code search for distinctive high-similarity fragments from any flagged file, not only identifiers.
4. Review of Git history and imported code origins, including commit attribution and any upstream notices.
5. Manual review of every material match against the source project's licence and the exact copied expression.
6. Where commercially material, a licensed commercial code-similarity service or qualified IP counsel review. No such proprietary database was accessed in this investigation.

## 8. Release disposition

**Do not state that EPHINTA is “plagiarism-free”, “100% original”, or exclusively owned based only on this report.** The defensible current statement is:

> The release candidate passed its automated asset-rights and dependency-licence gates. A targeted public GitHub search found no exact match for the selected EPHINTA-specific identifiers, and the repository's known unverified audio and unused third-party bundle were removed. A complete external code-similarity review and contributor/asset chain-of-title confirmation remain outstanding.

This document is a technical audit record, not legal advice or a legal opinion.
