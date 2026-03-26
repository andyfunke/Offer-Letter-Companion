import { pgTable, serial, integer, jsonb, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const offerDraftsTable = pgTable("offer_drafts", {
  id: serial("id").primaryKey(),
  templateProfileId: integer("template_profile_id"),
  formData: jsonb("form_data").notNull().$type<Record<string, unknown>>(),
  fieldStates: jsonb("field_states").notNull().$type<Record<string, string>>(),
  resolvedClauses: jsonb("resolved_clauses").notNull().$type<Array<Record<string, unknown>>>(),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOfferDraftSchema = createInsertSchema(offerDraftsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOfferDraft = z.infer<typeof insertOfferDraftSchema>;
export type OfferDraft = typeof offerDraftsTable.$inferSelect;
