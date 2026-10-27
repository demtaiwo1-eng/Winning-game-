// All money is BigInt minor units. Never use floats for money.

export function commissionMinor(amount: bigint, bps: number): bigint {
  if (amount < 0n) throw new RangeError("amount must be >= 0");
  if (!Number.isInteger(bps) || bps < 0 || bps > 10000) throw new RangeError("invalid bps");
  return (amount * BigInt(bps) + 5000n) / 10000n; // round half up
}

export function splitPayment(amount: bigint, bps: number) {
  const fee = commissionMinor(amount, bps);
  return { fee, vendorNet: amount - fee };
}

export function toMinor(major: string): bigint {
  if (!/^\d+(\.\d{1,2})?$/.test(major)) throw new RangeError("invalid amount");
  const [whole, frac = ""] = major.split(".");
  return BigInt(whole! + frac.padEnd(2, "0"));
}
