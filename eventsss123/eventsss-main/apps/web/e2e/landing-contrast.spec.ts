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
        const panel = document.querySelector(".ephinta-marketing-zone");
        const copy = panel?.querySelector(".ephinta-right-copy-visible");
        const panelStyle = panel ? getComputedStyle(panel) : null;
        const copyStyle = copy ? getComputedStyle(copy) : null;
        return {
          promo: read(".eph-promo-heading h2"),
          marketing: read(".ephinta-marketing-zone h2"),
          section: read(".eph-section h2"),
          copy: read(".eph-section-head p"),
          heroCopy: read(".eph-subtitle"),
          marketingPanel: panelStyle ? panelStyle.backgroundColor : null,
          marketingCopy: copyStyle ? copyStyle.color : null,
        };
      });
      expect(colors.promo?.color, `promo heading in ${theme} at ${width}px`).not.toBe("rgb(37, 22, 51)");
      expect(colors.marketing?.fill, `marketing heading gradient in ${theme} at ${width}px`).toBe("rgba(0, 0, 0, 0)");
      expect(colors.section?.fill, `section heading gradient in ${theme} at ${width}px`).toBe("rgba(0, 0, 0, 0)");
      expect(colors.copy?.color, `section copy in ${theme} at ${width}px`).toBe("rgb(233, 229, 255)");
      expect(colors.heroCopy?.color, `hero copy in ${theme} at ${width}px`).not.toBe("rgb(255, 255, 255)");
      expect(colors.marketingCopy, `marketing panel copy in ${theme} at ${width}px`).not.toBe("rgb(255, 255, 255)");
      expect(colors.marketingPanel, `marketing panel surface in ${theme} at ${width}px`).not.toBe("rgba(0, 0, 0, 0)");
    }

    await page.locator(".eph-theme-select select").selectOption("light", { force: true });
    const light = await page.evaluate(() => {
      const heading = document.querySelector(".ephinta-marketing-zone h2");
      const copy = document.querySelector(".eph-section-head p");
      const promoHeading = document.querySelector(".eph-promo-heading h2");
      const marketingCopy = document.querySelector(".ephinta-marketing-zone .ephinta-right-copy-visible");
      return {
        heading: heading ? getComputedStyle(heading).webkitTextFillColor : null,
        copy: copy ? getComputedStyle(copy).color : null,
        promoHeading: promoHeading ? getComputedStyle(promoHeading).color : null,
        marketingCopy: marketingCopy ? getComputedStyle(marketingCopy).color : null,
      };
    });
    expect(light.heading, `light-mode heading at ${width}px`).toBe("rgb(23, 21, 42)");
    expect(light.copy, `light-mode copy at ${width}px`).toBe("rgb(41, 36, 61)");
    expect(light.promoHeading, `light-mode promo heading at ${width}px`).toBe("rgb(255, 255, 255)");
    expect(light.marketingCopy, `light-mode marketing copy at ${width}px`).not.toBe("rgb(255, 255, 255)");
  }
});


test("marketplace deposit and enquiry dialogs keep readable themed copy and gradient controls", async ({ page }) => {
  await page.goto("/");
  for (const theme of ["light", "dark", "colorful"] as const) {
    await page.locator(".eph-theme-select select").selectOption(theme, { force: true });
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
      expect(result.modalColor).toBe("rgb(36, 20, 58)");
      expect(result.fieldColor).toBe("rgb(36, 20, 58)");
    } else {
      expect(result.modalColor).toBe("rgb(0, 0, 0)");
      expect(result.fieldColor).toBe("rgb(0, 0, 0)");
    }
  }
});


