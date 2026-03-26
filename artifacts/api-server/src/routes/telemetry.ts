import { Router } from "express";
import { z } from "zod";
import { db, telemetryIssuesTable, issueSnapshotsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth-guard";
import { auditEvent } from "../middleware/audit";

const router = Router();
router.use(requireAuth);

const issueSchema = z.object({
  currentRoute: z.string().max(500),
  pageTitle: z.string().max(200),
  elementId: z.string().max(200).optional(),
  elementName: z.string().max(200).optional(),
  elementRole: z.string().max(100).optional(),
  elementLabelText: z.string().max(500).optional(),
  componentName: z.string().max(200).optional(),
  issueSummary: z.string().min(5).max(1000),
  issueDetail: z.string().max(4000).optional(),
  activeTemplateProfile: z.string().max(200).optional(),
  activeScenario: z.string().max(200).optional(),
  currentSection: z.string().max(200).optional(),
  // Structural snapshot — MUST NOT contain actual candidate values
  structuralSnapshot: z.record(z.unknown()).optional(),
  highlightedElementId: z.string().max(200).optional(),
  highlightedElementLabel: z.string().max(500).optional(),
});

// ── POST /api/telemetry/issues — report a new issue ──────────────────────
router.post("/issues", async (req, res) => {
  try {
    const body = issueSchema.parse(req.body);
    const user = req.user!;

    // Generate sequential issue ref
    const count = await db.$count(telemetryIssuesTable);
    const issueRef = `ISSUE-${String(count + 1).padStart(4, "0")}`;

    // Build human-readable plain-text log entry
    const nowUtc = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
    const section = body.currentSection ? ` in the ${body.currentSection} section` : "";
    const element = body.elementLabelText ? ` at the "${body.elementLabelText}" field` : body.elementId ? ` on element "${body.elementId}"` : "";
    const plaintextLog =
      `On ${nowUtc}, ${user.username} reported an issue${section}${element} ` +
      `on the ${body.pageTitle} page (route: ${body.currentRoute}). ` +
      `Summary: "${body.issueSummary}". ` +
      `Scenario: ${body.activeScenario ?? "n/a"}. Template: ${body.activeTemplateProfile ?? "n/a"}.`;

    const [issue] = await db.insert(telemetryIssuesTable).values({
      issueRef,
      reportingUserId: user.id,
      reportingUserDisplayName: user.username,
      currentRoute: body.currentRoute,
      pageTitle: body.pageTitle,
      elementId: body.elementId ?? null,
      elementName: body.elementName ?? null,
      elementRole: body.elementRole ?? null,
      elementLabelText: body.elementLabelText ?? null,
      componentName: body.componentName ?? null,
      issueSummary: body.issueSummary,
      issueDetail: body.issueDetail ?? null,
      activeTemplateProfile: body.activeTemplateProfile ?? null,
      activeScenario: body.activeScenario ?? null,
      currentSection: body.currentSection ?? null,
      previewRef: issueRef,
      status: "new",
      appVersion: "1.0.0",
      plaintextLog,
    }).returning();

    // Store structural snapshot if provided
    if (body.structuralSnapshot && issue) {
      await db.insert(issueSnapshotsTable).values({
        issueId: issue.id,
        structuralData: body.structuralSnapshot,
        highlightedElementId: body.highlightedElementId ?? null,
        highlightedElementLabel: body.highlightedElementLabel ?? null,
      });
    }

    auditEvent("ISSUE_REPORTED", {
      reportedBy: user.username,
      issueRef,
      route: body.currentRoute,
      section: body.currentSection ?? null,
      element: body.elementLabelText ?? body.elementId ?? null,
    });

    res.status(201).json({ issueRef, id: issue!.id });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.message }); return;
    }
    req.log.error({ err }, "Failed to create telemetry issue");
    res.status(500).json({ error: "Failed to report issue." });
  }
});

// ── GET /api/telemetry/issues — own issues for recruiters ────────────────
router.get("/issues", async (req, res) => {
  try {
    const { eq } = await import("drizzle-orm");
    const issues = await db
      .select()
      .from(telemetryIssuesTable)
      .where(eq(telemetryIssuesTable.reportingUserId, req.user!.id))
      .orderBy(telemetryIssuesTable.createdAt);
    res.json({ issues });
  } catch (err) {
    res.status(500).json({ error: "Failed to load issues." });
  }
});

export default router;
