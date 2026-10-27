# React Router entry-flow integration

## Changelog

- Mounted the browser app with `BrowserRouter`; Capacitor uses `HashRouter` so native deep paths work without server-side URL rewriting.
- Added route-backed public landing (`/`), event-planning wizard (`/plan`), authentication (`/auth/signin`, `/auth/signup`, `/auth/forgot`), and role dashboards (`/dashboard/:role`).
- Kept role and auth mode in the URL so links can be bookmarked, refreshed, and traversed with browser back/forward.
- Redirected unauthenticated dashboard visits to the matching sign-in route and authenticated sign-in routes back to the signed-in user's dashboard.
- Updated app shell, wizard, auth modal, sign-out, and workspace-switch actions to use React Router navigation.

## Verification

- `npm run build:web` — passed.
- `npm test -w apps/web` — passed (6 tests).
- TypeScript/editor diagnostics on the changed files — no errors.
- PWA production build generated `dist/sw.js`.

## Phone/browser tap-through checklist

1. Open `/` and choose **Start planning**; confirm the URL changes to `/plan`.
2. Complete the planner questions; confirm **Save brief and create account** opens sign-up with the CLIENT role selected.
3. Use the auth mode and role controls; confirm the URL updates while the selected mode and role remain visible.
4. Refresh on `/auth/signin?role=VENDOR`; confirm the vendor sign-in screen opens.
5. While signed out, open `/dashboard/vendor`; confirm it redirects to vendor sign-in.
6. Sign in and confirm the URL becomes `/dashboard/<your-role>`; use browser back/forward and verify screen state follows the URL.
7. In the native Capacitor build, confirm route URLs use the hash and that the wizard/auth flows still work.

Automated CI does not include a browser DOM interaction harness, so the route-level tap-through remains a device/manual check.
