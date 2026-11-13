# EPHINTA third-party, source-ownership, and licence audit

**Audit date:** 2026-11-13  
**Scope:** Repository metadata and tracked application paths in `eventsss123/eventsss-main`. This is a first-pass repository audit, not a legal opinion or a full source-code similarity scan.

## Executive result

| Area | Finding | Status |
|---|---|---|
| Root project licence | No `LICENSE`, `COPYING`, or `NOTICE` file was present at the repository root or application root in the inspected tree | Action required |
| Third-party notices | No project-level `THIRD_PARTY_NOTICES` or acknowledgements file was present at the application root | Action required |
| Dependency licensing | The project uses npm workspaces and many third-party packages. Their individual package licences must be inventoried from the lockfile/package metadata and retained with distributed builds | Action required |
| Media rights | Six MP3 files at the application root include the name “Wale Waves” in their filenames. The repository listing does not establish the recording/composition owner, licence, or distribution permission | Rights evidence required |
| Code plagiarism | No finding of plagiarism can be made from filenames or repository metadata. A full public-code similarity scan and human review of flagged matches have not yet been performed | Not assessed |
| Attribution | No central project-level acknowledgements/third-party notices file was found in the inspected root | Action required |

## Evidence and observations

### 1. Missing project-level licence and notices

The inspected repository/application root contains package manifests, documentation, source folders, and media assets, but no project-level `LICENSE`, `COPYING`, `NOTICE`, or `THIRD_PARTY_NOTICES.md` file was found in the tree queried for this audit.

**Impact:** absence of a licence does not make third-party dependencies unlicensed, and it does not automatically grant permission to copy or redistribute the application. It also means users should not infer an open-source licence from the repository being visible on GitHub.

**Recommended action:** have the actual rights holder approve a proprietary commercial licence for EPHINTA, and maintain a separate third-party notices inventory. Do not replace dependency licences with the EPHINTA commercial terms.

### 2. Bundled audio assets

The application root contains six files named:

- `Here we are-1 -Wale Waves_ESS_Wedding.mp3`
- `Here we are-2 -Wale Waves_ESS_Wedding.mp3`
- `Welcome, Little One-1-Wale Waves_ESS_Naming.mp3`
- `Welcome, Little One-2-Wale Waves_ESS_Naming.mp3`
- `You Will Live in Our Hearts-1-Wale Waves_ESS_Burials.mp3`
- `You Will Live in Our Hearts-2-Wale Waves_ESS_Burials.mp3`

The names suggest a credited artist/creator, but names alone do not prove ownership or permission. Confirm the master recording and composition rights, territory, term, commercial use, in-app streaming/download rights, and any attribution wording. Keep written licences or releases in a private legal-records location; do not commit contracts or personal information to the public repository.

### 3. Dependency licensing

The application uses npm workspaces and dependencies including React, Express, Prisma, Capacitor, and related packages. A production distribution must preserve applicable licence texts and notices for direct and transitive dependencies.

**Lockfile snapshot (2026-11-13):** 750 third-party package entries were identified after excluding six internal EPHINTA workspace entries. Declared licence metadata: MIT 630, ISC 52, Apache-2.0 21, BSD-3-Clause 14, MPL-2.0 13, BlueOak-1.0.0 10, BSD-2-Clause 5, and five single-entry declarations (Unlicense, CC-BY-4.0, MIT-0, 0BSD, and MIT OR CC0-1.0). The six metadata-unknown entries were the three internal workspace packages and their linked workspace aliases, not third-party packages.\n\nA repeatable inventory generator now lives at `scripts/qa/ephinta-license-inventory.mjs`; run it with `node scripts/qa/ephinta-license-inventory.mjs`. It writes a Markdown inventory under `artifacts/`. The CI workflow uploads that inventory. A package's `license` field is a discovery signal, not a substitute for reading its actual licence text. Manually review attribution requirements (including CC-BY), source-distribution obligations (including MPL), and every package's shipped licence/NOTICE files.

### 4. Source similarity / plagiarism

This audit did not identify a specific copied work. It also did not run a comprehensive code-search comparison against public repositories, proprietary code databases, design marketplaces, or stock-media catalogues. Therefore, it cannot certify that every source file or asset is original.

**Recommended review workflow:**

1. Record source and author for code/assets brought in from outside the project.
2. Compare suspicious long/unique code fragments against their claimed upstream source.
3. Review generated/copied CSS and UI components for attribution and licence compatibility.
4. Inspect image/audio metadata and original purchase/licence records.
5. For every potential match, compare context and licence terms; do not treat generic patterns, framework boilerplate, or similarity-tool output alone as proof of infringement.
6. Remove or replace material only after preserving the evidence and confirming the rights issue.

## Required release actions

- [ ] Rights holder confirms the EPHINTA copyright owner and approves the project licence.
- [ ] Confirm written rights for all six MP3 files or remove assets without permission.
- [x] Generate a dependency licence inventory from the current application lockfile (repeat for every release lockfile).
- [ ] Add `THIRD_PARTY_NOTICES.md` with dependency name, version, licence, and required attribution.
- [ ] Run source and asset similarity review; record matches, URLs, licence compatibility, and disposition.
- [x] Add an automated inventory CI workflow; restricted/custom licence review remains a manual release gate.
- [ ] Obtain legal review before commercial distribution.

## Design inspiration and attribution

The README uses a clean editorial hierarchy, compact navigation, scannable feature tables, restrained badges/visual blocks, and copyable quick-start instructions. These are general documentation conventions, not copied Pinterest assets or a reproduction of Pinterest's product UI. Pinterest's developer guidelines prohibit unauthorized scraping and imitation of Pinterest's visual design; EPHINTA should use inspiration as a starting point, not reproduce Pinterest's layouts or materials.

Reference: https://policy.pinterest.com/en-gb/developer-guidelines
