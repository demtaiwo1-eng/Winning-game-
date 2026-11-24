import { expect, test } from "@playwright/test";

test("desktop and tablet browser screens never show a click-to-update prompt", async ({ page }) => {
  for (const width of [768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/app-updates/version.json**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Cache-Control": "no-store" },
        body: JSON.stringify({
          version: "ephinta-test-patch-20261124",
          url: "ephinta-web-bundle.zip?v=ephinta-test-patch-20261124",
          title: "EPHINTA dashboard improvements",
          message: "A verified patch is ready.",
          updateType: "web",
        }),
      });
    });
    await page.goto("/");
    await expect(page.getByRole("status", { name: "EPHINTA update available" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Install update" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Later" })).toHaveCount(0);
  }
});
