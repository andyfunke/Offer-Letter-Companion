import app from "./app";
import { logger } from "./lib/logger";
import { bootstrapAdmin, ensureSeededUsers, ensurePtoOptions, migrateRoles } from "./lib/bootstrap";
import { purgeExpiredSessions } from "./lib/session";
import { db, offerDraftsTable } from "@workspace/db";
import { lt } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ── Bootstrap admin account if none exists ────────────────────────────────
try {
  await bootstrapAdmin();
} catch (err) {
  logger.error({ err }, "Bootstrap admin failed — server will not start.");
  process.exit(1);
}

// ── Migrate legacy roles to user/admin model ──────────────────────────────
try {
  await migrateRoles();
} catch (err) {
  logger.warn({ err }, "migrateRoles failed — continuing anyway.");
}

// ── Ensure required seeded accounts exist ─────────────────────────────────
try {
  await ensureSeededUsers();
} catch (err) {
  logger.warn({ err }, "ensureSeededUsers failed — continuing anyway.");
}

// ── Ensure PTO options are seeded ─────────────────────────────────────────
try {
  await ensurePtoOptions();
} catch (err) {
  logger.warn({ err }, "ensurePtoOptions failed — continuing anyway.");
}

// ── Purge expired sessions once on startup, then every hour ───────────────
purgeExpiredSessions().catch(() => {});
setInterval(() => purgeExpiredSessions().catch(() => {}), 60 * 60 * 1000);

// ── Purge old offer drafts (older than 24h) every hour ───────────────────
async function purgeOldDrafts() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    await db.delete(offerDraftsTable).where(lt(offerDraftsTable.createdAt, cutoff));
  } catch (err) {
    logger.warn({ err }, "Draft purge failed — will retry next cycle");
  }
}
purgeOldDrafts().catch(() => {});
setInterval(() => purgeOldDrafts().catch(() => {}), 60 * 60 * 1000);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});
