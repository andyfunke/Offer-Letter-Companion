import {
  pgTable, serial, text, boolean, timestamp, integer, jsonb
} from "drizzle-orm/pg-core";

// ── Users ─────────────────────────────────────────────────────────────────
export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email"),
  passwordHash: text("password_hash").notNull().default(''),
  role: text("role").notNull().default("recruiter"), // recruiter | hr_admin | system_admin
  isActive: boolean("is_active").notNull().default(true),
  isBootstrapAdmin: boolean("is_bootstrap_admin").notNull().default(false),
  mustResetPassword: boolean("must_reset_password").notNull().default(false),
  preferences: jsonb("preferences").default({}).$type<{ lastGoverningState?: string }>(),
  site: text("site"),  // site ID from kinross-sites (e.g. 'echo_bay')
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;

// ── Sessions ──────────────────────────────────────────────────────────────
// tokenHash = SHA-256 of the raw token sent to client; raw token never stored
export const sessionsTable = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});

export type Session = typeof sessionsTable.$inferSelect;

// ── Telemetry Issues ──────────────────────────────────────────────────────
export const telemetryIssuesTable = pgTable("telemetry_issues", {
  id: serial("id").primaryKey(),
  issueRef: text("issue_ref").notNull().unique(), // e.g. ISSUE-0001
  reportingUserId: integer("reporting_user_id").notNull().references(() => usersTable.id),
  reportingUserDisplayName: text("reporting_user_display_name").notNull(),
  currentRoute: text("current_route").notNull(),
  pageTitle: text("page_title").notNull(),
  elementId: text("element_id"),
  elementName: text("element_name"),
  elementRole: text("element_role"),
  elementLabelText: text("element_label_text"),
  componentName: text("component_name"),
  issueSummary: text("issue_summary").notNull(),       // plain-English
  issueDetail: text("issue_detail"),
  activeTemplateProfile: text("active_template_profile"),
  activeScenario: text("active_scenario"),
  currentSection: text("current_section"),
  previewRef: text("preview_ref"),                     // JSON snapshot ref
  status: text("status").notNull().default("new"),     // new|triaged|in_progress|resolved|dismissed
  appVersion: text("app_version").notNull().default("1.0.0"),
  plaintextLog: text("plaintext_log").notNull(),       // human-readable summary sentence
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type TelemetryIssue = typeof telemetryIssuesTable.$inferSelect;
export type InsertTelemetryIssue = typeof telemetryIssuesTable.$inferInsert;

// ── Issue Preview Snapshots ───────────────────────────────────────────────
// Stores sanitized structural snapshots (no live candidate data)
export const issueSnapshotsTable = pgTable("issue_snapshots", {
  id: serial("id").primaryKey(),
  issueId: integer("issue_id").notNull().references(() => telemetryIssuesTable.id, { onDelete: "cascade" }),
  // Structural snapshot: section names, field labels only — NO VALUES
  structuralData: jsonb("structural_data").notNull().$type<Record<string, unknown>>(),
  highlightedElementId: text("highlighted_element_id"),
  highlightedElementLabel: text("highlighted_element_label"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type IssueSnapshot = typeof issueSnapshotsTable.$inferSelect;

// ── Admin Notes (append-only, cannot edit telemetry record) ──────────────
export const adminNotesTable = pgTable("admin_notes", {
  id: serial("id").primaryKey(),
  issueId: integer("issue_id").notNull().references(() => telemetryIssuesTable.id, { onDelete: "cascade" }),
  authorId: integer("author_id").notNull().references(() => usersTable.id),
  authorDisplayName: text("author_display_name").notNull(),
  noteText: text("note_text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AdminNote = typeof adminNotesTable.$inferSelect;

// ── PTO Options (admin-managed list of valid PTO hours values) ─────────────
export const ptoOptionsTable = pgTable("pto_options", {
  id: serial("id").primaryKey(),
  value: integer("value").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PtoOption = typeof ptoOptionsTable.$inferSelect;

// ── App Settings (key/value store for letterhead template etc.) ────────────
export const appSettingsTable = pgTable("app_settings", {
  key: text("key").primaryKey(),
  valueText: text("value_text"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AppSetting = typeof appSettingsTable.$inferSelect;
