EPHINTA Landing Page Props Fix

Why: The recovery script selected PublicLanding.tsx, but EnterpriseApp passes onOpenAuth and onStartBuilder while PublicLanding's props did not declare them. The TypeScript build failed.

The script backs up affected source files, adjusts PublicLanding prop typing to accept the existing route callbacks, makes onLoginSuccess optional and guards its direct calls, runs the production build, and verifies hashes of existing logo files.

It does not edit or replace any logo/image asset.

Run from /workspaces/eventsss:
  chmod +x ephinta-fix-landing-props.sh
  bash -n ephinta-fix-landing-props.sh
  ./ephinta-fix-landing-props.sh

If it stops with a safe-check error, share the output instead of forcing it.
