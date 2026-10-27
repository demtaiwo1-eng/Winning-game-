import { checkPassword, PASSWORD_HELPER, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./passwordRule";

export type RegistrationField =
  | "name"
  | "email"
  | "password"
  | "business"
  | "vendorPhone"
  | "vendorCity"
  | "vendorDescription"
  | "vendorKycUrl"
  | "registrationCategory"
  | "referralCode";

export function registrationFieldError(
  field: RegistrationField,
  value: string,
  context: { role: string; mode: "signin" | "signup" | "forgot"; organizationMode: string },
): string | null {
  const requiredName = context.mode === "signup" && field === "name";
  const requiresBusiness =
    context.mode === "signup" &&
    field === "business" &&
    (context.role === "VENDOR" ||
      (context.role === "ORGANIZATION" && context.organizationMode === "SERVICE_PROVIDER"));

  if (requiredName) {
    if (value.trim().length < 2) return "Enter at least 2 characters for your name.";
    if (value.trim().length > 100) return "Your name must be 100 characters or fewer.";
  }
  if (field === "email") {
    if (!value.trim()) return "Enter your email address.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return "Enter a valid email address.";
  }
  if (field === "password") {
    if (context.mode === "forgot") return null;
    if (!value) return "Enter your password.";
    if (context.mode === "signup") {
      if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH || !checkPassword(value).ok) {
        return PASSWORD_HELPER;
      }
    }
  }
  if (requiresBusiness) {
    if (value.trim().length < 2) return "Enter a business name with at least 2 characters.";
    if (value.trim().length > 120) return "Business names must be 120 characters or fewer.";
  }
  if (field === "vendorPhone" && value.trim() && (value.trim().length < 7 || value.trim().length > 20)) {
    return "Enter a phone number between 7 and 20 characters.";
  }
  if (field === "vendorCity" && value.trim().length > 120) return "City names must be 120 characters or fewer.";
  if (field === "vendorDescription" && value.length > 2000) return "Descriptions must be 2,000 characters or fewer.";
  if (field === "vendorKycUrl" && value.trim()) {
    try {
      const url = new URL(value.trim());
      if (url.protocol !== "https:" && url.protocol !== "http:") return "Use a valid HTTPS document URL.";
    } catch {
      return "Enter a valid document URL.";
    }
  }
  if (field === "registrationCategory" && value.trim().length > 80) return "This field must be 80 characters or fewer.";
  if (field === "referralCode" && value.trim().length > 80) return "Referral codes must be 80 characters or fewer.";
  return null;
}
