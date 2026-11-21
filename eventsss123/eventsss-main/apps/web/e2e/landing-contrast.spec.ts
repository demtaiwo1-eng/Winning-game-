import { expect, test } from "@playwright/test";

test("public landing text follows the bright dark/colorful and dark-on-light theme contract", async ({ page }) => {
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator(".eph-promo-heading h2")).toBeVisible();
    await expect(page.locator(".ephinta-marketing-zone h2")).toBeVisible();

    for (const theme of ["dark", "colorful"] as const) {
      await page.locator(".eph-theme-select select").selectOption(theme, { force: true });
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

    await page.locator(".eph-theme-select select").selectOption("light", { force: true });
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


test("marketplace deposit and enquiry dialogs keep readable themed copy and gradient controls", async ({ page }) => {
  await page.goto("/");
  for (const theme of ["light", "dark", "colorful"] as const) {
    await page.locator(".eph-theme-select select").selectOption(theme, { force: true });
    await page.evaluate((selectedTheme) => {
      document.documentElement.dataset.ephintaTheme = selectedTheme;
      document.documentElement.dataset.theme = selectedTheme;
    }, theme);
    const result = await page.evaluate(() => {
      const root = document.createElement("section");
      root.className = "ess-marketplace";
      root.innerHTML = '<form class="ess-modal" role="dialog" aria-modal="true"><h2>Contact a vendor</h2><label>Your message<textarea placeholder="Write your message"></textarea></label><button class="ess-primary">Send enquiry</button></form>';
      document.querySelector("#root")!.append(root);
      const modal = root.querySelector(".ess-modal")!;
      const field = root.querySelector("textarea")!;
      const action = root.querySelector("button")!;
      const styles = {
        modalBackground: getComputedStyle(modal).backgroundImage,
        modalColor: getComputedStyle(modal).color,
        fieldColor: getComputedStyle(field).color,
        fieldBackground: getComputedStyle(field).backgroundColor,
        actionBackground: getComputedStyle(action).backgroundImage,
        actionColor: getComputedStyle(action).color,
      };
      root.remove();
      return styles;
    });
    expect(result.modalBackground, theme).toContain("linear-gradient");
    expect(result.fieldBackground, theme).not.toBe("rgba(0, 0, 0, 0)");
    expect(result.actionBackground, theme).toContain("linear-gradient");
    expect(result.actionColor, theme).toBe("rgb(255, 255, 255)");
    if (theme === "dark") {
      expect(result.modalColor).toBe("rgb(247, 249, 255)");
      expect(result.fieldColor).toBe("rgb(247, 249, 255)");
    } else if (theme === "colorful") {
      expect(result.modalColor).toBe("rgb(255, 248, 255)");
      expect(result.fieldColor).toBe("rgb(255, 248, 255)");
    } else {
      expect(result.modalColor).toBe("rgb(0, 0, 0)");
      expect(result.fieldColor).toBe("rgb(0, 0, 0)");
    }
  }
});


test("shared portal typography inherits one semantic ink contract in every theme", async ({ page }) => {
  await page.goto("/");
  for (const theme of ["light", "dark", "colorful"] as const) {
    await page.locator(".eph-theme-select select").selectOption(theme, { force: true });
    const result = await page.evaluate(() => {
      const root = document.createElement("section");
      root.className = "ess-shell";
      root.innerHTML = '<div class="ess-app"><header class="ess-topbar"><div class="ess-menu-dropdown"><button class="ess-menu-option">Menu item</button></div></header></div><article class="ess-panel"><h2>Workspace heading</h2><p>Ordinary workspace copy</p><p class="ess-muted">Supporting information</p><label>Business name<input value="EPHINTA" /></label><a href="#">View details</a><button class="ess-primary">Continue</button></article>';
      document.querySelector("#root")!.append(root);
      const read = (selector: string) => getComputedStyle(root.querySelector(selector)!).color;
      const tokenProbe = document.createElement("span");
      tokenProbe.style.color = "var(--epg-ink)";
      root.append(tokenProbe);
      const values = {
        token: getComputedStyle(tokenProbe).color,
        heading: read("h2"),
        menuText: read(".ess-menu-dropdown"),
        menuBackground: getComputedStyle(root.querySelector(".ess-menu-dropdown")!).backgroundColor,
        copy: read("article p:not(.ess-muted)"),
        muted: read(".ess-muted"),
        field: read("input"),
        link: read("a"),
        action: read("button"),
      };
      root.remove();
      return values;
    });
    expect(result.heading, theme).toBe(result.token);
    expect(result.menuText, theme).toBe(result.token);
    expect(result.menuBackground, theme).not.toBe("rgba(0, 0, 0, 0)");
    expect(result.copy, theme).toBe(result.token);
    expect(result.field, theme).toBe(result.token);
    expect(result.muted, theme).not.toBe(result.token);
    expect(result.link, theme).not.toBe(result.token);
    expect(result.action, theme).toBe("rgb(255, 255, 255)");
  }
});
