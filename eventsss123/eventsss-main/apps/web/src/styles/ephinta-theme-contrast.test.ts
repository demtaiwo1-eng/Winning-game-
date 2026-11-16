import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contract = readFileSync(new URL("./ephinta-global-theme-contract.css", import.meta.url), "utf8");
const globalCss = readFileSync(new URL("./ephinta-global.css", import.meta.url), "utf8");

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
    const block = contract.match(new RegExp(`html\\[data-ephinta-theme="${mode}"\\][\\s\\S]*?\\n}`))?.[0];
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

  it("keeps the final override after legacy component rules", () => {
    const marker = "FINAL GLOBAL CONTRAST ENFORCEMENT";
    expect(globalCss).toContain(marker);
    expect(globalCss.lastIndexOf(marker)).toBeGreaterThan(globalCss.indexOf("@import"));
    expect(globalCss.trimEnd().endsWith("}")).toBe(true);
  });
});
