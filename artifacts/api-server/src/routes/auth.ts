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
  password: z.string().min(1).max(256),
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
    // Look up by username OR email — never reveal which exists
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

    // Run bcrypt compare even if user not found (timing-safe)
    const dummyHash =
      "$2a$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const valid = user
      ? await verifyPassword(password, user.passwordHash)
      : await verifyPassword(password, dummyHash).then(() => false);

    if (!valid || !user) {
      auditEvent("LOGIN_FAILURE", {
        attemptedUsername: username,
        ip: req.ip,
        userAgent: req.headers["user-agent"] ?? "unknown",
      });
      // Generic message — no enumeration
      res.status(401).json({ error: "Invalid credentials." });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: "Account is deactivated. Contact your administrator." });
      return;
    }

    // Create session
    const rawToken = await createSession(user.id, req.ip, req.headers["user-agent"]);

    // Update last login
    await db
      .update(usersTable)
      .set({ lastLoginAt: new Date() })
      .where(eq(usersTable.id, user.id));

    auditEvent("LOGIN_SUCCESS", {
      userId: user.id,
      username: user.username,
      role: user.role,
      ip: req.ip,
    });

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
    try {
      await destroySession(token);
    } catch {
      // still clear the cookie
    }
    auditEvent("LOGOUT", { userId: req.user!.id, username: req.user!.username });
  }
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

// GET /api/auth/me
router.get("/me", (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }
  res.json({
    id: req.user.id,
    username: req.user.username,
    role: req.user.role,
    email: req.user.email,
  });
});

// ── Setup endpoints (first-run only) ─────────────────────────────────────

// GET /api/auth/setup-status — public, returns whether initial setup is needed
router.get("/setup-status", async (_req, res) => {
  try {
    const [{ value }] = await db.select({ value: count() }).from(usersTable);
    res.json({ needsSetup: value === 0 });
  } catch (err) {
    res.status(500).json({ error: "Could not check setup status." });
  }
});

const setupSchema = z.object({
  username: z.string().min(2).max(60).regex(/^[a-zA-Z0-9_.-]+$/, "Username may only contain letters, numbers, _ . -"),
  password: z.string().min(12).max(256),
  email: z.string().email().optional(),
});

// POST /api/auth/setup — creates the first system_admin; rejected if any user exists
router.post("/setup", async (req, res) => {
  try {
    // Guard: only works when zero users exist
    const [{ value }] = await db.select({ value: count() }).from(usersTable);
    if (value > 0) {
      res.status(409).json({ error: "Setup already complete. Please log in." });
      return;
    }

    const body = setupSchema.parse(req.body);
    const passwordHash = await hashPassword(body.password);

    const [user] = await db.insert(usersTable).values({
      username: body.username,
      email: body.email ?? null,
      passwordHash,
      role: "system_admin",
      isActive: true,
      isBootstrapAdmin: true,
    }).returning();

    auditEvent("SETUP_COMPLETE", { username: body.username });

    // Auto-login after setup
    const rawToken = await createSession(user!.id, req.ip, req.headers["user-agent"]);
    await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user!.id));

    res.cookie(COOKIE_NAME, rawToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env["NODE_ENV"] === "production",
      maxAge: SESSION_TTL_MS,
      path: "/",
    });

    res.status(201).json({
      id: user!.id,
      username: user!.username,
      role: user!.role,
      email: user!.email,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.issues[0]?.message ?? "Invalid input." });
      return;
    }
    res.status(500).json({ error: "Setup failed. Please try again." });
  }
});

export default router;
