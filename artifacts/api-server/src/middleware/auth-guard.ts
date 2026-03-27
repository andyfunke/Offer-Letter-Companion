import { type Request, type Response, type NextFunction } from "express";
import { validateSession, COOKIE_NAME } from "../lib/session";
import { hasRole } from "../lib/rbac";
import { auditEvent } from "./audit";
import type { User } from "@workspace/db";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// ── Attach user to request if a valid session cookie is present ───────────
export async function attachUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (token && typeof token === "string") {
      const user = await validateSession(token);
      if (user) req.user = user;
    }
  } catch {
    // silently continue — unauthenticated
  }
  next();
}

// ── Require an authenticated session ──────────────────────────────────────
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  next();
}

// ── Require a minimum role level ──────────────────────────────────────────
export function requireRole(minRole: "admin" | "user") {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    if (!hasRole(req.user.role, minRole)) {
      auditEvent("AUTHZ_FAILURE", {
        userId: req.user.id,
        username: req.user.username,
        requiredRole: minRole,
        userRole: req.user.role,
        path: req.url,
        method: req.method,
      });
      res.status(403).json({ error: "Insufficient permissions." });
      return;
    }
    next();
  };
}
