import { Router } from "express";
import { z } from "zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "../../lib/passwords";
import { isValidRole, ROLES } from "../../lib/rbac";
import { requireAuth, requireRole } from "../../middleware/auth-guard";
import { auditEvent } from "../../middleware/audit";

const router = Router();
router.use(requireAuth, requireRole("system_admin"));

const createUserSchema = z.object({
  username: z.string().min(2).max(60).regex(/^[a-zA-Z0-9_.-]+$/),
  email: z.string().email().optional().or(z.literal('')),
  password: z.string().max(256).optional(), // blank = must reset on first login
  role: z.enum(["recruiter", "hr_admin", "system_admin"]),
  site: z.string().max(80).nullable().optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().optional().nullable().or(z.literal('')),
  role: z.enum(["recruiter", "hr_admin", "system_admin"]).optional(),
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

// GET /api/admin/users
router.get("/", async (_req, res) => {
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json({ users: users.map(safeUser) });
});

// POST /api/admin/users
router.post("/", async (req, res) => {
  try {
    const body = createUserSchema.parse(req.body);
    const [exists] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, body.username))
      .limit(1);
    if (exists) { res.status(409).json({ error: "Username already exists." }); return; }

    // Blank or missing password → must reset on first login
    const hasPassword = body.password && body.password.length >= 12;
    const passwordHash = hasPassword ? await hashPassword(body.password!) : '';
    const mustResetPassword = !hasPassword;

    const emailVal = body.email && body.email.trim() ? body.email.trim() : null;

    const [user] = await db.insert(usersTable).values({
      username: body.username,
      email: emailVal,
      passwordHash,
      role: body.role,
      site: body.site ?? null,
      isActive: true,
      mustResetPassword,
    }).returning();

    auditEvent("USER_CREATED", { createdBy: req.user!.username, newUsername: body.username, role: body.role, mustResetPassword });
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
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found." }); return; }
  res.json(safeUser(user));
});

// PUT /api/admin/users/:id
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = updateUserSchema.parse(req.body);
    const emailVal = body.email === '' ? null : body.email;
    const [user] = await db
      .update(usersTable)
      .set({ ...body, email: emailVal, updatedAt: new Date() })
      .where(eq(usersTable.id, id))
      .returning();
    if (!user) { res.status(404).json({ error: "User not found." }); return; }
    auditEvent("USER_UPDATED", { updatedBy: req.user!.username, targetUserId: id, changes: { role: body.role, isActive: body.isActive } });
    res.json(safeUser(user));
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.issues[0]?.message }); return; }
    res.status(500).json({ error: "Failed to update user." });
  }
});

// POST /api/admin/users/:id/reset-password
router.post("/:id/reset-password", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { newPassword } = resetPasswordSchema.parse(req.body);
    const passwordHash = await hashPassword(newPassword);
    const [user] = await db
      .update(usersTable)
      .set({ passwordHash, mustResetPassword: false, updatedAt: new Date() })
      .where(eq(usersTable.id, id))
      .returning();
    if (!user) { res.status(404).json({ error: "User not found." }); return; }
    auditEvent("PASSWORD_RESET", { resetBy: req.user!.username, targetUserId: id });
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.issues[0]?.message }); return; }
    res.status(500).json({ error: "Failed to reset password." });
  }
});

// DELETE /api/admin/users/:id — soft deactivate
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (id === req.user!.id) { res.status(400).json({ error: "Cannot deactivate your own account." }); return; }
  const [user] = await db
    .update(usersTable)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(usersTable.id, id))
    .returning();
  if (!user) { res.status(404).json({ error: "User not found." }); return; }
  auditEvent("USER_DEACTIVATED", { deactivatedBy: req.user!.username, targetUserId: id });
  res.json({ ok: true });
});

export { ROLES, isValidRole };
export default router;
