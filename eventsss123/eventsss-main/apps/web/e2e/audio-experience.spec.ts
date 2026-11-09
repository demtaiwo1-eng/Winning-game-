import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "musicPlayCalls", { value: 0, writable: true });
    HTMLMediaElement.prototype.play = function () {
      (window as Window & { musicPlayCalls: number }).musicPlayCalls += 1;
      this.dispatchEvent(new Event("play"));
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () { this.dispatchEvent(new Event("pause")); };
    HTMLMediaElement.prototype.load = function () {};
  });
});

test("accepting background music saves consent, starts playback and displays player controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const prompt = page.getByRole("dialog", { name: "Enjoy background music?" });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "Yes, play music" }).click();
  await expect(prompt).toHaveCount(0);
  await expect(page.locator(".eph-audio__player")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause music" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ephinta:sound"))).toBe("on");
  await expect.poll(() => page.evaluate(() => (window as Window & { musicPlayCalls: number }).musicPlayCalls)).toBe(1);
  await expect(page.locator("audio")).toHaveAttribute("src", /Wedding/);
});

test("declining music dismisses the prompt, saves the choice and keeps audio stopped", async ({ page }) => {
  await page.goto("/");
  const prompt = page.getByRole("dialog", { name: "Enjoy background music?" });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "No, thanks" }).click();
  await expect(prompt).toHaveCount(0);
  await expect(page.locator(".eph-audio__player, .eph-audio__restore, .eph-audio__backdrop")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ephinta:sound"))).toBe("off");
  await expect.poll(() => page.evaluate(() => (window as Window & { musicPlayCalls: number }).musicPlayCalls)).toBe(0);
});

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
  { name: "small mobile", width: 320, height: 740 },
];
for (const viewport of viewports) {
  test("music permission prompt fits " + viewport.name, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    const prompt = page.getByRole("dialog", { name: "Enjoy background music?" });
    await expect(prompt).toBeVisible();
    const bounds = await prompt.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
  });
}

test("saved music consent restores the visible player and attempts playback", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("ephinta:sound", "on"));
  await page.goto("/");
  await expect(page.getByRole("dialog", { name: "Enjoy background music?" })).toHaveCount(0);
  await expect(page.locator(".eph-audio__player")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause music" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as Window & { musicPlayCalls: number }).musicPlayCalls)).toBeGreaterThanOrEqual(1);
});

test("player controls switch tracks, categories, volume and stop playback", async ({ page }) => {
  await page.goto("/");
  const prompt = page.getByRole("dialog", { name: "Enjoy background music?" });
  await prompt.getByRole("button", { name: "Yes, play music" }).click();

  const audio = page.locator("audio");
  await expect(audio).toHaveAttribute("src", /Here%20we%20are-1/);
  await page.getByRole("button", { name: "Next track" }).click();
  await expect(audio).toHaveAttribute("src", /Here%20we%20are-2/);

  await page.getByRole("combobox", { name: "Music category" }).selectOption("naming");
  await expect(audio).toHaveAttribute("src", /Welcome,%20Little%20One-1/);

  await page.getByRole("slider", { name: "Music volume" }).evaluate((element) => {
    const slider = element as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    valueSetter?.call(slider, "0.6");
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ephinta:sound-volume"))).toBe("0.6");

  await page.getByRole("button", { name: "Minimize" }).click();
  await page.getByRole("button", { name: "Open music player" }).click();
  await expect(page.locator(".eph-audio__player")).toBeVisible();

  await page.getByRole("button", { name: "Turn music off" }).click();
  await expect(page.locator(".eph-audio__player, .eph-audio__restore")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ephinta:sound"))).toBe("off");
});

test("all bundled EPHINTA music files are served as non-empty audio assets", async ({ page }) => {
  await page.goto("/");
  const tracks = [
    "/audio/Here%20we%20are-1%20-Wale%20Waves_ESS_Wedding.mp3",
    "/audio/Here%20we%20are-2%20-Wale%20Waves_ESS_Wedding.mp3",
    "/audio/Welcome,%20Little%20One-1-Wale%20Waves_ESS_Naming.mp3",
    "/audio/Welcome,%20Little%20One-2-Wale%20Waves_ESS_Naming.mp3",
    "/audio/You%20Will%20Live%20in%20Our%20Hearts-1-Wale%20Waves_ESS_Burials.mp3",
    "/audio/You%20Will%20Live%20in%20Our%20Hearts-2-Wale%20Waves_ESS_Burials.mp3",
  ];
  for (const track of tracks) {
    const response = await page.request.get(track);
    expect(response.ok(), track + " should return a successful response").toBeTruthy();
    expect(response.headers()["content-type"] || "").toMatch(/audio|octet-stream/i);
    expect((await response.body()).byteLength, track + " should not be empty").toBeGreaterThan(10000);
  }
});
