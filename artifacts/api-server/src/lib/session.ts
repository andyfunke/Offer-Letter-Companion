import crypto from "crypto";
import { db, sessionsTable, usersTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import type { User } from "@workspace/db";

export const SESSION_TTL_MS = parseInt(
  process.env["SESSION_TTL_SECONDS"] ?? "28800",
  10,
) * 1000;

const COOKIE_NAME = "kol_session";

// ── Generate a new opaque session token ──────────────────────────────────
export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex"); // 256-bit entropy
}

// ── Hash the token for storage (never store the raw token) ───────────────
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ── Create a session in the DB ────────────────────────────────────────────
export async function createSession(
  userId: number,
  ipAddress?: string,
  userAgent?: string,
): Promise<string> {
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessionsTable).values({
    userId,
    tokenHash,
    expiresAt,
    ipAddress: ipAddress ?? null,
    userAgent: userAgent?.slice(0, 512) ?? null,
  });

  return rawToken;
}

// ── Validate a session token and return the user ──────────────────────────
export async function validateSession(
  rawToken: string,
): Promise<User | null> {
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const rows = await db
    .select({ user: usersTable })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(
      and(
        eq(sessionsTable.tokenHash, tokenHash),
        gt(sessionsTable.expiresAt, now),
      ),
    )
    .limit(1);

  if (!rows.length) return null;
  const user = rows[0]!.user;
  if (!user.isActive) return null;
  return user;
}

// ── Destroy a session (logout) ────────────────────────────────────────────
export async function destroySession(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, tokenHash));
}

// ── Purge expired sessions (can be called periodically) ───────────────────
export async function purgeExpiredSessions(): Promise<void> {
  const { lt } = await import("drizzle-orm");
  await db.delete(sessionsTable).where(lt(sessionsTable.expiresAt, new Date()));
}

export { COOKIE_NAME };
