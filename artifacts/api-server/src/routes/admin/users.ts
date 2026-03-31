import { Router } from "express";
import { z } from "zod";
import { db, usersTable, userEventsTable, userInteractionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { hashPassword } from "../../lib/passwords";
import { requireAuth, requireRole } from "../../middleware/auth-guard";
import { auditEvent } from "../../middleware/audit";

const router = Router();
router.use(requireAuth, requireRole("admin"));

const createUserSchema = z.object({
  username: z.string().min(2).max(60).regex(/^[a-zA-Z0-9_.-]+$/),
  email: z.string().email().optional().or(z.literal('')),
  password: z.string().max(256).optional(),
  role: z.enum(["user", "admin"]),
  site: z.string().max(80).nullable().optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().optional().nullable().or(z.literal('')),
  role: z.enum(["user", "admin"]).optional(),
  isActive: z.boolean().optional(),
  site: z.string().max(80).nullable().optional(),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(12).max(256),
});

function safeUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    site: u.site ?? null,
    isActive: u.isActive,
    isBootstrapAdmin: u.isBootstrapAdmin,
    mustResetPassword: u.mustResetPassword,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

async function logUserEvent(
  userId: number,
  targetUsername: string,
  event: string,
  changedBy: string,
  detail?: string,
) {
  try {
    await db.insert(userEventsTable).values({ userId, targetUsername, event, changedBy, detail: detail ?? null });
  } catch (err) { req.log?.warn({ err }, 'logUserEvent failed'); }
}

// GET /api/admin/users
router.get("/", async (_req, res) => {
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json({ users: users.map(safeUser) });
});

// POST /api/admin/users
router.post("/", async (req, res) => {
  try {
    const body = createUserSchema.parse(req.body);
    const [exists] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.username, body.username)).limit(1);
    if (exists) { res.status(409).json({ error: "Username already exists." }); return; }

    const hasPassword = body.password && body.password.length >= 12;
    const passwordHash = hasPassword ? await hashPassword(body.password!) : '';
    const mustResetPassword = !hasPassword;
    const emailVal = body.email && body.email.trim() ? body.email.trim() : null;

    const [user] = await db.insert(usersTable).values({
      username: body.username, email: emailVal, passwordHash,
      role: body.role, site: body.site ?? null, isActive: true, mustResetPassword,
    }).returning();

    auditEvent("USER_CREATED", { createdBy: req.user!.username, newUsername: body.username, role: body.role });
    await logUserEvent(user!.id, user!.username, "CREATED", req.user!.username, `Role: ${body.role}`);
    res.status(201).json(safeUser(user!));
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.issues[0]?.message ?? "Invalid input" }); return; }
    req.log.error({ err }, "Create user failed");
    res.status(500).json({ error: "Failed to create user." });
  }
});

// GET /api/admin/users/:id
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id." }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found." }); return; }
  res.json(safeUser(user));
});

// GET /api/admin/users/:id/events
router.get("/:id/events", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id." }); return; }
  const [adminEvents, interactions] = await Promise.all([
    db.select().from(userEventsTable)
      .where(eq(userEventsTable.userId, id))
      .orderBy(desc(userEventsTable.createdAt))
      .limit(50),
    db.select().from(userInteractionsTable)
      .where(eq(userInteractionsTable.userId, id))
      .orderBy(desc(userInteractionsTable.createdAt))
      .limit(100),
  ]);

  const merged = [
    ...adminEvents.map(e => ({
      id: `ae-${e.id}`,
      kind: 'admin',
      event: e.event,
      detail: e.detail,
      changedBy: e.changedBy,
      createdAt: e.createdAt,
    })),
    ...interactions.map(i => ({
      id: `ui-${i.id}`,
      kind: 'interaction',
      event: `${i.action}`,
      detail: i.element,
      changedBy: null,
      createdAt: i.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
   .slice(0, 100);

  res.json({ events: merged });
});

// PUT /api/admin/users/:id
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id." }); return; }
    const body = updateUserSchema.parse(req.body);
    const emailVal = body.email === '' ? null : body.email;

    // Get current user to detect what changed
    const [before] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!before) { res.status(404).json({ error: "User not found." }); return; }

    const [user] = await db.update(usersTable)
      .set({ ...body, email: emailVal, updatedAt: new Date() })
      .where(eq(usersTable.id, id)).returning();

    // Log meaningful state changes
    if (body.role !== undefined && body.role !== before.role) {
      await logUserEvent(id, before.username, "ROLE_CHANGED", req.user!.username, `${before.role} → ${body.role}`);
    }
    if (body.isActive !== undefined && body.isActive !== before.isActive) {
      const evt = body.isActive ? "ACTIVATED" : "DEACTIVATED";
      await logUserEvent(id, before.username, evt, req.user!.username);
    }

    auditEvent("USER_UPDATED", { updatedBy: req.user!.username, targetUserId: id });
    res.json(safeUser(user!));
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.issues[0]?.message }); return; }
    res.status(500).json({ error: "Failed to update user." });
  }
});

// POST /api/admin/users/:id/reset-password
router.post("/:id/reset-password", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id." }); return; }
    const { newPassword } = resetPasswordSchema.parse(req.body);
    const passwordHash = await hashPassword(newPassword);
    const [user] = await db.update(usersTable)
      .set({ passwordHash, mustResetPassword: false, updatedAt: new Date() })
      .where(eq(usersTable.id, id)).returning();
    if (!user) { res.status(404).json({ error: "User not found." }); return; }
    auditEvent("PASSWORD_RESET", { resetBy: req.user!.username, targetUserId: id });
    await logUserEvent(id, user.username, "PASSWORD_RESET", req.user!.username);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.issues[0]?.message }); return; }
    res.status(500).json({ error: "Failed to reset password." });
  }
});

// DELETE /api/admin/users/:id?hard=true — soft deactivate or hard delete
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id." }); return; }
  const hard = req.query.hard === "true";

  if (id === req.user!.id) {
    res.status(400).json({ error: "Cannot deactivate or delete your own account." });
    return;
  }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!target) { res.status(404).json({ error: "User not found." }); return; }

  if (hard) {
    // Log before deletion so the record survives
    await logUserEvent(id, target.username, "DELETED", req.user!.username, "Hard deleted by admin");
    await db.delete(usersTable).where(eq(usersTable.id, id));
    auditEvent("USER_DELETED", { deletedBy: req.user!.username, targetUserId: id, username: target.username });
    res.json({ ok: true, deleted: true });
  } else {
    const [user] = await db.update(usersTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(usersTable.id, id)).returning();
    auditEvent("USER_DEACTIVATED", { deactivatedBy: req.user!.username, targetUserId: id });
    await logUserEvent(id, target.username, "DEACTIVATED", req.user!.username);
    res.json({ ok: true, deleted: false, user: safeUser(user!) });
  }
});

export default router;
