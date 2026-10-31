export function canReadReadinessEvent(input: {
  ownerId: string;
  userId: string;
  role: string;
  assignedVerifier: boolean;
}): boolean {
  return (
    input.ownerId === input.userId ||
    input.role === "ADMIN" ||
    input.role === "CONSULTANT" ||
    (input.role === "VERIFIER" && input.assignedVerifier)
  );
}

export function canManageReadinessZones(input: {
  ownerId: string;
  userId: string;
  role: string;
}): boolean {
  return input.ownerId === input.userId || input.role === "ADMIN" || input.role === "CONSULTANT";
}

export function canAssignReadinessVerifier(input: {
  ownerId: string;
  userId: string;
  targetVerifierId: string;
  role: string;
}): boolean {
  if (input.targetVerifierId === input.userId) return input.role === "VERIFIER";
  return input.ownerId === input.userId || input.role === "ADMIN" || input.role === "CONSULTANT";
}
