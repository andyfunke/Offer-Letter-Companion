import { db, usersTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { hashPassword } from "./passwords";
import { logger } from "./logger";

export async function bootstrapAdmin(): Promise<void> {
  // Check whether any user exists at all
  const [{ value: userCount }] = await db
    .select({ value: count() })
    .from(usersTable);

  if (userCount > 0) {
    logger.debug("Bootstrap: users already exist — skipping env-var bootstrap.");
    return;
  }

  // No users at all — check if env vars are provided for automated bootstrap
  const username = process.env["BOOTSTRAP_ADMIN_USERNAME"];
  const password = process.env["BOOTSTRAP_ADMIN_PASSWORD"];
  const email = process.env["BOOTSTRAP_ADMIN_EMAIL"];

  if (!username || !password) {
    // No env vars — that's fine; the in-app setup screen will handle it
    logger.info(
      "Bootstrap: no users exist and no BOOTSTRAP_ADMIN env vars set. " +
        "The in-app setup wizard will create the first account.",
    );
    return;
  }

  if (password.length < 12) {
    logger.warn(
      "[BOOTSTRAP] BOOTSTRAP_ADMIN_PASSWORD is shorter than 12 characters — skipping env-var bootstrap. " +
        "Use the in-app setup screen instead.",
    );
    return;
  }

  const passwordHash = await hashPassword(password);

  await db.insert(usersTable).values({
    username,
    email: email ?? null,
    passwordHash,
    role: "system_admin",
    isActive: true,
    isBootstrapAdmin: true,
  });

  logger.info(
    { username },
    "Bootstrap: created initial system_admin account from environment variables.",
  );
}
