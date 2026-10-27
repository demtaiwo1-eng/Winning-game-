from pathlib import Path
import shutil
from datetime import datetime
import sys

p = Path("apps/api/src/modules/payments/payments.routes.ts")
s = p.read_text()

changes = [
    (
        '''        const verification = await verifyFlutterwave(reference);
        assertVerifiedPayment({ ...verification, reference: verification.txRef }, intent, reference);''',
        '''        const transactionId = intent.providerTransactionId;
        if (!transactionId) {
          logger.warn(
            { paymentIntentId: intent.id },
            "Flutterwave reconciliation requires a verified transaction ID from its webhook",
          );
          continue;
        }
        const verification = await verifyFlutterwave(transactionId);
        assertVerifiedPayment({ ...verification, reference: verification.txRef }, intent, reference);''',
    ),
    (
        '''      assertVerifiedPayment({ ...verification, reference: verification.txRef }, intent, providerRef);
    } else {
      const verification = await verifyStripe(transactionId);''',
        '''      assertVerifiedPayment({ ...verification, reference: verification.txRef }, intent, providerRef);
      await prisma.paymentIntent.update({
        where: { id: intent.id },
        data: { providerTransactionId: transactionId },
      });
    } else {
      const verification = await verifyStripe(transactionId);''',
    ),
    (
        '''async function applySuccessfulPayment(intentId: string, providerRef: string) {
  await prisma.$transaction(async (tx) => {''',
        '''async function applySuccessfulPayment(intentId: string, providerRef: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {''',
    ),
    (
        '''    if (claim.count !== 1) {
      // Already processed, or no longer pending.
      return;
    }''',
        '''    if (claim.count !== 1) {
      // Already processed, or no longer pending.
      return false;
    }''',
    ),
    (
        '''      await applySuccessfulPayment(intent.id, reference);
      reconciled += 1;''',
        '''      const settled = await applySuccessfulPayment(intent.id, reference);
      if (settled) reconciled += 1;''',
    ),
]

for old, new in changes:
    if s.count(old) != 1:
        sys.exit("STOP: an expected code block was not found exactly once. No route changes made.")

ending = '''      });
    }
  });
}
export async function reconcilePendingPayments'''

replacement = '''      });
    }
    return true;
  });
}
export async function reconcilePendingPayments'''

if s.count(ending) != 1:
    sys.exit("STOP: expected settlement function ending not found. No route changes made.")

backup = p.with_name(
    p.name + ".pre-flutterwave-route-fix-" +
    datetime.now().strftime("%Y%m%d-%H%M%S") + ".bak"
)
shutil.copy2(p, backup)

for old, new in changes:
    s = s.replace(old, new, 1)

s = s.replace(ending, replacement, 1)
p.write_text(s)

print("Route patch applied.")
print(f"Backup created: {backup}")