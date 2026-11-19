import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma";
import { settleProviderConfirmedOpayRefund, RefundSettlementError } from "../src/modules/payments/refundSettlement.service";

const run = process.env.RUN_DB_TESTS === "1";
const GROSS = 100_000n;
const FEE = 2_000n;
const NET = GROSS - FEE;
const createdUsers: string[] = [];
const createdIntentIds: string[] = [];
const createdRefundIds: string[] = [];
const createdWalletIds: string[] = [];
const createdLedgerKeys: string[] = [];
const createdRevenueKeys: string[] = [];
const createdRevenueDrainKeys: string[] = [];
const fixtureAccountAdjustments: Array<{ accountId: string; refundId: string; amount: bigint }> = [];

async function makeFixture(tag: string, revenueBalance: bigint) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const email = `refund-settlement-${tag}-${suffix}@test.dev`;
  const user = await prisma.user.create({
    data: {
      email,
      name: `Refund settlement ${tag}`,
      passwordHash: "not-used-in-this-db-test",
      role: "CLIENT",
    },
  });
  createdUsers.push(user.id);

  const intent = await prisma.paymentIntent.create({
    data: {
      userId: user.id,
      provider: "opay",
      providerRef: `refund-source-${suffix}`,
      amountMinor: GROSS,
      currency: "NGN",
      purpose: "WALLET_DEPOSIT",
      status: "SUCCEEDED",
    },
  });
  createdIntentIds.push(intent.id);

  const wallet = await prisma.wallet.create({
    data: { userId: user.id, currency: "NGN", availableMinor: NET, escrowMinor: 0n },
  });
  createdWalletIds.push(wallet.id);

  const sourceKey = `pay_deposit:${intent.id}`;
  const feeKey = `platform_wallet_topup_fee:${intent.id}`;
  createdLedgerKeys.push(sourceKey);
  createdRevenueKeys.push(feeKey);
  await prisma.ledgerEntry.create({
    data: {
      walletId: wallet.id,
      type: "DEPOSIT",
      amountMinor: NET,
      balanceAfterMinor: NET,
      refType: "PAYMENT_INTENT",
      refId: intent.id,
      idempotencyKey: sourceKey,
    },
  });

  const existingAccount = await prisma.platformRevenueAccount.findUnique({
    where: { currency: "NGN" },
  });
  const startingRevenueBalance = existingAccount?.balanceMinor ?? 0n;
  const account = await prisma.platformRevenueAccount.upsert({
    where: { currency: "NGN" },
    update: { balanceMinor: { increment: FEE } },
    create: { currency: "NGN", balanceMinor: FEE },
  });
  await prisma.platformRevenueEntry.create({
    data: {
      accountId: account.id,
      amountMinor: FEE,
      balanceAfterMinor: account.balanceMinor,
      refType: "PAYMENT_INTENT",
      refId: intent.id,
      idempotencyKey: feeKey,
    },
  });

  if (revenueBalance < FEE) {
    const drainKey = `refund-test-revenue-drain:${intent.id}`;
    createdRevenueDrainKeys.push(drainKey);
    await prisma.platformRevenueAccount.update({
      where: { id: account.id },
      data: { balanceMinor: { decrement: FEE - revenueBalance } },
    });
    await prisma.platformRevenueEntry.create({
      data: {
        accountId: account.id,
        amountMinor: -(FEE - revenueBalance),
        balanceAfterMinor: revenueBalance,
        refType: "REFUND_TEST_FIXTURE",
        refId: intent.id,
        idempotencyKey: drainKey,
      },
    });
  }

  const refund = await prisma.paymentRefund.create({
    data: {
      paymentIntentId: intent.id,
      userId: user.id,
      provider: "opay",
      providerRef: `refund-provider-${suffix}`,
      idempotencyKey: `refund-idempotency-${suffix}`,
      amountMinor: GROSS,
      currency: "NGN",
      status: "PROVIDER_SUCCEEDED_PENDING_SETTLEMENT",
      providerStatus: "SUCCESS",
    },
  });
  createdRefundIds.push(refund.id);
  // Read the shared account after any fixture drain. The upsert result above
  // is a stale snapshot when the rollback scenario subtracts the fee.
  const finalAccount = await prisma.platformRevenueAccount.findUniqueOrThrow({
    where: { id: account.id },
  });
  fixtureAccountAdjustments.push({ accountId: account.id, refundId: refund.id, amount: revenueBalance });
  return { user, intent, wallet, account: finalAccount, refund, startingRevenueBalance };
}

