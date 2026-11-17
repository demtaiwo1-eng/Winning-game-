export const MUSIC_RIGHTS_OWNER_SHARE_BPS = 3000;

export type MusicRoyaltyAllocation = {
  ownerId: string;
  listenedSeconds: number;
  royaltyMinor: bigint;
};

/**
 * Allocate exactly 30% of net DSP revenue by eligible listening seconds.
 * Largest-remainder rounding keeps the sum of owner allocations equal to the
 * royalty pool without creating or losing minor currency units.
 */
export function allocateMusicRoyalties(
  netRevenueMinor: bigint,
  secondsByOwner: ReadonlyMap<string, number>,
): MusicRoyaltyAllocation[] {
  if (netRevenueMinor < 0n) throw new Error("Net DSP revenue cannot be negative.");
  const usage = [...secondsByOwner.entries()]
    .filter(([ownerId, seconds]) => ownerId.length > 0 && Number.isSafeInteger(seconds) && seconds > 0)
    .sort(([a], [b]) => a.localeCompare(b));
  const totalSeconds = usage.reduce((sum, [, seconds]) => sum + BigInt(seconds), 0n);
  if (netRevenueMinor === 0n || totalSeconds === 0n) return [];

  const pool = netRevenueMinor * BigInt(MUSIC_RIGHTS_OWNER_SHARE_BPS) / 10000n;
  const rows = usage.map(([ownerId, seconds]) => {
    const numerator = pool * BigInt(seconds);
    return { ownerId, listenedSeconds: seconds, royaltyMinor: numerator / totalSeconds, remainder: numerator % totalSeconds };
  });
  const allocated = rows.reduce((sum, row) => sum + row.royaltyMinor, 0n);
  let remaining = pool - allocated;
  const byRemainder = [...rows].sort((a, b) =>
    a.remainder === b.remainder ? a.ownerId.localeCompare(b.ownerId) : a.remainder > b.remainder ? -1 : 1
  );
  for (const row of byRemainder) {
    if (remaining <= 0n) break;
    row.royaltyMinor += 1n;
    remaining -= 1n;
  }
  return rows.map(({ ownerId, listenedSeconds, royaltyMinor }) => ({ ownerId, listenedSeconds, royaltyMinor }));
}
