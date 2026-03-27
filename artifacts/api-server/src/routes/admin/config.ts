import { Router } from "express";
import { z } from "zod";
import { db, ptoOptionsTable, appSettingsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middleware/auth-guard";
import { auditEvent } from "../../middleware/audit";

const router = Router();

// ── PTO OPTIONS ────────────────────────────────────────────────────────────

// GET /api/admin/pto-options  (any authenticated user can read)
router.get("/pto-options", requireAuth, async (_req, res) => {
  try {
    const opts = await db.select().from(ptoOptionsTable).orderBy(asc(ptoOptionsTable.value));
    res.json(opts);
  } catch {
    res.status(500).json({ error: "Failed to fetch PTO options." });
  }
});

// POST /api/admin/pto-options  (system_admin only)
router.post("/pto-options", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { value } = z.object({ value: z.number().int().positive() }).parse(req.body);
    const [created] = await db.insert(ptoOptionsTable).values({ value }).returning();
    auditEvent("PTO_OPTION_ADDED", { value, userId: req.user!.id });
    res.status(201).json(created);
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: err.issues[0]?.message }); return; }
    res.status(500).json({ error: "Failed to create PTO option." });
  }
});

// DELETE /api/admin/pto-options/:id  (system_admin only)
router.delete("/pto-options/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id." }); return; }
    await db.delete(ptoOptionsTable).where(eq(ptoOptionsTable.id, id));
    auditEvent("PTO_OPTION_REMOVED", { id, userId: req.user!.id });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete PTO option." });
  }
});

// ── LETTERHEAD TEMPLATE ────────────────────────────────────────────────────

// GET /api/admin/letterhead  — download current letterhead as .docx
router.get("/letterhead", requireAuth, async (_req, res) => {
  try {
    const [setting] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "letterhead")).limit(1);
    if (!setting?.valueText) {
      res.status(404).json({ error: "No letterhead template uploaded yet." });
      return;
    }
    const buf = Buffer.from(setting.valueText, "base64");
    res.set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.set("Content-Disposition", 'attachment; filename="Letterhead_Template.docx"');
    res.send(buf);
  } catch {
    res.status(500).json({ error: "Failed to retrieve letterhead." });
  }
});

// PUT /api/admin/letterhead  — upload/replace letterhead template (raw binary body)
router.put("/letterhead", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    await new Promise<void>((resolve, reject) => {
      req.on("end", resolve);
      req.on("error", reject);
    });
    const buf = Buffer.concat(chunks);
    if (buf.length < 4) { res.status(400).json({ error: "Invalid file." }); return; }
    // Validate ZIP signature (docx is a ZIP)
    if (buf[0] !== 0x50 || buf[1] !== 0x4B) {
      res.status(400).json({ error: "File must be a valid .docx (ZIP) file." });
      return;
    }
    const b64 = buf.toString("base64");
    await db.insert(appSettingsTable).values({ key: "letterhead", valueText: b64, updatedAt: new Date() })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { valueText: b64, updatedAt: new Date() } });
    // Persist the original filename so the preview footer can reference it
    const originalName = (req.headers["x-filename"] as string | undefined)?.trim() || null;
    if (originalName) {
      await db.insert(appSettingsTable).values({ key: "letterhead_filename", valueText: originalName, updatedAt: new Date() })
        .onConflictDoUpdate({ target: appSettingsTable.key, set: { valueText: originalName, updatedAt: new Date() } });
    }
    auditEvent("LETTERHEAD_UPDATED", { bytes: buf.length, filename: originalName, userId: req.user!.id });
    res.json({ ok: true, bytes: buf.length });
  } catch {
    res.status(500).json({ error: "Failed to upload letterhead." });
  }
});

// GET /api/admin/letterhead/status  — check if letterhead is present + return filename
router.get("/letterhead/status", requireAuth, async (_req, res) => {
  try {
    const [setting] = await db.select({ key: appSettingsTable.key, updatedAt: appSettingsTable.updatedAt })
      .from(appSettingsTable).where(eq(appSettingsTable.key, "letterhead")).limit(1);
    const [filenameSetting] = await db.select({ valueText: appSettingsTable.valueText })
      .from(appSettingsTable).where(eq(appSettingsTable.key, "letterhead_filename")).limit(1);
    res.json({
      present: !!setting,
      updatedAt: setting?.updatedAt ?? null,
      filename: filenameSetting?.valueText ?? null,
    });
  } catch {
    res.status(500).json({ error: "Failed to check letterhead status." });
  }
});

export default router;
