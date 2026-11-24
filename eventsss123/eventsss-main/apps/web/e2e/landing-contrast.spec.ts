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
          marketingPanelImage: panelStyle ? panelStyle.backgroundImage : null,
          marketingCopy: copyStyle ? copyStyle.color : null,
          marketingEyebrow: panel?.querySelector(".ephinta-marketing-zone__eyebrow")
            ? getComputedStyle(panel.querySelector(".ephinta-marketing-zone__eyebrow")!).color
            : null,
        };
      });
      expect(colors.promo?.color, `promo heading in ${theme} at ${width}px`).not.toBe("rgb(37, 22, 51)");
      expect(colors.marketing?.fill, `marketing heading gradient in ${theme} at ${width}px`).toBe("rgba(0, 0, 0, 0)");
      expect(colors.section?.fill, `section heading gradient in ${theme} at ${width}px`).toBe("rgba(0, 0, 0, 0)");
      expect(colors.copy?.color, `section copy in ${theme} at ${width}px`).toBe("rgb(233, 229, 255)");
      expect(colors.heroCopy?.color, `hero copy in ${theme} at ${width}px`).not.toBe("rgb(255, 255, 255)");
      expect(colors.marketingCopy, `marketing panel copy in ${theme} at ${width}px`).not.toBe("rgb(255, 255, 255)");
      if (theme === "dark") {
        expect(colors.marketingCopy, `dark marketing copy in ${width}px`).toBe("rgb(197, 180, 220)");
        expect(colors.marketingEyebrow, `dark marketing eyebrow in ${width}px`).toBe("rgb(242, 182, 111)");
      }
      expect(colors.marketingPanelImage, `marketing panel surface in ${theme} at ${width}px`).not.toBe("none");
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
    expect(light.promoHeading, `light-mode promo heading at ${width}px`).toBe("rgb(32, 32, 32)");
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
      } else if (theme === "dark") {
        expect(result.heading.fill, "dark heading " + width).toBe("rgba(0, 0, 0, 0)");
        expect(result.copy.color, "dark mode supporting copy uses muted lavender").toBe("rgb(197, 180, 220)");
        expect(result.capability.color, "dark capability copy " + width).toBe("rgb(220, 231, 250)");
      } else {
        expect(result.heading.fill, "colorful heading " + width).toBe("rgb(36, 20, 58)");
        expect(result.copy.color, "colorful mode body copy " + width).toBe("rgb(73, 52, 95)");
        expect(result.capability.color, "colorful capability copy " + width).toBe("rgb(73, 52, 95)");
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
        expect(result.heading.fill, "colorful workspace heading at " + width).toBe("rgb(36, 20, 58)");
        expect(result.copy.color, "colorful workspace copy at " + width).toBe("rgb(73, 52, 95)");
        expect(result.featureHeading.color, "colorful feature heading at " + width).toBe("rgb(36, 20, 58)");
        expect(result.featureCopy.color, "colorful feature copy at " + width).toBe("rgb(73, 52, 95)");
      } else {
        expect(result.heading.fill, "light workspace heading at " + width).toBe("rgb(33, 22, 60)");
        expect(result.copy.color, "light workspace copy at " + width).toBe("rgb(57, 48, 77)");
        expect(result.featureHeading.color, "light feature heading at " + width).toBe("rgb(33, 22, 60)");
        expect(result.featureCopy.color, "light feature copy at " + width).toBe("rgb(57, 48, 77)");
      }
    }
  }
});


