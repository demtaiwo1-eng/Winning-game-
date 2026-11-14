# EPHINTA licensed-audio browser test policy

The application must not request or play third-party audio unless the platform owner configures a rights-cleared HTTPS source using `VITE_EPHINTA_LICENSED_AUDIO_URL` or the explicit audio component prop.

The current release intentionally bundles no unverified audio. Therefore browser tests must not require a prompt, `<audio>` element, bundled MP3, or artist-specific track when no licensed source is configured.

Browser coverage should verify:

- No audio prompt/player/audio element is rendered without a configured licensed source.
- No audio network request is made in the no-source configuration, including on mobile.
- A saved consent preference cannot create a player or cause an audio request while the source is absent.
- Event CTA actions still select the correct event category and planner defaults independently of audio availability.
- If a licensed source is configured in a dedicated test fixture, consent, playback controls, pause/mute and source failure behavior can be tested against that fixture.

Do not weaken the rights gate or re-add removed recordings to satisfy stale tests. A future licensed-source playback test must use a test-owned fixture with documented rights and must not rely on private provider credentials.
