import { Router } from "express";
import { z } from "zod";
import { db, hrProfilesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middleware/auth-guard";
import { auditEvent } from "../../middleware/audit";

const router = Router();
router.use(requireAuth);

const profileSchema = z.object({
  firstName: z.string().min(1).max(80).trim(),
  lastName: z.string().min(1).max(80).trim(),
  email: z.string().email().optional().or(z.literal('')),
  site: z.string().max(80).nullable().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/admin/hr-profiles — list all
router.get("/", async (_req, res) => {
  try {
    const profiles = await db.select().from(hrProfilesTable).orderBy(asc(hrProfilesTable.lastName), asc(hrProfilesTable.firstName));
    res.json(profiles);
  } catch {
    res.status(500).json({ error: "Failed to fetch HR profiles." });
  }
});

// POST /api/admin/hr-profiles — create
router.post("/", requireRole("admin"), async (req, res) => {
  try {
    const body = profileSchema.parse(req.body);
    const [created] = await db.insert(hrProfilesTable).values({
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email || null,
      site: body.site ?? null,
      isActive: body.isActive ?? true,
    }).returning();
    auditEvent("HR_PROFILE_CREATED", { name: `${body.firstName} ${body.lastName}`, userId: req.user!.id });
    res.status(201).json(created);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.issues[0]?.message }); return; }
    res.status(500).json({ error: "Failed to create HR profile." });
  }
});

// PUT /api/admin/hr-profiles/:id — update
router.put("/:id", requireRole("admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id." }); return; }
    const body = profileSchema.parse(req.body);
    const [updated] = await db.update(hrProfilesTable).set({
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email || null,
      site: body.site ?? null,
      isActive: body.isActive ?? true,
      updatedAt: new Date(),
    }).where(eq(hrProfilesTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Profile not found." }); return; }
    auditEvent("HR_PROFILE_UPDATED", { id, userId: req.user!.id });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.issues[0]?.message }); return; }
    res.status(500).json({ error: "Failed to update HR profile." });
  }
});

// DELETE /api/admin/hr-profiles/:id — delete
router.delete("/:id", requireRole("admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id." }); return; }
    await db.delete(hrProfilesTable).where(eq(hrProfilesTable.id, id));
    auditEvent("HR_PROFILE_DELETED", { id, userId: req.user!.id });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete HR profile." });
  }
});

export default router;
