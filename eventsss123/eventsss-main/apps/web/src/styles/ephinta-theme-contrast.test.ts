import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contract = readFileSync(new URL("./ephinta-global-theme-contract.css", import.meta.url), "utf8");
const globalCss = readFileSync(new URL("./ephinta-global.css", import.meta.url), "utf8");
const themeRuntime = readFileSync(new URL("../lib/ephintaTheme.ts", import.meta.url), "utf8");
const runtimeCss = readFileSync(new URL("./ephinta-runtime-contrast.css", import.meta.url), "utf8");
const appEntry = readFileSync(new URL("../main.tsx", import.meta.url), "utf8");
const enterpriseApp = readFileSync(new URL("../EnterpriseApp.tsx", import.meta.url), "utf8");
const pwaManifest = JSON.parse(readFileSync(new URL("../../public/manifest.webmanifest", import.meta.url), "utf8")) as { name: string; short_name: string; icons: Array<{ src: string; type: string }> };
const pwaIcon = readFileSync(new URL("../../public/icons/ess-icon.svg", import.meta.url), "utf8");

function token(block: string, name: string): string {
  const value = block.match(new RegExp(`--epg-${name}:\\s*(#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?)\\b`))?.[1];
  if (!value) throw new Error(`Missing --epg-${name} in theme block`);
  return value;
}

