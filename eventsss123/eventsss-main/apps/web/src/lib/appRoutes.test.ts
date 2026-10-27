import { describe, expect, it } from "vitest";
import { matchRoutes } from "react-router-dom";
import { APP_ROUTE_PATHS, dashboardRouteRedirect, legacyDashboardPath } from "./appRoutes";

describe("application routes", () => {
  it("matches the public, auth, reset, dashboard, and legacy route shapes", () => {
    const routes = Object.values(APP_ROUTE_PATHS).map((path) => ({ path }));
    const expectedMatches = [
      ["/", "/"],
      ["/plan", "/plan"],
      ["/auth/signin", "/auth/:mode"],
      ["/reset-password", "/reset-password"],
      ["/dashboard/vendor", "/dashboard/:role"],
      ["/app/planner", "/app/*"],
    ] as const;

    for (const [url, route] of expectedMatches) {
      expect(matchRoutes(routes, url)?.at(-1)?.route.path).toBe(route);
    }
  });

  it.each([
    ["planner", "/dashboard/client"],
    ["executive-planner", "/dashboard/client"],
    ["organization", "/dashboard/organization"],
    ["vendor", "/dashboard/vendor"],
    ["affiliate", "/dashboard/affiliate"],
    ["verifier", "/dashboard/verifier"],
    ["consultant", "/dashboard/consultant"],
    ["admin", "/dashboard/admin"],
    ["rider", null],
    ["unknown", null],
  ])("maps legacy role path %s to %s", (path, expected) => {
    expect(legacyDashboardPath(path)).toBe(expected);
  });

  it.each([
    [null, "vendor", "/auth/signin?role=VENDOR"],
    [null, "rider", "/auth/signin?role=CLIENT"],
    ["VENDOR", "vendor", null],
    ["VENDOR", "client", "/dashboard/vendor"],
    ["ORGANIZATION", "unknown", "/dashboard/organization"],
  ] as const)("guards dashboard access for session role %s and requested role %s", (sessionRole, requestedRole, expected) => {
    expect(dashboardRouteRedirect(sessionRole, requestedRole)).toBe(expected);
  });
});
