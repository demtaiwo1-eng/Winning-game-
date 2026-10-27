import { z } from "zod";
import {
  checkPassword,
  PASSWORD_HELPER,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "../../lib/passwordRule";

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, PASSWORD_HELPER)
  .max(PASSWORD_MAX_LENGTH)
  .refine((password) => checkPassword(password).ok, PASSWORD_HELPER);

export const registerSchema = z
  .object({
    email: z.string().email().toLowerCase(),
    password: passwordSchema,
    name: z.string().trim().min(2).max(100),
    role: z.enum(["CLIENT", "ORGANIZATION", "VENDOR", "AFFILIATE", "VERIFIER", "CONSULTANT"]).default("CLIENT"),
    organizationMode: z.enum(["EVENT_PLANNING", "SERVICE_PROVIDER"]).optional(),
    registrationCategory: z.string().trim().min(2).max(80).optional(),
    referralCode: z.string().trim().max(80).optional(),
    phone: z.string().trim().min(7).max(20).optional(),
    country: z.string().length(2).toUpperCase().optional(),
    currency: z.string().length(3).toUpperCase().default("NGN"),
    locale: z.string().min(2).max(10).default("en"),
    businessName: z.string().trim().min(2).max(120).optional(),
    businessDescription: z.string().trim().max(2000).optional(),
    businessCity: z.string().trim().max(120).optional(),
    kycDocumentUrl: z.string().url().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.role === "ORGANIZATION" && !v.organizationMode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["organizationMode"],
        message: "organizationMode is required for organizations",
      });
    }
    if (v.role !== "ORGANIZATION" && v.organizationMode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["organizationMode"],
        message: "organizationMode is only valid for organizations",
      });
    }
    if ((v.role === "VENDOR" || (v.role === "ORGANIZATION" && v.organizationMode === "SERVICE_PROVIDER")) && !v.businessName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["businessName"],
        message: "businessName is required for service providers",
      });
    }
  });

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({ email: z.string().email().toLowerCase() });
export const resetPasswordSchema = z.object({
  token: z.string().min(32),
  password: passwordSchema,
});

export const refreshSchema = z.object({ refreshToken: z.string().min(20) });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