function luminance(hex: string): number {
  const normalized = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  const channels = [1, 3, 5].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const modes = ["light", "dark", "colorful"] as const;

describe("EPHINTA global theme contrast", () => {
  it.each(modes)("keeps text, muted text, links and primary buttons readable in %s mode", (mode) => {
    const blocks = [...contract.matchAll(new RegExp(`html\\[data-ephinta-theme="${mode}"\\][\\s\\S]*?\\n}`, "g"))];
    const block = blocks[blocks.length - 1]?.[0];
    expect(block, `missing ${mode} theme token block`).toBeTruthy();
    const ink = token(block!, "ink");
    const muted = token(block!, "muted");
    const subtle = token(block!, "subtle");
    const surface = token(block!, "surface");
    const page = token(block!, "page");
    const accent = token(block!, "accent");
    const accentInk = token(block!, "accent-ink");
    const link = token(block!, "link");

    expect(contrast(ink, page)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(ink, surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(muted, page)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(muted, surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(subtle, surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(link, surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(accentInk, accent)).toBeGreaterThanOrEqual(4.5);
    if (mode === "light") {
      expect(ink).toBe("#000000");
      expect(muted).toBe("#202020");
      expect(subtle).toBe("#333333");
    }
    if (mode === "dark") {
      expect(luminance(ink)).toBeGreaterThan(0.75);
      expect(luminance(muted)).toBeGreaterThan(0.65);
      expect(luminance(page)).toBeLessThan(0.08);
      expect(luminance(surface)).toBeLessThan(0.12);
    } else {
      expect(luminance(ink)).toBeLessThan(0.25);
      expect(luminance(muted)).toBeLessThan(0.35);
      expect(luminance(page)).toBeGreaterThan(0.85);
      expect(luminance(surface)).toBeGreaterThan(0.9);
    }
  });

  it("maps legacy tokens without flattening intentionally colourful component surfaces", () => {
    expect(contract).toContain("--ephinta-theme-page:var(--epg-page)");
    expect(contract).toContain("--ess-surface:var(--epg-surface)");
    expect(contract).toContain("Feature components own their surfaces");
    expect(contract).not.toContain("background-image:none !important");
    expect(contract).toContain("html[data-ephinta-theme=\"colorful\"],html[data-theme=\"colorful\"]");
  });

  it("initializes the saved theme before rendering authenticated routes", () => {
    expect(appEntry).toContain("import { initializeEphintaTheme } from './lib/ephintaTheme'");
    expect(appEntry).toContain("initializeEphintaTheme();");
    expect(appEntry).toContain("import './styles/ephinta-global.css';");
    expect(globalCss).toContain("ephinta-runtime-contrast.css");
    expect(appEntry.indexOf("initializeEphintaTheme();")).toBeLessThan(appEntry.indexOf("ReactDOM.createRoot"));
  });

  it("lets component text retain semantic colours while shared controls use theme tokens", () => {
    expect(runtimeCss).toContain("Text inherits from its component");
    expect(runtimeCss).toContain("Final readable type system");
    expect(runtimeCss).toContain('html[data-ephinta-theme="colorful"] body #root :where(h1,h2,h3,h4,h5,h6)');
    expect(runtimeCss).toContain("-webkit-text-fill-color: currentColor");
    expect(runtimeCss).toContain("color: #24143a !important");
    expect(runtimeCss).toContain('html[data-ephinta-theme="light"] body #root');
    expect(runtimeCss).toContain("--ephinta-link-fg");
    expect(runtimeCss).toContain("--ephinta-field-bg");
    expect(runtimeCss).not.toContain("html[data-ephinta-theme] body #root :is(h1,h2,h3,h4,h5,h6");
    expect(runtimeCss).not.toContain("button *");
    expect(runtimeCss).not.toContain(".status-pill *");
  });

  it("keeps native controls aligned with the selected colorful palette", () => {
    expect(themeRuntime).toContain('document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light"');
  });

  it("does not reintroduce a second blanket contrast layer after the shared theme contract", () => {
    expect(globalCss).toContain('@import "./ephinta-global-theme-contract.css";');
    expect(globalCss).toContain('@import "./ephinta-runtime-contrast.css";');
    expect(globalCss).not.toContain("FINAL GLOBAL CONTRAST ENFORCEMENT");
    expect(globalCss).not.toContain("Specificity guard: component sheets");
    expect(globalCss).not.toContain("ephinta-theme-text-contrast.css");
    expect(globalCss).not.toContain("ephinta-accessible-contrast.css");
    expect(globalCss.trimEnd().endsWith("}")).toBe(true);
  });
  it("uses EPHINTA branding for mobile installation and keeps its icon assets consistent", () => {
    expect(pwaManifest.name).toBe("EPHINTA");
    expect(pwaManifest.short_name).toBe("EPHINTA");
    expect(pwaManifest.icons).toEqual([{ src: "/icons/ess-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }]);
    expect(pwaIcon).toContain("<title>EPHINTA</title>");
    expect(pwaIcon).toContain(">EPHINTA</text>");
    expect(pwaIcon).not.toContain(">ESS</text>");
    expect(enterpriseApp).toContain('src="/brand/ephinta_logo2.png"');
    expect(enterpriseApp).toContain('className="ess-brand-wordmark"');
    expect(enterpriseApp).not.toContain('className="ess-brand-mark"');
  });

  it("enforces readable text and a visible EPHINTA wordmark throughout all themes", () => {
    expect(runtimeCss).toContain("FINAL EPHINTA TEXT VISIBILITY CONTRACT");
    expect(runtimeCss).toContain("--ephinta-readable-text: #17152b");
    expect(runtimeCss).toContain("--ephinta-readable-text: #f7f9ff");
    expect(runtimeCss).toContain('[class*="landing"]');
    expect(runtimeCss).toContain(".ess-brand-wordmark strong");
    expect(runtimeCss).toContain("-webkit-text-fill-color: var(--epg-ink) !important");
    expect(runtimeCss).toContain('html[data-ephinta-theme="dark"] .ess-app .ess-menu-dropdown');
  });

  it("uses light readable surfaces for the multicolour and light account menus", () => {
    expect(runtimeCss).toContain('html[data-ephinta-theme="colorful"] .ess-app .ess-menu-dropdown');
    expect(runtimeCss).toContain('html[data-ephinta-theme="light"] .ess-app .ess-menu-dropdown');
    expect(runtimeCss).toContain('background: #ffffff !important');
    expect(runtimeCss).toContain('html[data-ephinta-theme="colorful"] .ess-app .ess-topbar');
  });


  it("routes public landing navigation, footer and auth dialogs through the global theme tokens", () => {
    for (const selector of [".eph-nav", ".eph-nav .eph-links", ".eph-footer", ".eph-footer-copyright", ".eph-modal-backdrop", ".eph-modal"]) {
      expect(runtimeCss).toContain(selector);
    }
    expect(runtimeCss).toContain("background: var(--epg-surface) !important");
    expect(runtimeCss).toContain("color: var(--epg-ink) !important");
    expect(runtimeCss).toContain("color: var(--epg-muted) !important");
    expect(runtimeCss).toContain("var(--epg-border)");
    expect(runtimeCss).toContain("var(--epg-focus)");
    expect(globalCss).toContain('@import "./ephinta-runtime-contrast.css";');
  });

  it("routes the landing vendor CTA to the shared vendor registration dialog", () => {
    expect(enterpriseApp).toContain("onOpenAuth={(mode, role) => {");
    expect(enterpriseApp).toContain("openAuth(role, mode);");
    expect(enterpriseApp).not.toContain("startRoleQuestionnaire");
  });

  it("centralizes auth, PIN and semantic dialog presentation in the final runtime layer", () => {
    for (const selector of [
      ".eph-modal-backdrop",
      ".ess-auth-backdrop",
      ".ess-auth-modal",
      ".eph-modal",
      ".ess-device-lock",
      ".ess-device-lock-card",
      ".ess-dialog-overlay",
      ".ess-dialog-surface",
      ".eph-audio__prompt",
      '[role="dialog"][aria-modal="true"]',
    ]) {
      expect(runtimeCss).toContain(selector);
    }
    expect(runtimeCss).toContain("EPHINTA CENTRAL DIALOG SYSTEM");
    expect(runtimeCss).toContain("var(--epg-surface)");
    expect(runtimeCss).toContain("var(--epg-ink)");
    expect(runtimeCss).toContain("var(--epg-border)");
    expect(runtimeCss).toContain("env(safe-area-inset-top)");
    expect(runtimeCss).toContain("max-height: calc(100dvh");
    expect(globalCss).toContain('@import "./ephinta-runtime-contrast.css";');
  });

  it("keeps dialogs compact and centered on desktop instead of stretching across the screen", () => {
    expect(runtimeCss).toContain("Desktop dialogs deliberately keep the compact");
    expect(runtimeCss).toContain("width: min(92vw, 420px) !important;");
    expect(runtimeCss).toContain("max-width: 420px !important;");
    expect(runtimeCss).toContain("margin: auto !important;");
  });

});
