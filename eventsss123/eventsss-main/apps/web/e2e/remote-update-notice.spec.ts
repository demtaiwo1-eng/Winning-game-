import { expect, test, type Page } from "@playwright/test";

async function enableDevUpdateNotice(page: Page) {
  await page.addInitScript(() => localStorage.setItem("ephinta:dev-update-notice", "enabled"));
}

async function publishPatchNotice(page: import("@playwright/test").Page) {
  await page.route("**/app-updates/version.json**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Cache-Control": "no-store" },
      body: JSON.stringify({
        version: "ephinta-test-patch-20261109",
        url: "ephinta-web-bundle.zip?v=ephinta-test-patch-20261109",
        title: "EPHINTA dashboard improvements",
        message: "A verified patch is ready for your installed application.",
        updateType: "web",
      }),
    });
  });
}

test("connected desktop app displays and can dismiss a server-published patch notice", async ({ page }) => {
  await enableDevUpdateNotice(page);
  await publishPatchNotice(page);
  await page.goto("/");

  const notice = page.getByRole("status", { name: "EPHINTA update available" });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("EPHINTA dashboard improvements");
  await expect(notice).toContainText("A verified patch is ready");
  await notice.getByRole("button", { name: "Later" }).click();
  await expect(notice).toHaveCount(0);
});

test("web install action records the patch and reloads without repeating its notice", async ({ page }) => {
  await enableDevUpdateNotice(page);
  await publishPatchNotice(page);
  await page.goto("/");

  const notice = page.getByRole("status", { name: "EPHINTA update available" });
  await expect(notice).toBeVisible();
  await Promise.all([
    page.waitForNavigation(),
    notice.getByRole("button", { name: "Install update" }).click(),
  ]);

  await expect(page.getByRole("status", { name: "EPHINTA update available" })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ephinta:installed-version"))).toBe("ephinta-test-patch-20261109");
});

test("remote patch notice fits a mobile installation without horizontal overflow @mobile", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await enableDevUpdateNotice(page);
  await publishPatchNotice(page);
  await page.goto("/");

  const notice = page.getByRole("status", { name: "EPHINTA update available" });
  await expect(notice).toBeVisible();
  const bounds = await notice.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(360);
  await expect(notice.getByRole("button", { name: "Install update" })).toBeVisible();
});
