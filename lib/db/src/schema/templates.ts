import { pgTable, serial, text, jsonb, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const templateProfilesTable = pgTable("template_profiles", {
  id: serial("id").primaryKey(),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "cascade" }),
  profileName: text("profile_name").notNull(),
  baseScenario: text("base_scenario").notNull(),
  site: text("site"),
  activeFields: jsonb("active_fields").notNull().$type<string[]>(),
  removedFields: jsonb("removed_fields").notNull().$type<string[]>(),
  clauseVariantIds: jsonb("clause_variant_ids").notNull().$type<Record<string, string>>(),
  letterheadId: text("letterhead_id"),
  outputOrder: jsonb("output_order").notNull().$type<string[]>(),
  defaultSigners: jsonb("default_signers").notNull().$type<Record<string, string>>(),
  defaultHrContact: jsonb("default_hr_contact").notNull().$type<Record<string, string>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTemplateProfileSchema = createInsertSchema(templateProfilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTemplateProfile = z.infer<typeof insertTemplateProfileSchema>;
export type TemplateProfile = typeof templateProfilesTable.$inferSelect;
