import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { HttpError } from "../lib/errors";

type RoleName = NonNullable<Express.Request["user"]>["role"];

const isActiveRole = (role: unknown): role is RoleName =>
  role === "CLIENT" ||
  role === "ORGANIZATION" ||
  role === "VENDOR" ||
  role === "AFFILIATE" ||
  role === "CONSULTANT" ||
  role === "ADMIN" ||
  role === "VERIFIER";

export function hasRole(user: Express.Request["user"], role: RoleName): boolean {
  if (!user) return false;
  if (user.role === role) return true;
  if (user.role !== "ORGANIZATION") return false;
  return (
    (role === "CLIENT" && user.organizationMode === "EVENT_PLANNING") ||
    (role === "VENDOR" && user.organizationMode === "SERVICE_PROVIDER")
  );
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(new HttpError(401, "UNAUTHENTICATED", "Missing bearer token"));
  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(header.slice(7), env.JWT_SECRET);
  } catch {
    return next(new HttpError(401, "INVALID_TOKEN", "Invalid or expired token"));
  }
  if (typeof payload === "string" || !payload.sub || typeof payload.role !== "string") {
    return next(new HttpError(401, "INVALID_TOKEN", "Invalid or expired token"));
  }
  if (payload.role === "RIDER") {
    return next(new HttpError(403, "ACCOUNT_DISABLED", "Rider accounts are no longer supported"));
  }
  if (!isActiveRole(payload.role)) {
    return next(new HttpError(401, "INVALID_TOKEN", "Invalid or expired token"));
  }
  const organizationMode =
    payload.organizationMode === "EVENT_PLANNING" || payload.organizationMode === "SERVICE_PROVIDER"
      ? payload.organizationMode
      : null;
  if (payload.role === "ORGANIZATION" && !organizationMode) {
    return next(new HttpError(401, "INVALID_TOKEN", "Invalid or expired token"));
  }
  req.user = { id: payload.sub, role: payload.role, organizationMode };
  next();
};

export const requireRole =
  (...roles: RoleName[]): RequestHandler =>
  (req, _res, next) => {
    if (!roles.some((role) => hasRole(req.user, role))) return next(new HttpError(403, "FORBIDDEN", "Insufficient role"));
    next();
  };
