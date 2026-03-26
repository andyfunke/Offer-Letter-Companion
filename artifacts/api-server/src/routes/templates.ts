import { Router, type IRouter } from "express";
import { db, templateProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const templateBodySchema = z.object({
  profileName: z.string().min(1),
  baseScenario: z.string().min(1),
  site: z.string().optional(),
  activeFields: z.array(z.string()),
  removedFields: z.array(z.string()),
  clauseVariantIds: z.record(z.string()),
  letterheadId: z.string().optional(),
  outputOrder: z.array(z.string()),
  defaultSigners: z.record(z.string()),
  defaultHrContact: z.record(z.string()),
});

router.get("/", async (req, res) => {
  try {
    const templates = await db.select().from(templateProfilesTable).orderBy(templateProfilesTable.createdAt);
    res.json({ templates });
  } catch (err) {
    req.log.error({ err }, "Failed to list templates");
    res.status(500).json({ error: "Failed to list templates" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = templateBodySchema.parse(req.body);
    const [template] = await db.insert(templateProfilesTable).values({
      ...body,
      site: body.site ?? null,
      letterheadId: body.letterheadId ?? null,
    }).returning();
    res.status(201).json(template);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "Failed to create template");
    res.status(500).json({ error: "Failed to create template" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [template] = await db.select().from(templateProfilesTable).where(eq(templateProfilesTable.id, id));
    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    res.json(template);
  } catch (err) {
    req.log.error({ err }, "Failed to get template");
    res.status(500).json({ error: "Failed to get template" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = templateBodySchema.parse(req.body);
    const [template] = await db.update(templateProfilesTable)
      .set({ ...body, site: body.site ?? null, letterheadId: body.letterheadId ?? null, updatedAt: new Date() })
      .where(eq(templateProfilesTable.id, id))
      .returning();
    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    res.json(template);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "Failed to update template");
    res.status(500).json({ error: "Failed to update template" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(templateProfilesTable).where(eq(templateProfilesTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete template");
    res.status(500).json({ error: "Failed to delete template" });
  }
});

export default router;
