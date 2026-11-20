import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contract = readFileSync(new URL("./ephinta-global-theme-contract.css", import.meta.url), "utf8");
const globalCss = readFileSync(new URL("./ephinta-global.css", import.meta.url), "utf8");
const themeRuntime = readFileSync(new URL("../lib/ephintaTheme.ts", import.meta.url), "utf8");
const runtimeCss = readFileSync(new URL("./ephinta-runtime-contrast.css", import.meta.url), "utf8");
const appEntry = readFileSync(new URL("../main.tsx", import.meta.url), "utf8");

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
    expect(appEntry.indexOf("initializeEphintaTheme();")).toBeLessThan(appEntry.indexOf("ReactDOM.createRoot"));
  });

  it("lets component text retain semantic colours while shared controls use theme tokens", () => {
    expect(runtimeCss).toContain("Text inherits from its component");
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
});
