# EPHINTA asset rights register

This register is the release control for images, audio, fonts, video, and other non-code assets. An asset may be included in a commercial release only when the rights holder, licence/permission, allowed uses, and evidence reference are recorded.

## Audio assets removed from the current release branch

The following six recordings were each present twice (repository root and `apps/web/public/audio/`). All 12 tracked copies have been removed from the current branch because no signed commercial distribution permission was found in the repository:

| Recording | Intended category | Rights status |
|---|---|---|
| Here We Are 1 — Wale Waves | Wedding | Unverified; not bundled |
| Here We Are 2 — Wale Waves | Wedding | Unverified; not bundled |
| Welcome, Little One 1 — Wale Waves | Naming ceremony | Unverified; not bundled |
| Welcome, Little One 2 — Wale Waves | Naming ceremony | Unverified; not bundled |
| You Will Live in Our Hearts 1 — Wale Waves | Burial | Unverified; not bundled |
| You Will Live in Our Hearts 2 — Wale Waves | Burial | Unverified; not bundled |

This is a precaution, not a finding that the recordings are stolen or that the user does not own them. The user previously requested the Wale Waves tracks for event categories, but no explicit ownership or commercial licence statement was located. If the rights holder confirms ownership, provide evidence for both the master recording and composition, plus permission for in-app streaming, commercial use, territories, term, and attribution. Then add the source to the asset manifest and configure `VITE_EPHINTA_LICENSED_AUDIO_URL`.

## Remaining visual assets

The app contains EPHINTA logo variants, favicons, launcher/splash images, and three people/avatar SVG illustrations. They are not identified as third-party stock assets by the repository names, but their origin is not proven by filenames. The platform owner must confirm that they were commissioned, created, purchased under a commercial licence, or otherwise cleared.

## Required manifest record

Every non-code asset shipped with the application must have an entry in `docs/assets/asset-rights.json` with:

- `path`: exact repository-relative asset path.
- `creatorOrRightsHolder`: legal name or organisation.
- `licence`: licence name/version or written-permission description.
- `commercialDistribution`: true only where the licence explicitly permits the planned use.
- `evidenceRef`: private contract/order/release reference; never store private contracts or personal information in the public repository.
- `attribution`: exact wording required in the product, if any.

The manifest currently contains no approved audio assets. The CI rights gate fails if an audio file is added without a corresponding approved manifest record.
