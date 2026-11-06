import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "musicPlayCalls", { value: 0, writable: true });
    HTMLMediaElement.prototype.play = function () {
      (window as Window & { musicPlayCalls: number }).musicPlayCalls += 1;
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {};
    HTMLMediaElement.prototype.load = function () {};
  });
});

test("music consent is a small corner prompt and accepted playback advances automatically", async ({ page }) => {
  await page.goto("/");

  const prompt = page.getByRole("dialog", { name: "Enjoy background music?" });
  await expect(prompt).toBeVisible();
  await expect(page.locator(".eph-audio__backdrop")).toHaveCSS("position", "fixed");
  await expect(page.locator(".eph-audio__backdrop")).toHaveCSS("width", "320px");
  await expect(prompt.getByRole("button", { name: "No, thanks" })).toBeVisible();

  await prompt.getByRole("button", { name: "Yes, play music" }).click();
  await expect(prompt).toHaveCount(0);
  await expect.poll(() =>
    page.evaluate(() => localStorage.getItem("ephinta:sound")),
  ).toBe("on");
  await expect.poll(() =>
    page.evaluate(() => (window as Window & { musicPlayCalls: number }).musicPlayCalls),
  ).toBe(1);

  await page.locator("audio").evaluate((audio) => audio.dispatchEvent(new Event("ended")));
  await expect(page.locator("audio")).toHaveAttribute("src", /Here%20we%20are-2/);
  await expect.poll(() =>
    page.evaluate(() => (window as Window & { musicPlayCalls: number }).musicPlayCalls),
  ).toBe(2);

  await page.reload();
  await expect(page.getByRole("dialog", { name: "Enjoy background music?" })).toHaveCount(0);
  await expect.poll(() =>
    page.evaluate(() => (window as Window & { musicPlayCalls: number }).musicPlayCalls),
  ).toBe(1);
});

test("declining music closes the prompt and remembers the choice", async ({ page }) => {
  await page.goto("/");

  const prompt = page.getByRole("dialog", { name: "Enjoy background music?" });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "No, thanks" }).click();

  await expect(prompt).toHaveCount(0);
  await expect.poll(() =>
    page.evaluate(() => localStorage.getItem("ephinta:sound")),
  ).toBe("off");
  await expect.poll(() =>
    page.evaluate(() => (window as Window & { musicPlayCalls: number }).musicPlayCalls),
  ).toBe(0);

  await page.reload();
  await expect(page.getByRole("dialog", { name: "Enjoy background music?" })).toHaveCount(0);
  await expect.poll(() =>
    page.evaluate(() => (window as Window & { musicPlayCalls: number }).musicPlayCalls),
  ).toBe(0);
});
