import { describe, expect, it } from "vitest";
import { allocateMusicRoyalties, MUSIC_RIGHTS_OWNER_SHARE_BPS } from "./royaltyPolicy";

describe("music DSP royalty policy", () => {
  it("allocates exactly 30% of net revenue by listening seconds", () => {
    const rows = allocateMusicRoyalties(10000n, new Map([["owner-a", 75], ["owner-b", 25]]));
    expect(MUSIC_RIGHTS_OWNER_SHARE_BPS).toBe(2500);
    expect(rows.map((r) => r.royaltyMinor)).toEqual([1875n, 625n]);
    expect(rows.reduce((sum, row) => sum + row.royaltyMinor, 0n)).toBe(2500n);
  });

  it("distributes rounding remainders deterministically without losing minor units", () => {
    const rows = allocateMusicRoyalties(1004n, new Map([["owner-b", 1], ["owner-a", 1]]));
    expect(rows.map((r) => [r.ownerId, r.royaltyMinor])).toEqual([["owner-a", 126n], ["owner-b", 125n]]);
    expect(rows.reduce((sum, row) => sum + row.royaltyMinor, 0n)).toBe(251n);
  });

  it("returns no allocations when there is no eligible listening", () => {
    expect(allocateMusicRoyalties(10000n, new Map())).toEqual([]);
  });

  it("does not allocate a negative or zero amount", () => {
    expect(allocateMusicRoyalties(3n, new Map([["owner-a", 100]])).reduce((sum, row) => sum + row.royaltyMinor, 0n)).toBe(0n);
    expect(() => allocateMusicRoyalties(-1n, new Map([["owner-a", 1]]))).toThrow("cannot be negative");
  });
});
