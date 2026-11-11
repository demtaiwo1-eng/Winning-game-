import { expect, test } from "@playwright/test";

test("homepage marketplace category buttons open the real marketplace route", async ({ page }) => {
  await page.goto("/");
  const categories = page.getByRole("button", { name: "Explore services" });
  await expect(categories).toHaveCount(4);
  await categories.first().click();
  await expect(page).toHaveURL(/marketplace/);
});

test("featured marketplace CTA opens the real marketplace route", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Explore marketplace/ }).click();
  await expect(page).toHaveURL(/marketplace/);
});