test("public Marketplace campaign and category cards are readable in dark mode", async ({ page }) => {
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.locator(".eph-theme-select select").selectOption("dark", { force: true });
    const result = await page.evaluate(() => {
      const read = (element: Element | null) => {
        if (!element) return null;
        const style = getComputedStyle(element);
        return { color: style.color, fill: style.webkitTextFillColor, background: style.backgroundColor, image: style.backgroundImage };
      };
      const card = document.querySelector(".eph-promotions .eph-ad-card-marketplace");
      return {
        heading: read(document.querySelector(".eph-promotions .eph-promo-heading h2")),
        copy: read(document.querySelector(".eph-promotions .eph-promo-heading p")),
        eyebrow: read(document.querySelector(".eph-promotions .eph-promo-kicker")),
        card: read(card),
        cardTitle: read(card?.querySelector("strong") ?? null),
        cardLabel: read(card?.querySelector("small") ?? null),
        cardCopy: read(card?.querySelector("p") ?? null),
      };
    });
    expect(result.heading?.fill, "Marketplace headline gradient at " + width).toBe("rgba(0, 0, 0, 0)");
    expect(result.copy?.color, "Marketplace supporting copy at " + width).toBe("rgb(197, 180, 220)");
    expect(result.eyebrow?.color, "Marketplace eyebrow at " + width).toBe("rgb(242, 182, 111)");
    expect(result.card?.image, "category card dark surface at " + width).toContain("linear-gradient");
    expect(result.cardTitle?.color, "category title at " + width).toBe("rgb(255, 255, 255)");
    expect(result.cardLabel?.color, "category label at " + width).toBe("rgb(242, 182, 111)");
    expect(result.cardCopy?.color, "category description at " + width).toBe("rgb(197, 180, 220)");
  }
});


test("public Marketplace first block and landing marketing surfaces follow all three themes", async ({ page }) => {
  await page.goto("/");
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["dark", "light", "colorful"] as const) {
      await page.locator(".eph-theme-select select").selectOption(theme, { force: true });
      const result = await page.evaluate(() => {
        const read = (selector: string) => {
          const el = document.querySelector(selector);
          if (!el) return null;
          const style = getComputedStyle(el);
          return { color: style.color, fill: style.webkitTextFillColor, background: style.backgroundColor, image: style.backgroundImage };
        };
        return {
          campaign: read(".eph-promotions .eph-promo-shell.eph-marketplace-advertising"),
          campaignHeading: read(".eph-promotions .eph-promo-heading h2"),
          campaignCopy: read(".eph-promotions .eph-promo-heading p"),
          campaignKicker: read(".eph-promotions .eph-promo-kicker"),
          campaignCard: read(".eph-promotions .eph-ad-card-marketplace"),
          campaignCardCopy: read(".eph-promotions .eph-ad-card-marketplace p"),
          marketingPanel: read(".ephinta-marketing-zone"),
          marketingHeading: read(".ephinta-marketing-zone h2"),
          marketingCopy: read(".ephinta-marketing-zone .ephinta-right-copy-visible"),
        };
      });
      expect(result.campaign?.image, `campaign surface ${theme} ${width}px`).not.toBe("none");
      expect(result.campaignCard?.image !== "none" || result.campaignCard?.background !== "rgba(0, 0, 0, 0)", `campaign card surface ${theme} ${width}px`).toBe(true);
      expect(result.marketingPanel?.image !== "none" || result.marketingPanel?.background !== "rgba(0, 0, 0, 0)", `marketing panel surface ${theme} ${width}px`).toBe(true);
      if (theme === "dark") {
        expect(result.campaignHeading?.fill).toBe("rgba(0, 0, 0, 0)");
        expect(result.campaignCopy?.color).toBe("rgb(197, 180, 220)");
        expect(result.campaignKicker?.color).toBe("rgb(242, 182, 111)");
        expect(result.campaignCardCopy?.color).toBe("rgb(197, 180, 220)");
        expect(result.marketingCopy?.color).toBe("rgb(197, 180, 220)");
      } else if (theme === "light") {
        expect(result.campaignHeading?.fill).toBe("rgb(32, 32, 32)");
        expect(result.campaignCopy?.color).toBe("rgb(32, 32, 32)");
        expect(result.campaignKicker?.color).toBe("rgb(75, 53, 181)");
        expect(result.campaignCardCopy?.color).toBe("rgb(32, 32, 32)");
        expect(result.marketingHeading?.fill).toBe("rgb(23, 21, 42)");
        expect(result.marketingCopy?.color).toBe("rgb(32, 32, 32)");
      } else {
        expect(result.campaignHeading?.fill).toBe("rgb(36, 20, 58)");
        expect(result.campaignCopy?.color).toBe("rgb(73, 52, 95)");
        expect(result.campaignKicker?.color).toBe("rgb(86, 48, 168)");
        expect(result.campaignCardCopy?.color).toBe("rgb(73, 52, 95)");
        expect(result.marketingHeading?.fill).toBe("rgb(36, 20, 58)");
        expect(result.marketingCopy?.color).toBe("rgb(73, 52, 95)");
      }
    }
  }
});

