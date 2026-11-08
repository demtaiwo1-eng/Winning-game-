# EPHINTA signed iOS distribution build

The repository has a passing unsigned iOS Simulator build. This workflow is a separate owner-controlled path for an App Store Connect distribution-signed IPA:

- Workflow: `.github/workflows/ephinta-ios-signed-release.yml`
- Trigger: GitHub Actions → EPHINTA signed iOS distribution build → Run workflow
- Bundle ID: `com.eventselfsolutions.app`
- Minimum iOS deployment target: 13.4
- Output: signed IPA artifact retained for 30 days
- It does not upload to App Store Connect or publish to TestFlight.

## Required Apple account and signing assets

The app owner needs an active Apple Developer Program membership, an App ID matching `com.eventselfsolutions.app`, and an App Store Connect distribution provisioning profile for that App ID. The distribution certificate must be included in the supplied P12 and match the profile.

Configure these repository Actions secrets:

| Secret | Value |
|---|---|
| `IOS_CERTIFICATE_P12_BASE64` | Base64-encoded Apple Distribution certificate and private key exported as a password-protected P12 |
| `IOS_CERTIFICATE_PASSWORD` | Password used to export the P12 |
| `IOS_PROVISIONING_PROFILE_BASE64` | Base64-encoded App Store Connect distribution provisioning profile |
| `IOS_TEAM_ID` | 10-character Apple Developer Team ID |

The workflow validates that the profile Team ID and application identifier match, that it is a distribution profile (not a development or Ad Hoc profile), installs the certificate into a temporary runner keychain, archives and exports the IPA, verifies the code signature, uploads the IPA, and deletes temporary signing material.

## Owner preparation

1. In Apple Developer, confirm the explicit App ID `com.eventselfsolutions.app`.
2. Create or select an Apple Distribution certificate and export its certificate/private key as a password-protected P12.
3. Create an App Store Connect distribution provisioning profile for that App ID and the same distribution certificate.
4. Base64-encode the P12 and profile on a trusted machine and store them only in the GitHub Actions secrets above.
5. Keep the original P12, profile, and export password in secure owner-controlled backups. Never commit them or paste them into chat.
6. Run the workflow from a reviewed `main` commit after all secrets are configured.
7. Download the IPA artifact and use Apple's Transporter or App Store Connect upload flow to submit it to TestFlight. Test on a real iPhone before production release.

## Current status

The unsigned iOS Simulator build has passed. The signed distribution workflow is prepared but cannot run until the owner configures the four Apple signing secrets. An unsigned simulator app is not installable as a normal production iPhone app, and a signed IPA artifact is not proof of device acceptance or App Store approval.
