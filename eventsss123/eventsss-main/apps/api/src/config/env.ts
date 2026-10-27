import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  ACCESS_TTL_MIN: z.coerce.number().default(15),
  REFRESH_TTL_DAYS: z.coerce.number().default(30),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,https://localhost,http://localhost,capacitor://localhost"),
  ALLOW_CODESPACES: z.enum(["true", "false"]).default("false"),
  COMMISSION_BPS: z.coerce.number().int().min(0).max(5000).default(1000),
  DEFAULT_CURRENCY: z.string().length(3).default("NGN"),
  APP_BASE_URL: z.string().url().default("http://localhost:4173"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  FLUTTERWAVE_SECRET_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  PAYMENT_MODE: z.enum(["test", "live"]).default("test"),
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
