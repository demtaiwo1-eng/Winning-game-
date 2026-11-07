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

test("registration dialogs remain usable on phone, tablet and desktop", async ({ page }, testInfo) => {
  const registrationRoles = ["CLIENT", "ORGANIZATION", "VENDOR"];
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  for (const viewport of viewports) {
    for (const role of registrationRoles) {
      await test.step(`${role} registration at ${viewport.name}`, async () => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(`/auth/signup?role=${role}`, { waitUntil: "networkidle" });
        const dialog = page.locator(".ess-auth-modal");
        await expect(dialog).toBeVisible();
        await expect(page.locator(".eph-audio__prompt")).toHaveCount(0);

        const metrics = await dialog.evaluate(element => {
          const rect = element.getBoundingClientRect();
          const visibleControls = [...element.querySelectorAll("button,input,select,textarea")]
            .filter(control => {
              const box = control.getBoundingClientRect();
              const style = getComputedStyle(control);
              return box.width > 0 && box.height > 0 && style.visibility !== "hidden" && style.display !== "none";
            }).length;
          const oversizedImages = [...element.querySelectorAll("img")]
            .filter(image => image.getBoundingClientRect().width > element.clientWidth * 0.9)
            .map(image => image.currentSrc || image.src);
          const overflowingChildren = [...element.querySelectorAll("*")]
            .map(child => {
              const childRect = child.getBoundingClientRect();
              return {
                tag: child.tagName.toLowerCase(),
                className: typeof child.className === "string" ? child.className : "",
                left: Math.round(childRect.left),
                right: Math.round(childRect.right),
                width: Math.round(childRect.width),
              };
            })
            .filter(child =>
              child.left < Math.round(rect.left) - 1 ||
              child.right > Math.round(rect.right) + 1
            );
          return {
            left: rect.left,
            right: rect.right,
            width: rect.width,
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            overflowX: getComputedStyle(element).overflowX,
            documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
            visibleControls,
            oversizedImages,
            overflowingChildren,
          };
        });

        expect(metrics.left, `${role} dialog should stay inside the viewport`).toBeGreaterThanOrEqual(-1);
        expect(metrics.right, `${role} dialog should not exceed the viewport`).toBeLessThanOrEqual(viewport.width + 1);
        expect(metrics.documentWidth, `${role} registration should not widen the page`).toBeLessThanOrEqual(viewport.width + 1);
        expect(metrics.overflowingChildren, `${role} visible controls and content should stay inside the dialog`).toEqual([]);
        expect(["clip", "hidden"]).toContain(metrics.overflowX);
        await expect(dialog.getByRole("button", { name: /Back/ })).toBeVisible();
        await expect(dialog.getByRole("button", { name: /Next/ })).toBeVisible();
        expect(metrics.visibleControls, `${role} registration should expose usable controls`).toBeGreaterThan(0);
        expect(metrics.oversizedImages, `${role} registration should not contain an oversized logo/image`).toEqual([]);

        const screenshot = testInfo.outputPath(`registration-${role.toLowerCase()}-${viewport.name}.png`);
        await page.screenshot({ path: screenshot, fullPage: true, animations: "disabled" });
        await testInfo.attach(`registration-${role.toLowerCase()}-${viewport.name}`, { path: screenshot, contentType: "image/png" });
      });
    }
  }

  expect(pageErrors, "Registration dialogs should not produce uncaught browser errors").toEqual([]);
});
