import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { ensureReferenceData } from "./lib/reference-data";
import { reconcilePendingPayments } from "./modules/payments/payments.routes";
import { reconcilePendingPayouts } from "./modules/payments/payouts.routes";

async function startServer() {
  await prisma.$connect();
  await ensureReferenceData(prisma);
  logger.info("EPHINTA reference categories and plans are ready");

  const server = createApp().listen(env.PORT, () => logger.info(`ESS API listening on :${env.PORT}`));
  let reconciliationInProgress = false;
  const reconciliationTimer = env.NODE_ENV === "test"
    ? undefined
    : setInterval(() => {
        if (reconciliationInProgress) {
          logger.warn("Skipping payment reconciliation tick because the previous run is still active");
          return;
        }
        reconciliationInProgress = true;
        void Promise.allSettled([reconcilePendingPayments(), reconcilePendingPayouts()])
          .then(([payments, payouts]) => {
            if (payments.status === "fulfilled" && payouts.status === "fulfilled") {
              logger.info({ payments: payments.value, payouts: payouts.value }, "Payment and OPay payout reconciliation completed");
            } else {
              logger.warn({
                payments: payments.status,
                payouts: payouts.status,
                paymentError: payments.status === "rejected" ? (payments.reason instanceof Error ? payments.reason.name : "UnknownError") : undefined,
                payoutError: payouts.status === "rejected" ? (payouts.reason instanceof Error ? payouts.reason.name : "UnknownError") : undefined,
              }, "Payment and OPay payout reconciliation completed with errors");
            }
          })
          .finally(() => {
            reconciliationInProgress = false;
          });
      }, 60_000);
  reconciliationTimer?.unref();

  const shutdown = async () => {
    if (reconciliationTimer) clearInterval(reconciliationTimer);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

void startServer().catch(async (error: unknown) => {
  logger.error(
    { errorType: error instanceof Error ? error.name : "UnknownError" },
    "EPHINTA API startup failed",
  );
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
