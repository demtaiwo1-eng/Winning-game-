import { expect, test } from "@playwright/test";

test("public landing text keeps readable contrast on promotional and pale surfaces", async ({ page }) => {
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const colors = await page.evaluate(() => {
      const colorOf = (selector: string) => {
        const element = document.querySelector(selector);
        return element ? getComputedStyle(element).color : null;
      };
      return {
        promoHeading: colorOf(".eph-promo-shell h2"),
        plannerHeading: colorOf(".eph-planner h2"),
        sectionHeading: colorOf(".eph-section h2"),
      };
    });
    expect(colors.promoHeading, `promo heading at ${width}px`).toBe("rgb(255, 255, 255)");
    expect(colors.plannerHeading, `planner heading at ${width}px`).not.toBe("rgb(255, 255, 255)");
    expect(colors.sectionHeading, `section heading at ${width}px`).not.toBe("rgb(255, 255, 255)");
  }
});
