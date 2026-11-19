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
      const consent = page.getByRole("dialog", { name: "Enjoy background music?" });
      if (await consent.isVisible()) {
        await consent.getByRole("button", { name: "No, thanks" }).click();
      }
      await expect(consent).toBeHidden();
      const brand = page.locator(".eph-nav > .eph-brand");
      await expect(brand).toBeVisible();
      await expect(brand.locator("span")).toBeVisible();
      const brandTextSize = await brand.locator("span").evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize));
      expect(brandTextSize, "EPHINTA brand text must remain legible on every screen").toBeGreaterThanOrEqual(17);

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
        const root = getComputedStyle(document.documentElement);
        const field = element.querySelector("input, select, textarea");
        const fieldStyle = field ? getComputedStyle(field) : null;
        const colorProbe = document.createElement("span");
        colorProbe.style.color = root.getPropertyValue("--epg-ink").trim();
        document.body.appendChild(colorProbe);
        const expectedInk = getComputedStyle(colorProbe).color;
        colorProbe.remove();
        const surfaceProbe = document.createElement("div");
        surfaceProbe.style.backgroundColor = root.getPropertyValue("--epg-surface").trim();
        document.body.appendChild(surfaceProbe);
        const expectedSurface = getComputedStyle(surfaceProbe).backgroundColor;
        surfaceProbe.remove();
        const fieldProbe = document.createElement("div");
        fieldProbe.style.backgroundColor = root.getPropertyValue("--epg-surface-raised").trim();
        document.body.appendChild(fieldProbe);
        const expectedFieldBackground = getComputedStyle(fieldProbe).backgroundColor;
        fieldProbe.remove();
        return {
          backgroundImage: cardStyle.backgroundImage,
          backgroundColor: cardStyle.backgroundColor,
          expectedSurface,
          color: cardStyle.color,
          expectedInk,
          borderColor: cardStyle.borderColor,
          borderRadius: Number.parseFloat(cardStyle.borderRadius),
          fontFamily: cardStyle.fontFamily,
          fieldBackground: fieldStyle?.backgroundColor ?? null,
          expectedFieldBackground,
          fieldBorderColor: fieldStyle?.borderColor ?? null,
          fieldColor: fieldStyle?.color ?? null,
        };
      });

      expect(theme.backgroundImage, "Planner card must not reintroduce competing legacy gradients").toBe("none");
      expect(theme.backgroundColor, "Planner card must use the selected theme surface").toBe(theme.expectedSurface);
      expect(theme.color, "Planner card text must use the selected theme ink").toBe(theme.expectedInk);
      expect(theme.borderRadius, "Planner card must use the parent rounded surface").toBeGreaterThanOrEqual(16);
      expect(theme.fieldBackground, "Planner inputs must use the selected theme raised surface").toBe(theme.expectedFieldBackground);
      expect(theme.fieldColor, "Planner input text must use the selected theme ink").toBe(theme.expectedInk);

      const prompt = page.locator('.eph-audio__prompt[role="dialog"]');
      if (await prompt.isVisible()) {
        const overlay = await page.locator(".eph-audio__backdrop").evaluate(element => {
          const backdropStyle = getComputedStyle(element);
          const promptElement = element.querySelector(".eph-audio__prompt");
          const promptStyle = promptElement ? getComputedStyle(promptElement) : null;
          const rect = element.getBoundingClientRect();
          return {
            backgroundImage: promptStyle?.backgroundImage ?? "",
            backgroundColor: promptStyle?.backgroundColor ?? "",
            foregroundColor: promptStyle?.color ?? "",
            backdropPointerEvents: backdropStyle.pointerEvents,
            promptPointerEvents: promptStyle?.pointerEvents ?? "none",
            coversViewport: rect.left <= 0 && rect.top <= 0 && rect.right >= innerWidth && rect.bottom >= innerHeight,
          };
        });
        expect(overlay.backgroundColor, "Audio consent must use the active theme surface").not.toBe("rgba(0, 0, 0, 0)");
        expect(overlay.foregroundColor, "Audio consent text must remain explicitly themed").not.toBe("");
        expect(overlay.backdropPointerEvents, "Audio consent backdrop must not intercept app interactions").toBe("none");
        expect(overlay.promptPointerEvents, "Audio consent card must remain interactive").toBe("auto");
        expect(overlay.coversViewport, "Audio consent must remain a compact prompt, not a full-screen overlay").toBe(false);
        await prompt.getByRole("button", { name: "No, thanks" }).click();
        await expect(prompt).toBeHidden();
        await expect(page.locator(".eph-audio__backdrop")).toHaveCount(0);
        await expect(page.locator(".ess-builder-card .ess-primary")).toBeVisible();
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


test("EPHINTA planner theme contract screenshots cover all three themes and breakpoints", async ({ page }, testInfo) => {
  const themes = ["light", "dark", "colorful"] as const;
  const report: Array<Record<string, unknown>> = [];
  const observedTokens = new Map<string, Set<string>>(
    ["page", "surface", "ink", "accent"].map(token => [token, new Set<string>()])
  );

  for (const theme of themes) {
    for (const viewport of viewports) {
      await test.step(`${theme} theme at ${viewport.name}`, async () => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto("/plan", { waitUntil: "networkidle" });
        await page.evaluate((selectedTheme) => {
          document.documentElement.dataset.ephintaTheme = selectedTheme;
          document.documentElement.dataset.theme = selectedTheme;
        }, theme);
        await expect(page.locator(".ess-builder-card").first()).toBeVisible();

        const visual = await page.evaluate(() => {
          const root = getComputedStyle(document.documentElement);
          const body = getComputedStyle(document.body);
          return {
            page: root.getPropertyValue("--epg-page").trim(),
            surface: root.getPropertyValue("--epg-surface").trim(),
            ink: root.getPropertyValue("--epg-ink").trim(),
            accent: root.getPropertyValue("--epg-accent").trim(),
            bodyBackground: body.backgroundColor,
            viewportWidth: innerWidth,
            documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
          };
        });

        expect(visual.page, `${theme} page token must be defined`).not.toBe("");
        expect(visual.surface, `${theme} surface token must be defined`).not.toBe("");
        expect(visual.ink, `${theme} ink token must be defined`).not.toBe("");
        expect(visual.accent, `${theme} accent token must be defined`).not.toBe("");
        for (const token of ["page", "surface", "ink", "accent"] as const) {
          observedTokens.get(token)!.add(visual[token]);
        }
        expect(visual.documentWidth, `No horizontal overflow for ${theme} at ${viewport.name}`).toBeLessThanOrEqual(visual.viewportWidth + 1);

        const screenshot = testInfo.outputPath(`planner-${theme}-${viewport.name}.png`);
        await page.screenshot({ path: screenshot, fullPage: true, animations: "disabled" });
        await testInfo.attach(`planner-${theme}-${viewport.name}`, { path: screenshot, contentType: "image/png" });
        report.push({ theme, viewport: viewport.name, ...visual, screenshot: path.basename(screenshot) });
      });
    }
  }

  // Light and colorful intentionally share a neutral white card surface; the
  // page, ink and accent tokens distinguish all three palettes. Surface must
  // still vary between light and dark to prove the active theme is applied.
  for (const token of ["page", "ink", "accent"] as const) {
    expect(observedTokens.get(token)?.size, `The three themes must produce distinct ${token} tokens`).toBe(3);
  }
  expect(observedTokens.get("surface")?.size, "The neutral surface must change between light and dark modes").toBeGreaterThanOrEqual(2);

  fs.mkdirSync(testInfo.outputDir, { recursive: true });
  const reportPath = path.join(testInfo.outputDir, "planner-theme-breakpoint-audit.json");
  fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), themes, viewports, results: report }, null, 2));
  await testInfo.attach("planner-theme-breakpoint-audit", { path: reportPath, contentType: "application/json" });
});
