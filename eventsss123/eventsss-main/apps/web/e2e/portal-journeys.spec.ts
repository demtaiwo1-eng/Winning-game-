import { expect, test, type Page, type Route } from "@playwright/test";

type PortalCase = {
  role: string;
  email: string;
  organizationMode?: "EVENT_PLANNING" | "SERVICE_PROVIDER";
  heading: RegExp;
};

const portals: PortalCase[] = [
  { role: "CLIENT", email: "qa-client@example.com", heading: /Welcome back, QA\./ },
  { role: "ORGANIZATION", email: "qa-org-planning@example.com", organizationMode: "EVENT_PLANNING", heading: /Welcome back, QA\./ },
  { role: "ORGANIZATION", email: "qa-org-provider@example.com", organizationMode: "SERVICE_PROVIDER", heading: /Sell the experience\./ },
  { role: "VENDOR", email: "qa-vendor@example.com", heading: /Sell the experience\./ },
  { role: "AFFILIATE", email: "qa-affiliate@example.com", heading: /Grow the event network\./ },
  { role: "VERIFIER", email: "qa-verifier@example.com", heading: /Pre-event service confirmation/ },
  { role: "CONSULTANT", email: "qa-consultant@example.com", heading: /Operations updates/ },
  { role: "ADMIN", email: "qa-admin@example.com", heading: /Platform operations/ },
];

async function installRoleApiFixtures(page: Page, portal: PortalCase) {
  await page.addInitScript(() => localStorage.setItem("ess_onboard_v1", "1"));
  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const json = (body: unknown, status = 200) => route.fulfill({
      status, contentType: "application/json", body: JSON.stringify(body),
    });

    if (path.endsWith("/auth/login") && request.method() === "POST") {
      return json({
        user: {
          id: `qa-${portal.role.toLowerCase()}`,
          name: "QA Tester",
          email: portal.email,
          role: portal.role,
          organizationMode: portal.organizationMode ?? null,
          country: "NG",
          currency: "NGN",
          locale: "en",
        },
        accessToken: "qa-e2e-access-token",
        refreshToken: "qa-e2e-refresh-token",
        expiresIn: 900,
      });
    }
    if (path.endsWith("/vendor/categories")) return json({ items: [{ id: "cat-catering", name: "Catering" }] });
    if (path.endsWith("/vendor/listings") && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      return json({
        listing: {
          id: "qa-listing-001",
          title: body.title,
          description: body.description,
          priceMinor: String(body.priceMinor),
          currency: body.currency || "NGN",
          city: body.city || "Ibadan",
          capacity: body.capacity || 100,
          status: "DRAFT",
          type: body.type || "SERVICE",
          category: { name: "Catering" },
        },
      }, 201);
    }
    if (path.endsWith("/vendor/listings")) return json({ items: [] });
    if (path.endsWith("/vendor/metrics")) return json({
      listings: { ACTIVE: 0, DRAFT: 0, PAUSED: 0 },
      bookings: {},
      enquiries: {},
      reviews: { averageRating: null, count: 0 },
    });
    if (path.endsWith("/vendor/profile")) return json({ profile: { id: "qa-profile", businessName: "QA Services", country: "NG", city: "Ibadan" } });
    if (path.endsWith("/readiness/queue")) return json({ items: [] });
    if (path.endsWith("/readiness/mine")) return json({ items: [] });
    if (path.endsWith("/admin/overview")) return json({
      accounts: { total: 8, active: 8 }, events: 0, vendors: 2, activeListings: 0,
      activeMarkets: 0, pendingVerifications: 0, disputedBookings: 0,
      bookingsByStatus: {}, settledBookingValue: [], recentAudit: [],
    });
    if (path.endsWith("/notifications")) return json({ items: [] });
    if (path.includes("/admin/") || path.includes("/finance/")) {
      return json({ items: [], total: 0, pages: 0, summary: [], readOnly: true });
    }
    return json({ items: [], total: 0, pages: 0, summary: [] });
  });
}

