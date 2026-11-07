import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const viewports = [
  { name: "mobile-390x844", width: 390, height: 844 },
  { name: "tablet-768x1024", width: 768, height: 1024 },
  { name: "desktop-1440x900", width: 1440, height: 900 },
];

test("EPHINTA landing page responsive UX audit and screenshots", async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  const report: Array<Record<string, unknown>> = [];
  for (const viewport of viewports) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/", { waitUntil: "networkidle" });
      await expect(page.locator("body")).toBeVisible();

      const metrics = await page.evaluate(() => {
        const root = document.documentElement;
        const body = document.body;
        const visibleControls = [...document.querySelectorAll("a,button,input,select,textarea")]
          .filter(element => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
          }).length;
        const oversizedImages = [...document.images]
          .filter(image => {
            const rect = image.getBoundingClientRect();
            return rect.width > innerWidth * 0.9 && rect.height > innerHeight * 0.45;
          }).map(image => ({ src: image.currentSrc || image.src, width: image.width, height: image.height }));
        return {
          title: document.title,
          viewportWidth: innerWidth,
          documentWidth: Math.max(root.scrollWidth, body.scrollWidth),
          horizontalOverflow: Math.max(root.scrollWidth, body.scrollWidth) > innerWidth + 1,
          visibleControls,
          oversizedImages,
          bodyTextLength: (body.innerText || "").trim().length
        };
      });

      const screenshot = testInfo.outputPath(`landing-${viewport.name}.png`);
      await page.screenshot({ path: screenshot, fullPage: true, animations: "disabled" });
      await testInfo.attach(`landing-${viewport.name}`, { path: screenshot, contentType: "image/png" });
      report.push({ viewport: viewport.name, ...metrics, screenshot: path.basename(screenshot) });
      expect(metrics.bodyTextLength, "Landing page should render meaningful content").toBeGreaterThan(20);
      expect(metrics.horizontalOverflow, `Horizontal overflow at ${viewport.name}`).toBe(false);
    });
  }

  fs.mkdirSync(testInfo.outputDir, { recursive: true });
  fs.writeFileSync(path.join(testInfo.outputDir, "responsive-audit.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    pageErrors,
    viewports: report
  }, null, 2));
  await testInfo.attach("responsive-audit-report", {
    path: path.join(testInfo.outputDir, "responsive-audit.json"),
    contentType: "application/json"
  });
  expect(pageErrors, "No uncaught browser page errors").toEqual([]);
});

test("EPHINTA event planner inherits the parent design system on every viewport", async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const report: Array<Record<string, unknown>> = [];

  for (const viewport of viewports) {
    await test.step(`/plan ${viewport.name}`, async () => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/plan", { waitUntil: "networkidle" });
      const card = page.locator(".ess-builder-card").first();
      await expect(card, "Event planner parent card should render").toBeVisible();

      const theme = await card.evaluate(element => {
        const cardStyle = getComputedStyle(element);
        const field = element.querySelector("input, select, textarea");
        const fieldStyle = field ? getComputedStyle(field) : null;
        return {
          backgroundImage: cardStyle.backgroundImage,
          color: cardStyle.color,
          borderColor: cardStyle.borderColor,
          borderRadius: Number.parseFloat(cardStyle.borderRadius),
          fontFamily: cardStyle.fontFamily,
          fieldBackground: fieldStyle?.backgroundColor ?? null,
          fieldBorderColor: fieldStyle?.borderColor ?? null,
          fieldColor: fieldStyle?.color ?? null,
        };
      });

      expect(theme.backgroundImage, "Planner card must use the shared light parent surface").toContain("linear-gradient");
      expect(theme.color, "Planner card text must use the shared dark parent ink").toBe("rgb(33, 29, 55)");
      expect(theme.borderRadius, "Planner card must use the parent rounded surface").toBeGreaterThanOrEqual(16);
      expect(theme.fieldBackground, "Planner inputs must use the shared muted surface").toBe("rgb(249, 248, 252)");
      expect(theme.fieldColor, "Planner input text must use the shared parent ink").toBe("rgb(33, 29, 55)");

      const prompt = page.locator('.eph-audio__prompt[role="dialog"]');
      if (await prompt.isVisible()) {
        const overlay = await prompt.evaluate(element => {
          const promptStyle = getComputedStyle(element);
          const promptRect = element.getBoundingClientRect();
          const action = document.querySelector(".ess-builder-card .ess-primary");
          const actionRect = action?.getBoundingClientRect();
          const overlapsAction = actionRect
            ? !(promptRect.right <= actionRect.left || promptRect.left >= actionRect.right || promptRect.bottom <= actionRect.top || promptRect.top >= actionRect.bottom)
            : false;
          return { backgroundImage: promptStyle.backgroundImage, overlapsAction };
        });
        expect(overlay.backgroundImage, "Audio consent must inherit the parent dialog surface").toContain("linear-gradient");
        expect(overlay.overlapsAction, "Audio consent must not obscure the planner's next action").toBe(false);
      }

      const metrics = await page.evaluate(() => ({
        viewportWidth: innerWidth,
        documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      }));
      expect(metrics.documentWidth, `No horizontal overflow at ${viewport.name}`).toBeLessThanOrEqual(metrics.viewportWidth + 1);

      const screenshot = testInfo.outputPath(`plan-${viewport.name}.png`);
      await page.screenshot({ path: screenshot, fullPage: true, animations: "disabled" });
      await testInfo.attach(`plan-${viewport.name}`, { path: screenshot, contentType: "image/png" });
      report.push({ route: "/plan", viewport: viewport.name, ...metrics, ...theme, screenshot: path.basename(screenshot) });
    });
  }

  fs.mkdirSync(testInfo.outputDir, { recursive: true });
  fs.writeFileSync(path.join(testInfo.outputDir, "plan-theme-audit.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    pageErrors,
    viewports: report
  }, null, 2));
  await testInfo.attach("plan-theme-audit-report", {
    path: path.join(testInfo.outputDir, "plan-theme-audit.json"),
    contentType: "application/json"
  });
  expect(pageErrors, "No uncaught event-planner browser errors").toEqual([]);
});
