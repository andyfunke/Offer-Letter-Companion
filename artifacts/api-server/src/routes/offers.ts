import { Router, type IRouter } from "express";
import { db, offerDraftsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { encryptFormData, decryptFormData } from "../lib/field-crypto.js";

const router: IRouter = Router();

const offerBodySchema = z.object({
  templateProfileId: z.number().optional(),
  formData: z.record(z.unknown()),
  fieldStates: z.record(z.string()),
  resolvedClauses: z.array(z.record(z.unknown())),
  status: z.enum(["draft", "generated", "exported"]).default("draft"),
});

function decryptOffer(offer: { formData: Record<string, unknown>; [k: string]: unknown }) {
  return { ...offer, formData: decryptFormData(offer.formData) };
}

router.get("/", async (req, res) => {
  try {
    const offers = await db.select().from(offerDraftsTable).orderBy(offerDraftsTable.updatedAt);
    res.json({ offers: offers.map(decryptOffer) });
  } catch (err) {
    req.log.error({ err }, "Failed to list offers");
    res.status(500).json({ error: "Failed to list offers" });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = offerBodySchema.parse(req.body);
    const [offer] = await db.insert(offerDraftsTable).values({
      templateProfileId: body.templateProfileId ?? null,
      formData: encryptFormData(body.formData),
      fieldStates: body.fieldStates,
      resolvedClauses: body.resolvedClauses,
      status: body.status,
    }).returning();
    res.status(201).json(decryptOffer(offer));
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "Failed to create offer");
    res.status(500).json({ error: "Failed to create offer" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [offer] = await db.select().from(offerDraftsTable).where(eq(offerDraftsTable.id, id));
    if (!offer) {
      res.status(404).json({ error: "Offer not found" });
      return;
    }
    res.json(decryptOffer(offer));
  } catch (err) {
    req.log.error({ err }, "Failed to get offer");
    res.status(500).json({ error: "Failed to get offer" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = offerBodySchema.parse(req.body);
    const [offer] = await db.update(offerDraftsTable)
      .set({
        templateProfileId: body.templateProfileId ?? null,
        formData: encryptFormData(body.formData),
        fieldStates: body.fieldStates,
        resolvedClauses: body.resolvedClauses,
        status: body.status,
        updatedAt: new Date(),
      })
      .where(eq(offerDraftsTable.id, id))
      .returning();
    if (!offer) {
      res.status(404).json({ error: "Offer not found" });
      return;
    }
    res.json(decryptOffer(offer));
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "Failed to update offer");
    res.status(500).json({ error: "Failed to update offer" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(offerDraftsTable).where(eq(offerDraftsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete offer");
    res.status(500).json({ error: "Failed to delete offer" });
  }
});

export default router;
