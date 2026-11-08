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

test("music consent opens the player and its playback controls work", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const prompt = page.getByRole("dialog", { name: "Enjoy background music?" });
  await expect(prompt).toBeVisible();
  await expect(page.locator(".eph-audio__backdrop")).toHaveCSS("position", "fixed");
  await prompt.getByRole("button", { name: "Yes, play music" }).click();
  const player = page.getByRole("region", { name: "EPHINTA music player" });
  await expect(player).toBeVisible();
  await expect(player.getByText("Here We Are — Wedding 1")).toBeVisible();
  await expect(player.getByRole("button", { name: "Pause music" })).toBeVisible();
  await player.getByRole("button", { name: "Next track" }).click();
  await expect(player.getByText("Here We Are — Wedding 2")).toBeVisible();
  await player.getByRole("button", { name: "Previous track" }).click();
  await expect(player.getByText("Here We Are — Wedding 1")).toBeVisible();
  await player.getByRole("button", { name: "Pause music" }).click();
  await expect(player.getByRole("button", { name: "Play music" })).toBeVisible();
  await player.getByRole("button", { name: "Play music" }).click();
  await expect(player.getByRole("button", { name: "Pause music" })).toBeVisible();
  await player.getByRole("button", { name: "Mute music" }).click();
  await expect(player.getByRole("button", { name: "Unmute music" })).toBeVisible();
  await player.getByLabel("Music volume").fill("0.5");
  await expect.poll(() => page.locator("audio").evaluate((audio: HTMLAudioElement) => audio.volume)).toBe(0.5);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ephinta:sound"))).toBe("on");
});

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
  { name: "small mobile", width: 320, height: 740 },
];
for (const viewport of viewports) {
  const projectTag = viewport.name.includes("mobile") ? " @mobile" : "";
  test("music player fits " + viewport.name + " without horizontal overflow" + projectTag, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.addInitScript(() => localStorage.setItem("ephinta:sound", "on"));
    await page.goto("/");
    const player = page.getByRole("region", { name: "EPHINTA music player" });
    await expect(player).toBeVisible();
    const bounds = await player.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    await expect(player.getByRole("button", { name: "Play music" })).toBeVisible();
    await expect(player.getByRole("button", { name: "Next track" })).toBeVisible();
  });
}

test("declining music closes the prompt and remembers the choice", async ({ page }) => {
  await page.goto("/");
  const prompt = page.getByRole("dialog", { name: "Enjoy background music?" });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "No, thanks" }).click();
  await expect(prompt).toHaveCount(0);
  await expect(page.getByRole("region", { name: "EPHINTA music player" })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ephinta:sound"))).toBe("off");
  await expect.poll(() => page.evaluate(() => (window as Window & { musicPlayCalls: number }).musicPlayCalls)).toBe(0);
});

test("track playback advances when the current track ends", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("ephinta:sound", "on"));
  await page.goto("/");
  const audio = page.locator("audio");
  await audio.evaluate((element) => element.dispatchEvent(new Event("ended")));
  await expect(page.getByText("Here We Are — Wedding 2")).toBeVisible();
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

test("music can be re-enabled after a user turns it off", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("ephinta:sound", "off"));
  await page.goto("/");
  const restore = page.getByRole("button", { name: "♫ Turn music on" });
  await expect(restore).toBeVisible();
  await restore.click();
  await expect(page.getByRole("region", { name: "EPHINTA music player" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("ephinta:sound"))).toBe("on");
});
