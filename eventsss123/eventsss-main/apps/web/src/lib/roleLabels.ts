/** Single mapping for user-facing role labels. Internal API/DB values remain unchanged. */
export const ROLE_LABELS: Record<string, string> = {
  CLIENT: 'Executive Planner',
  ORGANIZATION: 'Organization',
  VENDOR: 'Vendor',
  AFFILIATE: 'Affiliate',
  VERIFIER: 'Verifier',
  CONSULTANT: 'Consultant',
  ADMIN: 'Admin',
};

export function roleLabel(role: string | undefined | null): string {
  if (!role) return 'User';
  return ROLE_LABELS[role] ?? role;
}

/** Roles offered by the shared role registration dialog. Executive Planner is entered through /plan. */
export const SELF_REGISTER_ROLES = [
  'ORGANIZATION',
  'VENDOR',
  'AFFILIATE',
  'VERIFIER',
  'CONSULTANT',
] as const;

export type SelfRegisterRole = (typeof SELF_REGISTER_ROLES)[number];
