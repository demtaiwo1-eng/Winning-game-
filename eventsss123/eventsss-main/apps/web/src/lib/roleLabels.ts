/** User-facing labels for accounts that can register themselves. */
export const ROLE_LABELS: Record<string, string> = {
  CLIENT: 'Event Planner',
  ORGANIZATION: 'Organizer',
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

/** Roles accepted by the public registration endpoint. ADMIN remains invitation-only. */
export const SELF_REGISTER_ROLES = [
  'CLIENT',
  'ORGANIZATION',
  'VENDOR',
  'AFFILIATE',
  'VERIFIER',
  'CONSULTANT',
] as const;

export type SelfRegisterRole = (typeof SELF_REGISTER_ROLES)[number];
