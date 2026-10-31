import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { reconcilePendingPayments } from "./modules/payments/payments.routes";

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
      void reconcilePendingPayments()
        .then((result) => logger.info(result, "Pending payment reconciliation completed"))
        .catch((error: unknown) => {
          logger.warn(
            { errorType: error instanceof Error ? error.name : "UnknownError" },
            "Pending payment reconciliation failed",
          );
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