test("marketplace inner marketing copy follows the global theme at desktop and mobile widths", async ({ page }) => {
  await page.goto("/");
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["dark", "colorful", "light"] as const) {
      await page.locator(".eph-theme-select select").selectOption(theme, { force: true });
      const result = await page.evaluate(() => {
        const root = document.createElement("div");
        root.className = "ess-app";
        root.innerHTML = '<main class="ess-portal-stack"><section class="ess-panel ess-marketplace"><section class="ess-marketplace-welcome"><div class="ess-marketplace-welcome-copy"><p class="ess-eyebrow">Your event</p><h1>Welcome to your event marketplace.</h1><p>Discover trusted event professionals and keep bookings connected.</p></div></section><section class="ess-marketplace-capabilities"><article class="ess-marketplace-capability"><h3>Plan with confidence</h3><p>Build your event brief and organise tasks.</p></article></section></section></main>';
        document.querySelector("#root")!.append(root);
        const read = (selector: string) => {
          const el = root.querySelector(selector)!;
          const style = getComputedStyle(el);
          return { color: style.color, fill: style.webkitTextFillColor };
        };
        const styles = {
          heading: read(".ess-marketplace-welcome-copy h1"),
          copy: read(".ess-marketplace-welcome-copy > p:not(.ess-eyebrow)"),
          capability: read(".ess-marketplace-capability p")
        };
        root.remove();
        return styles;
      });
      if (theme === "light") {
        expect(result.heading.fill, "light heading " + width).toBe("rgb(33, 22, 60)");
        expect(result.copy.color, "light body copy " + width).toBe("rgb(57, 48, 77)");
      } else {
        expect(result.heading.fill, theme + " heading " + width).toBe("rgba(0, 0, 0, 0)");
        if (theme === "dark") {
          expect(result.copy.color, "dark mode must not use white marketing copy").not.toBe("rgb(255, 255, 255)");
          expect(result.copy.color, "dark mode supporting copy uses muted lavender").toBe("rgb(197, 180, 220)");
        } else {
          expect(result.copy.color, "colorful mode body copy " + width).toBe("rgb(231, 237, 255)");
        }
        expect(result.capability.color, theme + " capability copy " + width).toBe("rgb(220, 231, 250)");
      }
    }
  }
});


test("workspace overview welcome copy receives theme colors without a Marketplace parent wrapper", async ({ page }) => {
  await page.goto("/");
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["dark", "colorful", "light"] as const) {
      await page.locator(".eph-theme-select select").selectOption(theme, { force: true });
      const result = await page.evaluate(() => {
        const root = document.createElement("div");
        root.className = "ess-app";
        // Mirrors EnterpriseApp.tsx: the welcome panel is a direct workspace
        // overview child, not nested inside .ess-marketplace.
        root.innerHTML = '<section class="ess-marketplace-welcome"><div class="ess-marketplace-welcome-copy"><p class="ess-eyebrow">Your event journey starts here</p><h2>Welcome to your event marketplace.</h2><p>Plan your event, find trusted professionals, manage bookings and keep every important detail in one place.</p></div><div class="ess-marketplace-welcome-grid"><article><h3>Plan with confidence</h3><p>Turn your ideas into a clear event brief, timeline and checklist.</p></article></div></section>';
        document.querySelector("#root")!.append(root);
        const read = (selector: string) => {
          const element = root.querySelector(selector)!;
          const style = getComputedStyle(element);
          return { color: style.color, fill: style.webkitTextFillColor };
        };
        const result = {
          heading: read(".ess-marketplace-welcome-copy h2"),
          copy: read(".ess-marketplace-welcome-copy > p:not(.ess-eyebrow)"),
          eyebrow: read(".ess-marketplace-welcome-copy .ess-eyebrow"),
          featureHeading: read(".ess-marketplace-welcome-grid article h3"),
          featureCopy: read(".ess-marketplace-welcome-grid article p")
        };
        root.remove();
        return result;
      });
      if (theme === "dark") {
        expect(result.heading.fill, "dark workspace heading at " + width).toBe("rgba(0, 0, 0, 0)");
        expect(result.copy.color, "dark workspace copy at " + width).toBe("rgb(197, 180, 220)");
        expect(result.eyebrow.color, "dark workspace eyebrow at " + width).toBe("rgb(242, 182, 111)");
        expect(result.featureHeading.color, "dark feature heading at " + width).toBe("rgb(248, 250, 255)");
        expect(result.featureCopy.color, "dark feature copy at " + width).toBe("rgb(197, 180, 220)");
      } else if (theme === "colorful") {
        expect(result.heading.fill, "colorful workspace heading at " + width).toBe("rgba(0, 0, 0, 0)");
        expect(result.copy.color, "colorful workspace copy at " + width).toBe("rgb(231, 237, 255)");
        expect(result.featureHeading.color, "colorful feature heading at " + width).toBe("rgb(248, 250, 255)");
        expect(result.featureCopy.color, "colorful feature copy at " + width).toBe("rgb(231, 237, 255)");
      } else {
        expect(result.heading.fill, "light workspace heading at " + width).toBe("rgb(33, 22, 60)");
        expect(result.copy.color, "light workspace copy at " + width).toBe("rgb(57, 48, 77)");
        expect(result.featureHeading.color, "light feature heading at " + width).toBe("rgb(33, 22, 60)");
        expect(result.featureCopy.color, "light feature copy at " + width).toBe("rgb(57, 48, 77)");
      }
    }
  }
});
