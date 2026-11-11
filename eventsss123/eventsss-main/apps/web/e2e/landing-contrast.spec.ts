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
        marketingHeading: colorOf(".ephinta-marketing-zone h2"),
        sloganFill: (() => {
          const element = document.querySelector(".ephinta-bright-slogan");
          return element ? getComputedStyle(element).webkitTextFillColor : null;
        })(),
      };
    });
    expect(colors.promoHeading, `promo heading at ${width}px`).toBe("rgb(255, 255, 255)");
    expect(colors.plannerHeading, `planner heading at ${width}px`).not.toBe("rgb(255, 255, 255)");
    expect(colors.sectionHeading, `section heading at ${width}px`).not.toBe("rgb(255, 255, 255)");
    expect(colors.marketingHeading, `marketing spotlight heading at ${width}px`).toBe("rgb(37, 22, 51)");
    expect(colors.sloganFill, `section slogan fill at ${width}px`).toBe("rgb(37, 26, 54)");
  }
});
