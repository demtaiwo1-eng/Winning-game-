/** Single mapping for user-facing role labels. Keep the public-facing registration flow to three core lanes. */
export const ROLE_LABELS: Record<string, string> = {
  CLIENT: 'Event Planner',
  ORGANIZATION: 'Organizer',
  VENDOR: 'Vendor',
};

export function roleLabel(role: string | undefined | null): string {
  if (!role) return 'User';
  return ROLE_LABELS[role] ?? role;
}

/** Core public roles for the registration flow. */
export const SELF_REGISTER_ROLES = ['CLIENT', 'ORGANIZATION', 'VENDOR'] as const;

export type SelfRegisterRole = (typeof SELF_REGISTER_ROLES)[number];
