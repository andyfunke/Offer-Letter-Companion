import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./passwords";
import { logger } from "./logger";

export async function bootstrapAdmin(): Promise<void> {
  // Check whether any system_admin exists
  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "system_admin"))
    .limit(1);

  if (existing.length > 0) {
    logger.debug("Bootstrap: system_admin already exists — skipping.");
    return;
  }

  // No admin exists — require env vars
  const username = process.env["BOOTSTRAP_ADMIN_USERNAME"];
  const password = process.env["BOOTSTRAP_ADMIN_PASSWORD"];
  const email = process.env["BOOTSTRAP_ADMIN_EMAIL"];

  if (!username || !password) {
    throw new Error(
      "[BOOTSTRAP] No system_admin exists and BOOTSTRAP_ADMIN_USERNAME / " +
        "BOOTSTRAP_ADMIN_PASSWORD are not set. " +
        "Set these environment variables and restart the server.",
    );
  }

  if (password.length < 12) {
    throw new Error(
      "[BOOTSTRAP] BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters.",
    );
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
    "Bootstrap: created initial system_admin account.",
  );
}
