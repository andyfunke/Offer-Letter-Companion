import { db, usersTable, ptoOptionsTable } from "@workspace/db";
import { eq, count, sql, inArray } from "drizzle-orm";
import { hashPassword } from "./passwords";
import { logger } from "./logger";

const SEEDED_USERS = [
  {
    username: "AndyFunke",
    email: "andy.funke@kinross.com",
    password: "wemineforgold",
    role: "admin" as const,
    site: "echo_bay",
  },
];

const SEEDED_PTO_OPTIONS = [96, 120, 136, 160, 176, 200, 216];

export async function ensureSeededUsers(): Promise<void> {
  for (const u of SEEDED_USERS) {
    const [existing] = await db
      .select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable)
      .where(eq(sql`lower(${usersTable.username})`, u.username.toLowerCase()))
      .limit(1);
    if (!existing) {
      const passwordHash = await hashPassword(u.password);
      await db.insert(usersTable).values({
        username: u.username,
        email: u.email,
        passwordHash,
        role: u.role,
        site: u.site,
        isActive: true,
        mustResetPassword: false,
      });
      logger.info({ username: u.username }, "Seeded required user account.");
    } else if (!existing.email) {
      // Backfill email if missing
      await db.update(usersTable).set({ email: u.email }).where(eq(usersTable.id, existing.id));
      logger.info({ username: u.username }, "Backfilled email for seeded user.");
    }
  }
}

export async function ensurePtoOptions(): Promise<void> {
  const existing = await db.select({ value: ptoOptionsTable.value }).from(ptoOptionsTable);
  const existingValues = new Set(existing.map(o => o.value));
  const missing = SEEDED_PTO_OPTIONS.filter(v => !existingValues.has(v));
  if (missing.length > 0) {
    await db.insert(ptoOptionsTable).values(missing.map(value => ({ value })));
    logger.info({ missing }, "Seeded missing PTO options.");
  }
}

// Migrate legacy role names to the canonical user/admin model
export async function migrateRoles(): Promise<void> {
  await db.update(usersTable)
    .set({ role: "admin" })
    .where(inArray(usersTable.role, ["system_admin", "hr_admin"] as any[]));
  await db.update(usersTable)
    .set({ role: "user" })
    .where(eq(usersTable.role, "recruiter" as any));
}

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
