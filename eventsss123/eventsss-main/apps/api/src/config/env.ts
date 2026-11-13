import "dotenv/config";
import { z } from "zod/v3";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  EPHINTA_ENVIRONMENT: z.enum(["development", "staging", "production"]).default("development"),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  ACCESS_TTL_MIN: z.coerce.number().default(15),
  REFRESH_TTL_DAYS: z.coerce.number().default(30),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,https://localhost,http://localhost,capacitor://localhost"),
  ALLOW_CODESPACES: z.enum(["true", "false"]).default("false"),
  // Legacy fallback retained for existing deployments; new deployments should set both fee rates explicitly.
  COMMISSION_BPS: z.coerce.number().int().min(0).max(5000).default(200),
  WALLET_TOPUP_FEE_BPS: z.coerce.number().int().min(0).max(5000).optional(),
  BOOKING_COMMISSION_BPS: z.coerce.number().int().min(0).max(5000).optional(),
  PAYOUT_FEE_BPS: z.coerce.number().int().min(0).max(5000).optional(),
  DEFAULT_CURRENCY: z.string().length(3).default("NGN"),
  APP_BASE_URL: z.string().url().default("http://localhost:4173"),
  API_BASE_URL: z.string().url().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_WEBHOOK_SECRET: z.string().optional(),
  FLUTTERWAVE_SECRET_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  OPAY_MERCHANT_ID: z.string().optional(),
  OPAY_TEST_MERCHANT_ID: z.string().optional(),
  OPAY_TEST_PUBLIC_KEY: z.string().optional(),
  OPAY_TEST_SECRET_KEY: z.string().optional(),
  OPAY_LIVE_MERCHANT_ID: z.string().optional(),
  OPAY_LIVE_PUBLIC_KEY: z.string().optional(),
  OPAY_LIVE_SECRET_KEY: z.string().optional(),
  OPAY_LIVE_MODE_READY: z.enum(["true", "false"]).default("false"),
  OPAY_PUBLIC_KEY: z.string().optional(),
  OPAY_SECRET_KEY: z.string().optional(),
  OPAY_TRANSFERS_ENABLED: z.enum(["true", "false"]).default("false"),
  OPAY_TRANSFER_BASE_URL: z.string().url().optional(),
  OPAY_TEST_TRANSFER_BASE_URL: z.string().url().optional(),
  OPAY_LIVE_TRANSFER_BASE_URL: z.string().url().optional(),
  PAYMENT_MODE: z.enum(["test", "live"]).default("test"),
  ALLOW_PRODUCTION_TEST_MODE: z.enum(["true", "false"]).default("false"),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_ENDPOINT_URL_S3: z.string().url().optional(),
  AWS_REGION: z.string().optional(),
  KYC_STORAGE_BUCKET: z.string().optional(),
  BYTID_API_KEY: z.string().optional(),
  BYTID_API_URL: z.string().url().default("https://api.bytid.com/v1"),
  BYTID_WEBHOOK_SECRET: z.string().optional(),
  BYTID_ALLOW_LIVE: z.enum(["true", "false"]).default("false"),
  BYTID_REQUIRE_DOCUMENT: z.enum(["true", "false"]).default("false"),
});

const rawEnv: NodeJS.ProcessEnv = {};
for (const key in process.env) {
  const value = process.env[key];
  if (value !== "") rawEnv[key] = value;
}
const parsed = schema.safeParse(rawEnv);
if (!parsed.success) {
  console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}
export const env = parsed.data;
