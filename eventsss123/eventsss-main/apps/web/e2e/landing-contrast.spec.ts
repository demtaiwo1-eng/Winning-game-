import { expect, test } from "@playwright/test";

test("public landing text keeps readable contrast on promotional and pale surfaces", async ({ page }) => {
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator(".eph-promo-heading h2")).toBeVisible();
    await expect(page.locator(".ephinta-marketing-zone h2")).toBeVisible();
    const colors = await page.evaluate(() => {
      const colorOf = (selector: string) => {
        const element = document.querySelector(selector);
        return element ? getComputedStyle(element).color : null;
      };
      const slogan = document.querySelector(".ephinta-bright-slogan");
      return {
        promoHeading: colorOf(".eph-promo-heading h2"),
        marketingHeading: colorOf(".ephinta-marketing-zone h2"),
        sectionHeading: colorOf(".eph-section h2"),
        sloganFill: slogan ? getComputedStyle(slogan).webkitTextFillColor : null,
      };
    });
    expect(colors.promoHeading, `promo heading at ${width}px`).toBe("rgb(255, 255, 255)");
    expect(colors.marketingHeading, `marketing spotlight heading at ${width}px`).toBe("rgb(37, 22, 51)");
    expect(colors.sectionHeading, `section heading at ${width}px`).not.toBe("rgb(255, 255, 255)");
    expect(colors.sloganFill, `section slogan fill at ${width}px`).toBe("rgb(37, 26, 54)");
  }
});