test("shared dashboard panels and dialogs use dark ink in light and multicolor themes", async ({ page }) => {
  await page.goto("/");
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "colorful"] as const) {
      await page.locator(".eph-theme-select select").selectOption(theme, { force: true });
      const result = await page.evaluate(() => {
        const root = document.createElement("div");
        root.className = "ess-app";
        root.innerHTML = '<main class="ess-portal-stack"><section class="ess-panel"><h2>Dashboard overview</h2><p>Manage bookings and activity</p><small class="ess-muted">Updated today</small><label>Search<input value="Vendor" /></label><section class="ess-dialog-surface" role="dialog"><h3>Confirm booking</h3><p>Review your event details</p><textarea>Details</textarea></section></section></main>';
        document.querySelector("#root")!.append(root);
        const read = (selector: string) => {
          const el = root.querySelector(selector)!;
          const style = getComputedStyle(el);
          return { color: style.color, fill: style.webkitTextFillColor, background: style.backgroundColor };
        };
        const values = {
          panel: read(".ess-panel"),
          heading: read(".ess-panel h2"),
          copy: read(".ess-panel > p"),
          field: read(".ess-panel input"),
          dialog: read('[role="dialog"]'),
          dialogHeading: read('[role="dialog"] h3'),
          dialogCopy: read('[role="dialog"] p'),
          dialogField: read('[role="dialog"] textarea'),
        };
        root.remove();
        return values;
      });
      const ink = theme === "light" ? "rgb(0, 0, 0)" : "rgb(36, 20, 58)";
      const muted = theme === "light" ? "rgb(32, 32, 32)" : "rgb(73, 52, 95)";
      expect(result.panel.background, theme).not.toBe("rgba(0, 0, 0, 0)");
      expect(result.heading.color, theme).toBe(ink);
      expect(result.copy.color, theme).toBe(muted);
      expect(result.field.color, theme).toBe(ink);
      expect(result.dialog.background, theme).not.toBe("rgba(0, 0, 0, 0)");
      expect(result.dialogHeading.color, theme).toBe(ink);
      expect(result.dialogCopy.color, theme).toBe(muted);
      expect(result.dialogField.color, theme).toBe(ink);
    }
  }
});


test("shared text links and EPHINTA header wordmarks use the brand gradient in every theme", async ({ page }) => {
  await page.goto("/");
  for (const theme of ["light", "dark", "colorful"] as const) {
    await page.locator(".eph-theme-select select").selectOption(theme, { force: true });
    const result = await page.evaluate(() => {
      const fixture = document.createElement("div");
      fixture.className = "ess-app";
      fixture.innerHTML = '<header class="ess-topbar"><button class="ess-brand"><span class="ess-brand-wordmark"><strong>EPHINTA</strong><small>International event infrastructure</small></span></button></header><a class="gradient-link-fixture" href="#home">Open workspace</a>';
      document.querySelector("#root")!.append(fixture);
      const read = (element: Element | null) => {
        if (!element) return null;
        const style = getComputedStyle(element);
        return { image: style.backgroundImage, clip: style.backgroundClip, webkitClip: style.webkitBackgroundClip, fill: style.webkitTextFillColor };
      };
      const result = {
        publicLogo: read(document.querySelector(".eph-nav .eph-brand > span")),
        workspaceLogo: read(fixture.querySelector(".ess-brand-wordmark strong")),
        link: read(fixture.querySelector(".gradient-link-fixture")),
        taglineColor: getComputedStyle(fixture.querySelector(".ess-brand-wordmark small")!).color,
      };
      fixture.remove();
      return result;
    });
    for (const [label, style] of Object.entries({
      publicLogo: result.publicLogo,
      workspaceLogo: result.workspaceLogo,
      link: result.link,
    })) {
      expect(style?.image, label + " gradient in " + theme).toContain("linear-gradient");
      expect(style?.webkitClip, label + " text clipping in " + theme).toBe("text");
      expect(style?.fill, label + " gradient text fill in " + theme).toBe("rgba(0, 0, 0, 0)");
    }
    expect(result.taglineColor, "tagline remains readable in " + theme).not.toBe("rgba(0, 0, 0, 0)");
  }
});