async function cleanup() {
  for (const refundId of createdRefundIds) {
    await prisma.ledgerEntry.deleteMany({ where: { idempotencyKey: `payment_refund_wallet_reversal:${refundId}` } });
  }
  await prisma.paymentRefund.deleteMany({ where: { id: { in: createdRefundIds } } });
  await prisma.platformRevenueEntry.deleteMany({ where: { idempotencyKey: { in: [...createdRevenueKeys, ...createdRevenueDrainKeys] } } });
  await prisma.ledgerEntry.deleteMany({ where: { idempotencyKey: { in: createdLedgerKeys } } });
  for (const adjustment of fixtureAccountAdjustments) {
    const reversal = await prisma.platformRevenueEntry.findUnique({
      where: { idempotencyKey: `payment_refund_platform_fee_reversal:${adjustment.refundId}` },
    });
    if (!reversal && adjustment.amount !== 0n) {
      await prisma.platformRevenueAccount.update({
        where: { id: adjustment.accountId },
        data: { balanceMinor: { decrement: adjustment.amount } },
      });
    }
  }
  for (const refundId of createdRefundIds) {
    await prisma.platformRevenueEntry.deleteMany({ where: { idempotencyKey: `payment_refund_platform_fee_reversal:${refundId}` } });
  }
  await prisma.paymentIntent.deleteMany({ where: { id: { in: createdIntentIds } } });
  await prisma.wallet.deleteMany({ where: { id: { in: createdWalletIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
}

afterAll(async () => {
  if (run) await cleanup();
});

describe.skipIf(!run)("OPay refund settlement transaction (DB)", () => {
  it("reverses wallet credit and platform fee exactly once after provider success", async () => {
    const fixture = await makeFixture("success", FEE);
    const result = await settleProviderConfirmedOpayRefund(fixture.refund.id);
    expect(result).toEqual({ settled: true, alreadySettled: false });

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { id: fixture.wallet.id } });
    const account = await prisma.platformRevenueAccount.findUniqueOrThrow({ where: { id: fixture.account.id } });
    const refund = await prisma.paymentRefund.findUniqueOrThrow({ where: { id: fixture.refund.id } });
    expect(wallet.availableMinor).toBe(0n);
    expect(account.balanceMinor).toBe(fixture.startingRevenueBalance);
    expect(refund.status).toBe("SUCCEEDED");
    expect(await prisma.ledgerEntry.findUnique({ where: { idempotencyKey: `payment_refund_wallet_reversal:${fixture.refund.id}` } })).toMatchObject({
      amountMinor: -NET,
      refType: "PAYMENT_REFUND",
      refId: fixture.refund.id,
    });
    expect(await prisma.platformRevenueEntry.findUnique({
      where: { idempotencyKey: `payment_refund_platform_fee_reversal:${fixture.refund.id}` },
    })).toMatchObject({ amountMinor: -FEE, refType: "PAYMENT_REFUND", refId: fixture.refund.id });

    const replay = await settleProviderConfirmedOpayRefund(fixture.refund.id);
    expect(replay).toEqual({ settled: false, alreadySettled: true });
    expect(await prisma.ledgerEntry.count({ where: { idempotencyKey: `payment_refund_wallet_reversal:${fixture.refund.id}` } })).toBe(1);
    expect(await prisma.platformRevenueEntry.count({
      where: { idempotencyKey: `payment_refund_platform_fee_reversal:${fixture.refund.id}` },
    })).toBe(1);
  });

  it("serializes concurrent settlement attempts into one wallet and fee reversal", async () => {
    const fixture = await makeFixture("concurrent", FEE);
    const results = await Promise.all([
      settleProviderConfirmedOpayRefund(fixture.refund.id),
      settleProviderConfirmedOpayRefund(fixture.refund.id),
    ]);

    expect(results.filter((result) => result.settled)).toHaveLength(1);
    expect(results.filter((result) => result.alreadySettled)).toHaveLength(1);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { id: fixture.wallet.id } });
    const account = await prisma.platformRevenueAccount.findUniqueOrThrow({ where: { id: fixture.account.id } });
    const refund = await prisma.paymentRefund.findUniqueOrThrow({ where: { id: fixture.refund.id } });
    expect(wallet.availableMinor).toBe(0n);
    expect(account.balanceMinor).toBe(fixture.startingRevenueBalance);
    expect(refund.status).toBe("SUCCEEDED");
    expect(await prisma.ledgerEntry.count({
      where: { idempotencyKey: `payment_refund_wallet_reversal:${fixture.refund.id}` },
    })).toBe(1);
    expect(await prisma.platformRevenueEntry.count({
      where: { idempotencyKey: `payment_refund_platform_fee_reversal:${fixture.refund.id}` },
    })).toBe(1);
  });

  it("rolls back the wallet reversal when platform fee funds are unavailable", async () => {
    const fixture = await makeFixture("rollback", 0n);
    await expect(settleProviderConfirmedOpayRefund(fixture.refund.id)).rejects.toMatchObject({
      code: "PLATFORM_REVENUE_UNAVAILABLE",
    } satisfies Partial<RefundSettlementError>);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { id: fixture.wallet.id } });
    const account = await prisma.platformRevenueAccount.findUniqueOrThrow({ where: { id: fixture.account.id } });
    const refund = await prisma.paymentRefund.findUniqueOrThrow({ where: { id: fixture.refund.id } });
    expect(wallet.availableMinor).toBe(NET);
    expect(account.balanceMinor).toBe(fixture.startingRevenueBalance);
    expect(refund.status).toBe("PROVIDER_SUCCEEDED_PENDING_SETTLEMENT");
    expect(await prisma.ledgerEntry.findUnique({
      where: { idempotencyKey: `payment_refund_wallet_reversal:${fixture.refund.id}` },
    })).toBeNull();
    expect(await prisma.platformRevenueEntry.findUnique({
      where: { idempotencyKey: `payment_refund_platform_fee_reversal:${fixture.refund.id}` },
    })).toBeNull();
  });
});
