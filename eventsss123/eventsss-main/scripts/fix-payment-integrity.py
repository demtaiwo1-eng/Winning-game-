from pathlib import Path
from datetime import datetime
import shutil
import sys

path = Path("apps/api/src/modules/payments/payments.routes.ts")
source = path.read_text()

# Refuse to patch an unexpected version of the source.
required = [
    'const amountMinor = BigInt(String(req.body.amountMinor || "0"));',
    'purpose: String(req.body.purpose || "WALLET_DEPOSIT"),',
    'intent.purpose.startsWith("WALLET")',
    'const intent = await tx.paymentIntent.findUniqueOrThrow({\n      where: { id: intentId },\n    });',
]
for item in required:
    if item not in source:
        sys.exit(f"STOP: expected source pattern not found: {item!r}\nNo changes made.")

backup = path.with_suffix(
    path.suffix + "." + datetime.now().strftime("%Y%m%d-%H%M%S") + ".bak"
)
shutil.copy2(path, backup)

# Validate amount input before converting it to BigInt or calling a provider.
source = source.replace(
    'const amountMinor = BigInt(String(req.body.amountMinor || "0"));\n'
    '    if (amountMinor <= 0n) throw new HttpError(400, "INVALID_AMOUNT", "amountMinor must be > 0");',
    'const amountRaw = String(req.body.amountMinor ?? "");\n'
    '    if (!/^[1-9]\\d*$/.test(amountRaw)) {\n'
    '      throw new HttpError(400, "INVALID_AMOUNT", "amountMinor must be a positive whole number");\n'
    '    }\n'
    '    const amountMinor = BigInt(amountRaw);\n'
    '    if (amountMinor > BigInt(Number.MAX_SAFE_INTEGER)) {\n'
    '      throw new HttpError(400, "INVALID_AMOUNT", "amountMinor exceeds the supported payment-provider limit");\n'
    '    }\n'
    '    if (amountMinor <= 0n) throw new HttpError(400, "INVALID_AMOUNT", "amountMinor must be > 0");'
)

# Keep currencies restricted to the currently supported two-decimal payment
# flow until currency-specific minor-unit conversion is implemented and tested.
source = source.replace(
    'const currency = String(req.body.currency || "NGN").toUpperCase();',
    'const currency = String(req.body.currency || "NGN").toUpperCase();\n'
    '    if (!["NGN", "GHS"].includes(currency)) {\n'
    '      throw new HttpError(400, "UNSUPPORTED_CURRENCY", "Currently supported payment currencies are NGN and GHS");\n'
    '    }'
)

# This endpoint currently funds wallets only; do not trust a client-supplied
# payment purpose.
source = source.replace(
    'const currency = String(req.body.currency || "NGN").toUpperCase();\n'
    '    if (!["NGN", "GHS"].includes(currency)) {\n'
    '      throw new HttpError(400, "UNSUPPORTED_CURRENCY", "Currently supported payment currencies are NGN and GHS");\n'
    '    }',
    'const currency = String(req.body.currency || "NGN").toUpperCase();\n'
    '    if (!["NGN", "GHS"].includes(currency)) {\n'
    '      throw new HttpError(400, "UNSUPPORTED_CURRENCY", "Currently supported payment currencies are NGN and GHS");\n'
    '    }\n'
    '    const purpose = String(req.body.purpose || "WALLET_DEPOSIT");\n'
    '    if (purpose !== "WALLET_DEPOSIT") {\n'
    '      throw new HttpError(400, "UNSUPPORTED_PAYMENT_PURPOSE", "Only WALLET_DEPOSIT is supported");\n'
    '    }'
)

source = source.replace(
    'purpose: String(req.body.purpose || "WALLET_DEPOSIT"),',
    'purpose,'
)

# Do not mark unsupported/legacy purposes as paid and leave them uncredited.
source = source.replace(
    'const intent = await tx.paymentIntent.findUniqueOrThrow({\n'
    '      where: { id: intentId },\n'
    '    });',
    'const intent = await tx.paymentIntent.findUniqueOrThrow({\n'
    '      where: { id: intentId },\n'
    '    });\n'
    '    if (intent.purpose !== "WALLET_DEPOSIT") {\n'
    '      throw new HttpError(400, "UNSUPPORTED_PAYMENT_PURPOSE", "This payment purpose cannot be settled");\n'
    '    }'
)

source = source.replace(
    'if (\n'
    '      intent.purpose === "WALLET_DEPOSIT" ||\n'
    '      intent.purpose.startsWith("WALLET")\n'
    '    ) {',
    'if (intent.purpose === "WALLET_DEPOSIT") {'
)

# Verify all expected replacements actually happened before writing.
checks = [
    'const amountRaw = String(req.body.amountMinor ?? "");',
    'const purpose = String(req.body.purpose || "WALLET_DEPOSIT");',
    'purpose,',
    'if (intent.purpose !== "WALLET_DEPOSIT")',
    'if (intent.purpose === "WALLET_DEPOSIT") {',
]
for item in checks:
    if item not in source:
        shutil.copy2(backup, path)
        sys.exit(f"PATCH FAILED: verification pattern missing: {item!r}. Original restored.")

path.write_text(source)
print(f"Payment integrity patch applied: {path}")
print(f"Backup saved at: {backup}")
