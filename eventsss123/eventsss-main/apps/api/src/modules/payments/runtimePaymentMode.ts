import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../lib/errors";

export const PAYMENT_MODES = ["demo", "test", "live"] as const;
export type PaymentMode = typeof PAYMENT_MODES[number];

let activeMode: PaymentMode = "test";

/** Refresh from the shared database on every payment API request.
 * If the database cannot confirm the setting, payment operations fail closed.
 */
export async function refreshPaymentMode(): Promise<PaymentMode> {
  const setting = await prisma.platformRuntimeSetting.findUnique({
    where: { id: "global" },
    select: { paymentMode: true },
  });
  const mode = setting?.paymentMode;
  if (!PAYMENT_MODES.includes(mode as PaymentMode)) {
    throw new Error("The central payment mode is missing or invalid");
  }
  activeMode = mode as PaymentMode;
  return activeMode;
}

export function getRuntimePaymentMode(): PaymentMode {
  return activeMode;
}

export async function paymentModeGuard(_req: Request, res: Response, next: NextFunction) {
  try {
    await refreshPaymentMode();
    res.setHeader("Cache-Control", "no-store");
    next();
  } catch {
    next(new HttpError(503, "PAYMENT_MODE_UNAVAILABLE", "EPHINTA cannot verify its central payment mode. Payment and payout operations are temporarily paused."));
  }
}
