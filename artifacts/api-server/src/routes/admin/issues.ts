import { Router } from "express";
import { z } from "zod";
import { db, telemetryIssuesTable, issueSnapshotsTable, adminNotesTable, usersTable } from "@workspace/db";
import { eq, desc, and, gte, lte, like } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middleware/auth-guard";
import { auditEvent } from "../../middleware/audit";

const router = Router();
router.use(requireAuth, requireRole("admin"));

const VALID_STATUSES = ["new", "triaged", "in_progress", "resolved", "dismissed"] as const;

const statusUpdateSchema = z.object({
  status: z.enum(VALID_STATUSES),
});

const addNoteSchema = z.object({
  noteText: z.string().min(1).max(4000),
});

// ── GET /api/admin/issues — list with filtering ────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { status, route, section, scenario, from, to } = req.query as Record<string, string | undefined>;

    const conditions: ReturnType<typeof eq>[] = [];
    if (status && VALID_STATUSES.includes(status as any)) {
      conditions.push(eq(telemetryIssuesTable.status, status));
    }
    if (route) conditions.push(like(telemetryIssuesTable.currentRoute, `%${route}%`));
    if (section) conditions.push(like(telemetryIssuesTable.currentSection!, `%${section}%`));
    if (scenario) conditions.push(like(telemetryIssuesTable.activeScenario!, `%${scenario}%`));
    if (from) conditions.push(gte(telemetryIssuesTable.createdAt, new Date(from)));
    if (to) conditions.push(lte(telemetryIssuesTable.createdAt, new Date(to)));

    const issues = await db
      .select()
      .from(telemetryIssuesTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(telemetryIssuesTable.createdAt));

    auditEvent("ISSUES_LIST_VIEWED", { viewedBy: req.user!.username });
    res.json({ issues });
  } catch (err) {
    req.log.error({ err }, "Failed to list issues");
    res.status(500).json({ error: "Failed to list issues." });
  }
});

// ── GET /api/admin/issues/:id ─────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id." }); return; }
    const [issue] = await db
      .select()
      .from(telemetryIssuesTable)
      .where(eq(telemetryIssuesTable.id, id))
      .limit(1);
    if (!issue) { res.status(404).json({ error: "Issue not found." }); return; }

    const notes = await db
      .select()
      .from(adminNotesTable)
      .where(eq(adminNotesTable.issueId, id))
      .orderBy(adminNotesTable.createdAt);

    const [snapshot] = await db
      .select()
      .from(issueSnapshotsTable)
      .where(eq(issueSnapshotsTable.issueId, id))
      .limit(1);

    auditEvent("ISSUE_VIEWED", {
      viewedBy: req.user!.username,
      issueRef: issue.issueRef,
    });

    res.json({ issue, notes, snapshot: snapshot ?? null });
  } catch (err) {
    req.log.error({ err }, "Failed to get issue");
    res.status(500).json({ error: "Failed to get issue." });
  }
});

// ── GET /api/admin/issues/:id/preview ─────────────────────────────────────
router.get("/:id/preview", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id." }); return; }
    const [snapshot] = await db
      .select()
      .from(issueSnapshotsTable)
      .where(eq(issueSnapshotsTable.issueId, id))
      .limit(1);
    if (!snapshot) { res.status(404).json({ error: "No preview available." }); return; }

    auditEvent("ISSUE_PREVIEW_VIEWED", {
      viewedBy: req.user!.username,
      issueId: id,
    });
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ error: "Failed to load preview." });
  }
});

// ── PUT /api/admin/issues/:id/status ──────────────────────────────────────
router.put("/:id/status", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id." }); return; }
    const { status } = statusUpdateSchema.parse(req.body);
    const [issue] = await db
      .update(telemetryIssuesTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(telemetryIssuesTable.id, id))
      .returning();
    if (!issue) { res.status(404).json({ error: "Issue not found." }); return; }

    auditEvent("ISSUE_STATUS_CHANGED", {
      changedBy: req.user!.username,
      issueRef: issue.issueRef,
      newStatus: status,
    });
    res.json(issue);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.message }); return;
    }
    res.status(500).json({ error: "Failed to update status." });
  }
});

// ── POST /api/admin/issues/:id/notes (append-only) ────────────────────────
router.post("/:id/notes", async (req, res) => {
  try {
    const issueId = parseInt(req.params.id);
    if (isNaN(issueId)) { res.status(400).json({ error: "Invalid id." }); return; }
    const { noteText } = addNoteSchema.parse(req.body);

    const [issue] = await db
      .select({ id: telemetryIssuesTable.id, ref: telemetryIssuesTable.issueRef })
      .from(telemetryIssuesTable)
      .where(eq(telemetryIssuesTable.id, issueId))
      .limit(1);
    if (!issue) { res.status(404).json({ error: "Issue not found." }); return; }

    const [note] = await db.insert(adminNotesTable).values({
      issueId,
      authorId: req.user!.id,
      authorDisplayName: req.user!.username,
      noteText,
    }).returning();

    auditEvent("ISSUE_NOTE_ADDED", {
      addedBy: req.user!.username,
      issueRef: issue.ref,
    });
    res.status(201).json(note);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.message }); return;
    }
    res.status(500).json({ error: "Failed to add note." });
  }
});

export default router;
