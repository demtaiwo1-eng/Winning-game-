import { expect, test } from "@playwright/test";

test("public landing text follows the bright dark/colorful and dark-on-light theme contract", async ({ page }) => {
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator(".eph-promo-heading h2")).toBeVisible();
    await expect(page.locator(".ephinta-marketing-zone h2")).toBeVisible();

    for (const theme of ["dark", "colorful"] as const) {
      await page.locator(".eph-theme-select select").selectOption(theme);
      const colors = await page.evaluate(() => {
        const read = (selector: string) => {
          const element = document.querySelector(selector);
          if (!element) return null;
          const style = getComputedStyle(element);
          return { color: style.color, fill: style.webkitTextFillColor, background: style.backgroundColor };
        };
        return {
          promo: read(".eph-promo-heading h2"),
          marketing: read(".ephinta-marketing-zone h2"),
          section: read(".eph-section h2"),
          copy: read(".eph-section-head p"),
        };
      });
      expect(colors.promo?.color, `promo heading in ${theme} at ${width}px`).not.toBe("rgb(37, 22, 51)");
      expect(colors.marketing?.fill, `marketing heading gradient in ${theme} at ${width}px`).toBe("rgba(0, 0, 0, 0)");
      expect(colors.section?.fill, `section heading gradient in ${theme} at ${width}px`).toBe("rgba(0, 0, 0, 0)");
      expect(colors.copy?.color, `section copy in ${theme} at ${width}px`).toBe("rgb(233, 229, 255)");
    }

    await page.locator(".eph-theme-select select").selectOption("light");
    const light = await page.evaluate(() => {
      const heading = document.querySelector(".ephinta-marketing-zone h2");
      const copy = document.querySelector(".eph-section-head p");
      return {
        heading: heading ? getComputedStyle(heading).webkitTextFillColor : null,
        copy: copy ? getComputedStyle(copy).color : null,
      };
    });
    expect(light.heading, `light-mode heading at ${width}px`).toBe("rgb(23, 21, 42)");
    expect(light.copy, `light-mode copy at ${width}px`).toBe("rgb(41, 36, 61)");
  }
});
