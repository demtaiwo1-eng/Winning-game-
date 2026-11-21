import { expect, test } from "@playwright/test";

test("dashboard text follows each surface and theme without global colour flattening", async ({ page }) => {
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    for (const theme of ["light", "dark", "colorful"] as const) {
      await page.locator(".eph-theme-select select").selectOption(theme, { force: true });
      const result = await page.evaluate(() => {
        const root = document.createElement("section");
        root.className = "ess-app";
        root.innerHTML = `
          <main class="ess-portal-stack">
            <section class="ess-panel">
              <h2>Dashboard overview</h2>
              <p>Upcoming events and account activity</p>
              <small class="ess-muted">Updated just now</small>
              <a href="#overview">View details</a>
              <label>Search listings<input value="Photographer in Ibadan" /></label>
              <button class="ess-primary">Create event</button>
            </section>
          </main>`;
        document.querySelector("#root")!.append(root);
        const panel = root.querySelector(".ess-panel")!;
        const read = (selector: string) => {
          const element = root.querySelector(selector)!;
          const style = getComputedStyle(element);
          return { color: style.color, background: style.backgroundColor, font: style.fontFamily, size: style.fontSize };
        };
        const values = {
          panel: read(".ess-panel"),
          heading: read("h2"),
          copy: read("p"),
          muted: read("small"),
          link: read("a"),
          field: read("input"),
          action: read("button"),
        };
        root.remove();
        return values;
      });

      expect(result.panel.background, `panel surface: ${theme} ${width}px`).not.toBe("rgba(0, 0, 0, 0)");
      expect(result.heading.color, `heading ink: ${theme} ${width}px`).toBe(result.panel.color);
      expect(result.copy.color, `body copy: ${theme} ${width}px`).not.toBe(result.panel.background);
      expect(result.muted.color, `muted copy: ${theme} ${width}px`).not.toBe(result.panel.background);
      expect(result.link.color, `link colour: ${theme} ${width}px`).not.toBe(result.panel.background);
      expect(result.field.color, `field text: ${theme} ${width}px`).toBe(result.panel.color);
      expect(result.action.color, `primary action ink: ${theme} ${width}px`).toBe("rgb(255, 255, 255)");
      expect(result.heading.font).toBe(result.copy.font);
      expect(result.heading.size).not.toBe(result.copy.size);
    }
  }
});
