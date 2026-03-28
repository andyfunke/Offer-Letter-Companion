import { Router } from "express";
import { db, userInteractionsTable } from "@workspace/db";
import { desc, gte, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middleware/auth-guard";

const router = Router();
router.use(requireAuth, requireRole("admin"));

// GET /api/admin/interactions?limit=100&since=<ISO>
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "200")), 500);
    const since = req.query.since ? new Date(String(req.query.since)) : undefined;

    let query = db
      .select()
      .from(userInteractionsTable)
      .orderBy(desc(userInteractionsTable.createdAt))
      .limit(limit);

    if (since && !isNaN(since.getTime())) {
      query = db
        .select()
        .from(userInteractionsTable)
        .where(gte(userInteractionsTable.createdAt, since))
        .orderBy(desc(userInteractionsTable.createdAt))
        .limit(limit);
    }

    const rows = await query;
    res.json({ interactions: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch interaction log." });
  }
});

export default router;
