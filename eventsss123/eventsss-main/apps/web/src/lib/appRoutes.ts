export const APP_ROUTE_PATHS = {
  home: "/",
  plan: "/plan",
  auth: "/auth/:mode",
  resetPassword: "/reset-password",
  dashboard: "/dashboard/:role",
  legacyDashboard: "/app/*",
} as const;

const LEGACY_ROLE_SEGMENTS: Record<string, string> = {
  client: "client",
  planner: "client",
  "executive-planner": "client",
  organization: "organization",
  vendor: "vendor",
  affiliate: "affiliate",
  verifier: "verifier",
  consultant: "consultant",
  admin: "admin",
};

const DASHBOARD_ROLE_SEGMENTS = new Set([
  "client",
  "organization",
  "vendor",
  "affiliate",
  "verifier",
  "consultant",
  "admin",
]);

export function legacyDashboardPath(path: string): string | null {
  const segment = path.replace(/^\/+|\/+$/g, "").split("/")[0]?.toLowerCase();
  const role = segment ? LEGACY_ROLE_SEGMENTS[segment] : undefined;
  return role ? `/dashboard/${role}` : null;
}

export function dashboardRouteRedirect(
  sessionRole: string | null,
  requestedRole: string,
): string | null {
  const requested = requestedRole.toLowerCase();
  if (!sessionRole) {
    const role = DASHBOARD_ROLE_SEGMENTS.has(requested) ? requested.toUpperCase() : "CLIENT";
    return `/auth/signin?role=${encodeURIComponent(role)}`;
  }
  if (!DASHBOARD_ROLE_SEGMENTS.has(requested) || requested !== sessionRole.toLowerCase()) {
    return `/dashboard/${sessionRole.toLowerCase()}`;
  }
  return null;
}
