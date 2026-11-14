import { expect, test } from "@playwright/test";

test("music stays unavailable until the platform owner configures a licensed source", async ({ page }) => {
  const audioRequests: string[] = [];
  page.on("request", (request) => {
    if (/\.(mp3|m4a|wav|ogg)(\?|$)/i.test(request.url())) audioRequests.push(request.url());
  });

  await page.goto("/");
  await expect(page.getByRole("dialog", { name: /background music/i })).toHaveCount(0);
  await expect(page.locator(".eph-audio__player, .eph-audio__restore, .eph-audio__backdrop")).toHaveCount(0);
  await expect(page.locator("audio")).toHaveCount(0);
  expect(audioRequests).toEqual([]);
});

test("a saved music consent cannot activate an absent audio source", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("ephinta:sound", "on"));
  await page.goto("/");
  await expect(page.locator(".eph-audio__player, .eph-audio__restore, .eph-audio__backdrop")).toHaveCount(0);
  await expect(page.locator("audio")).toHaveCount(0);
});
