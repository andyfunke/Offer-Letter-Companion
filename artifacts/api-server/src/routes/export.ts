/**
 * POST /api/export/docx
 *
 * Accepts pre-rendered offer letter segments from the client, merges them into
 * the stored letterhead .docx template, and returns the resulting file.
 *
 * Request body (JSON):
 *   {
 *     header: {                           // preamble lines (date, name, etc.)
 *       lines: string[]
 *     },
 *     paragraphs: Array<{                 // numbered clauses
 *       segments: Array<{
 *         kind: "text" | "filled" | "unfilled";
 *         value?: string;
 *         token?: string;
 *       }>
 *     }>,
 *     footer: {                           // closing lines
 *       lines: string[]
 *     }
 *   }
 */

import { Router } from "express";
import { z } from "zod";
import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth-guard";
import JSZip from "jszip";

const router = Router();

// ── OOXML helpers ──────────────────────────────────────────────────────────

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function makeRun(text: string, bold = false): string {
  const escaped = xmlEscape(text);
  const space = text.startsWith(" ") || text.endsWith(" ") ? ' xml:space="preserve"' : "";
  if (bold) {
    return `<w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t${space}>${escaped}</w:t></w:r>`;
  }
  return `<w:r><w:t${space}>${escaped}</w:t></w:r>`;
}

type Segment = { kind: string; value?: string; token?: string };

/** Convert a segments array to OOXML runs */
function segmentsToRuns(segments: Segment[]): string {
  return segments
    .map((seg) => {
      if (seg.kind === "text") return makeRun(seg.value ?? "");
      if (seg.kind === "filled") return makeRun(seg.value ?? "", true);
      if (seg.kind === "unfilled") return makeRun(`[${seg.token ?? "?"}]`);
      return "";
    })
    .join("");
}

/** Wrap runs in a paragraph element with optional numbering */
function makeParagraph(inner: string, styleId = "Normal"): string {
  return `<w:p><w:pPr><w:pStyle w:val="${styleId}"/></w:pPr>${inner}</w:p>`;
}

/** A plain text paragraph (single run, no bold) */
function textParagraph(text: string): string {
  return makeParagraph(makeRun(text));
}

/** An empty paragraph (line break) */
function emptyParagraph(): string {
  return `<w:p/>`;
}

// ── Schema ─────────────────────────────────────────────────────────────────

const segmentSchema = z.object({
  kind: z.enum(["text", "filled", "unfilled"]),
  value: z.string().optional(),
  token: z.string().optional(),
});

const exportSchema = z.object({
  header: z.object({ lines: z.array(z.string()) }),
  paragraphs: z.array(z.object({ segments: z.array(segmentSchema) })),
  footer: z.object({ lines: z.array(z.string()) }),
});

// ── Route ──────────────────────────────────────────────────────────────────

router.post("/docx", requireAuth, async (req, res) => {
  try {
    const body = exportSchema.parse(req.body);

    // 1. Load letterhead from DB
    const [setting] = await db
      .select({ valueText: appSettingsTable.valueText })
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, "letterhead"))
      .limit(1);

    if (!setting?.valueText) {
      res.status(404).json({ error: "No letterhead template configured. Upload one in Admin → Letterhead." });
      return;
    }

    // 2. Load the .docx ZIP
    const letterheadBuf = Buffer.from(setting.valueText, "base64");
    const zip = await JSZip.loadAsync(letterheadBuf);

    // 3. Build the new body content
    const bodyParts: string[] = [];

    // Header lines (date, name, address, salutation…)
    for (const line of body.header.lines) {
      if (line === "") {
        bodyParts.push(emptyParagraph());
      } else {
        bodyParts.push(textParagraph(line));
      }
    }

    // Numbered clause paragraphs
    body.paragraphs.forEach((para, idx) => {
      const number = idx + 1;
      const prefix: Segment = { kind: "text", value: `${number}. ` };
      const runs = segmentsToRuns([prefix, ...para.segments]);
      bodyParts.push(makeParagraph(runs));
      bodyParts.push(emptyParagraph());
    });

    // Footer lines
    for (const line of body.footer.lines) {
      if (line === "") {
        bodyParts.push(emptyParagraph());
      } else {
        bodyParts.push(textParagraph(line));
      }
    }

    // 4. Read existing document.xml and inject body content
    const docXmlFile = zip.file("word/document.xml");
    if (!docXmlFile) {
      res.status(500).json({ error: "Malformed letterhead: missing word/document.xml" });
      return;
    }
    const docXml = await docXmlFile.async("string");

    // Replace the body content: keep <w:body> open tag and <w:sectPr>…</w:body>, replace everything in between
    const sectPrMatch = docXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
    const sectPr = sectPrMatch ? sectPrMatch[0] : "";

    const bodyStart = docXml.indexOf("<w:body>") + "<w:body>".length;
    const bodyContent = bodyParts.join("") + sectPr;
    const newDocXml =
      docXml.slice(0, docXml.indexOf("<w:body>") + "<w:body>".length) +
      bodyContent +
      "</w:body></w:document>";

    // Verify we didn't corrupt the outer structure
    if (!newDocXml.includes("<w:body>") || !newDocXml.includes("</w:body>")) {
      res.status(500).json({ error: "Failed to generate document structure." });
      return;
    }

    // 5. Update the ZIP and return the new .docx
    zip.file("word/document.xml", newDocXml);
    const outputBuf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

    res.set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.set("Content-Disposition", 'attachment; filename="Offer_Letter.docx"');
    res.send(outputBuf);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.issues[0]?.message });
      return;
    }
    console.error("Export error:", err);
    res.status(500).json({ error: "Failed to generate document." });
  }
});

export default router;
