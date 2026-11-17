# EPHINTA Music DSP — MVP

## Product fit
The DSP is an addition to the existing EPHINTA app, not a separate app. Music continues to play through the existing consent-based AudioExperience player. Existing AFFILIATE accounts can be linked by an administrator to a Music Rights Owner profile; linked owners see a **Music rights & royalties** section in their existing portal. No new registration flow or app navigation system is introduced.

## Commercial rule
- Rights holders collectively receive **30% of eligible net DSP revenue**.
- Eligible sources: advertising, sponsorships and other recorded music-channel revenue.
- The remaining 70% is retained by EPHINTA for platform operations and distribution costs.
- The 30% pool is allocated between rights owners in proportion to eligible listening seconds on tracks assigned to each owner during the statement period.
- Revenue must be recorded net of taxes, refunds, ad-network deductions and other agreed pass-through costs before settlement generation.
- Calculations are currency-specific. No foreign-exchange conversion is performed.
- Statements are generated as pending liabilities; no automatic payout is made in this MVP.

## Measurement
The existing player reports authenticated listening sessions when playback pauses or finishes. Sessions shorter than five seconds are ignored. Listening time is accumulated from media playback progress, not from time the app is merely open. Reports require an authenticated account, ignore sessions shorter than five seconds, and are capped at one reported listening hour per account in a rolling hour. These are client-reported usage analytics with basic abuse limits, not independently verified playback or third-party ad impressions.

## Portal
- Rights owner: catalogue, play count, listening time, 30% share rate and royalty statements.
- Admin API: link an existing AFFILIATE account, register/assign tracks, record net revenue by source and currency, and generate period statements.
- Existing tracks remain in the repository and are registered by migration. No audio files are deleted or moved.

## Rights and release evidence
The rights holder has expressly confirmed in the project conversation that they hold commercial rights to all songs currently in the repository. This is recorded as a rights-holder declaration, not as an independently audited licence document. Keep the recordings available; attach contracts or written rights evidence to the rights register before external DSP distribution or third-party licensing.

## Not included yet
Ad-network SDKs, sponsor campaign sales, public streaming distribution, rights verification workflow, tax withholding, KYC/payout onboarding, automated wallet/bank payouts, dispute handling and formal royalty statements remain later integration steps. Never fabricate ad revenue or mark a statement paid without a verified payment reference.
