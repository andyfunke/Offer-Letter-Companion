import app from "./app";
import { logger } from "./lib/logger";
import { bootstrapAdmin } from "./lib/bootstrap";
import { purgeExpiredSessions } from "./lib/session";

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

// ── Purge expired sessions once on startup, then every hour ───────────────
purgeExpiredSessions().catch(() => {});
setInterval(() => purgeExpiredSessions().catch(() => {}), 60 * 60 * 1000);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});
