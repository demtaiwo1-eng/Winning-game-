export {};
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: "CLIENT" | "ORGANIZATION" | "VENDOR" | "AFFILIATE" | "CONSULTANT" | "ADMIN" | "VERIFIER";
        organizationMode?: "EVENT_PLANNING" | "SERVICE_PROVIDER" | null;
      };
    }
  }
}