for (const portal of portals) {
  test(`sign-in and workspace smoke journey: ${portal.role}${portal.organizationMode ? ":" + portal.organizationMode : ""}`, async ({ page }) => {
    await installRoleApiFixtures(page, portal);
    await page.goto(`/auth/signin?role=${portal.role}`);
    await page.getByLabel("Email").fill(portal.email);
    await page.getByRole("textbox", { name: "Password" }).fill("QaOnlyPassword123!");
    const loginRequest = page.waitForRequest((request) => request.method() === "POST" && request.url().includes("/auth/login"), { timeout: 15_000 });
    await page.getByRole("textbox", { name: "Password" }).press("Enter");
    await loginRequest;

    await expect(page).toHaveURL(new RegExp(`/dashboard/${portal.role.toLowerCase()}$`));
    await expect(page.getByRole("heading", { name: portal.heading }).first()).toBeVisible();
    // Let initial authenticated workspace requests settle before interacting.
    // This prevents async dashboard hydration from detaching controls mid-click.
    await page.waitForLoadState("networkidle");

    if (portal.role === "CLIENT" || (portal.role === "ORGANIZATION" && portal.organizationMode === "EVENT_PLANNING")) {
      await page.getByRole("button", { name: /New event/ }).click();
      await expect(page.getByRole("heading", { name: "Create event", exact: true })).toBeVisible();
    } else if (portal.role === "VENDOR" || (portal.role === "ORGANIZATION" && portal.organizationMode === "SERVICE_PROVIDER")) {
      await page.getByRole("button", { name: /Add package/ }).first().click({ force: true });
      await expect(page.getByRole("heading", { name: "Add service package" })).toBeVisible();
      await page.getByLabel("Package name").fill("QA Catering Package");
      await page.getByLabel("What is included?").fill("Test-only catering package");
      await page.getByLabel("Price").fill("50000");
      await page.getByLabel("Capacity").fill("120");
      await page.getByLabel("Operating city").fill("Ibadan");
      await page.getByLabel("Lead time").fill("7 days");
      await page.getByRole("button", { name: "Save complete package" }).click({ force: true });
      await expect(page.getByText(/Package saved as a draft/)).toBeVisible();
    } else if (portal.role === "AFFILIATE") {
      await page.getByLabel("Referral code").fill("QA-E2E-REF");
      await page.getByRole("button", { name: "Save partner profile" }).click({ force: true });
      await expect(page.getByText("Affiliate preferences saved.")).toBeVisible();
    } else if (portal.role === "VERIFIER") {
      await expect(page.getByText(/No recent or upcoming events need verifier action/)).toBeVisible();
    } else if (portal.role === "CONSULTANT") {
      await expect(page.getByText(/No updates yet/)).toBeVisible();
    } else if (portal.role === "ADMIN") {
      await expect(page.getByText("8", { exact: true }).first()).toBeVisible();
      await page.getByRole("button", { name: "Refresh" }).click({ force: true });
      await expect(page.getByRole("heading", { name: "Platform operations" })).toBeVisible();
    }

    await page.evaluate(() => { localStorage.removeItem("ess_user"); localStorage.removeItem("ess_access_token"); localStorage.removeItem("ess_refresh_token"); });
    await page.goto("/");
    await expect(page).toHaveURL("/");
  });
}


test("CLIENT and VENDOR workspaces remain usable on a phone viewport @mobile", async ({ page }) => {
  const client = portals.find((portal) => portal.role === "CLIENT")!;
  await installRoleApiFixtures(page, client);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/auth/signin?role=CLIENT");
  await page.getByLabel("Email").fill(client.email);
  await page.getByRole("textbox", { name: "Password" }).fill("QaOnlyPassword123!");
  const loginRequest = page.waitForRequest((request) => request.method() === "POST" && request.url().includes("/auth/login"), { timeout: 15_000 });
  await page.getByRole("textbox", { name: "Password" }).press("Enter");
  await loginRequest;
  await expect(page.getByRole("heading", { name: client.heading }).first()).toBeVisible();
  const clientWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(clientWidth).toBeLessThanOrEqual(390);

  await page.evaluate(() => { localStorage.removeItem("ess_user"); localStorage.removeItem("ess_access_token"); localStorage.removeItem("ess_refresh_token"); });
  const vendor = portals.find((portal) => portal.role === "VENDOR")!;
  await installRoleApiFixtures(page, vendor);
  await page.goto("/auth/signin?role=VENDOR");
  await page.getByLabel("Email").fill(vendor.email);
  await page.getByRole("textbox", { name: "Password" }).fill("QaOnlyPassword123!");
  await page.getByRole("button", { name: /Continue securely/ }).click({ force: true });
  await expect(page.getByRole("heading", { name: vendor.heading }).first()).toBeVisible();
  const vendorWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(vendorWidth).toBeLessThanOrEqual(390);
});
