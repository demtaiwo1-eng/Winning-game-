import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { reconcilePendingPayments } from "./modules/payments/payments.routes";

const server = createApp().listen(env.PORT, () => logger.info(`ESS API listening on :${env.PORT}`));

const reconciliationTimer = env.NODE_ENV === "test"
  ? undefined
  : setInterval(() => {
      void reconcilePendingPayments().catch(() => {
        logger.warn("Pending payment reconciliation failed");
      });
    }, 10 * 60_000);
reconciliationTimer?.unref();

const shutdown = async () => {
  if (reconciliationTimer) clearInterval(reconciliationTimer);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
