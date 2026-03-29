/**
 * POST /api/export/docx
 *
 * Accepts pre-rendered offer letter segments from the client, merges them into
 * the stored letterhead .docx template, and returns the resulting file.
 *
 * Font: Arial 10pt throughout (sz=20 in OOXML half-points).
 *
 * Request body (JSON):
 *   {
 *     header: { lines: string[] },
 *     paragraphs: Array<{ segments: Array<{ kind, value?, token? }> }>,
 *     footer: { lines: string[] },            // closing paragraphs only
 *     signatureBlock?: {                       // structured two-column signature
 *       hrName: string,   hrTitle: string,
 *       mgmtName: string, mgmtTitle: string,
 *       candidateName: string, year: number
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

const FONT_SZ = 20; // 10pt in half-points

// Compact spacing: line=200 (slightly tighter than single=240) + no paragraph gaps.
// Word's default is line=240 + after=160, giving ~400 twips per paragraph.
// This gives ~200 twips — visually about half the gap without overlapping text.
const SPACING = `<w:spacing w:line="200" w:lineRule="auto" w:before="0" w:after="0"/>`;

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Build run properties (font + size + optional bold) */
function rPr(bold = false, sz = FONT_SZ): string {
  const b = bold ? "<w:b/><w:bCs/>" : "";
  return `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${b}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>`;
}

function makeRun(text: string, bold = false): string {
  const escaped = xmlEscape(text);
  const space = text.startsWith(" ") || text.endsWith(" ") ? ' xml:space="preserve"' : "";
  return `<w:r>${rPr(bold)}<w:t${space}>${escaped}</w:t></w:r>`;
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

/** Wrap runs in a paragraph */
function makeParagraph(inner: string): string {
  return `<w:p><w:pPr><w:pStyle w:val="Normal"/>${SPACING}</w:pPr>${inner}</w:p>`;
}

/** Plain text paragraph. If text contains \n, inserts <w:br/> instead of splitting paragraphs. */
function textParagraph(text: string, bold = false): string {
  if (!text.includes('\n')) return makeParagraph(makeRun(text, bold));
  const lines = text.split('\n');
  const runs = lines.map((l, i) =>
    i === 0
      ? makeRun(l, bold)
      : `<w:r>${rPr(bold)}<w:br/></w:r>${makeRun(l, bold)}`
  ).join('');
  return makeParagraph(runs);
}

/** Empty paragraph / line break */
function emptyParagraph(): string {
  return `<w:p><w:pPr>${SPACING}</w:pPr></w:p>`;
}

/** Paragraph with explicit spacing override (for pPr) */
function spacedParagraph(inner: string, spaceBefore = 0, spaceAfter = 0): string {
  return `<w:p><w:pPr><w:pStyle w:val="Normal"/><w:spacing w:line="200" w:lineRule="auto" w:before="${spaceBefore}" w:after="${spaceAfter}"/></w:pPr>${inner}</w:p>`;
}

// ── Two-column signature table ─────────────────────────────────────────────
interface SigBlock {
  hrName: string;
  hrTitle: string;
  mgmtName: string;
  mgmtTitle: string;
  candidateName: string;
  year: number;
}

function makeSignatureTable(sig: SigBlock): string {
  const colW = 4500; // ~half page each in twips
  const noBorder = `<w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>`;

  const tblPr = `<w:tblPr><w:tblStyle w:val="TableNormal"/><w:tblW w:w="${colW * 2}" w:type="dxa"/><w:tblBorders>${noBorder}</w:tblBorders><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="144" w:type="dxa"/></w:tblCellMar></w:tblPr>`;
  const tblGrid = `<w:tblGrid><w:gridCol w:w="${colW}"/><w:gridCol w:w="${colW}"/></w:tblGrid>`;

  function tcPr(): string {
    return `<w:tcPr><w:tcW w:w="${colW}" w:type="dxa"/><w:tcBorders>${noBorder}</w:tcBorders></w:tcPr>`;
  }

  // Blank lines for signing space (6 empty paragraphs each)
  const sigSpace = Array(6).fill(emptyParagraph()).join("");

  function sigCell(name: string, title: string): string {
    return `<w:tc>${tcPr()}${sigSpace}${textParagraph(name, true)}${textParagraph(title)}</w:tc>`;
  }

  const sigRow = `<w:tr>${sigCell(sig.hrName, sig.hrTitle)}${sigCell(sig.mgmtName, sig.mgmtTitle)}</w:tr>`;

  return `<w:tbl>${tblPr}${tblGrid}${sigRow}</w:tbl>`;
}

// ── Schema ─────────────────────────────────────────────────────────────────

const segmentSchema = z.object({
  kind: z.enum(["text", "filled", "unfilled"]),
  value: z.coerce.string().optional(),
  token: z.coerce.string().optional(),
});

const signatureBlockSchema = z.object({
  hrName: z.string(),
  hrTitle: z.string(),
  mgmtName: z.string(),
  mgmtTitle: z.string(),
  candidateName: z.string(),
  year: z.coerce.number().int(),
}).optional();

const exportSchema = z.object({
  header: z.object({ lines: z.array(z.string()) }),
  paragraphs: z.array(z.object({ segments: z.array(segmentSchema) })),
  footer: z.object({ lines: z.array(z.string()) }),
  signatureBlock: signatureBlockSchema,
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
      bodyParts.push(line === "" ? emptyParagraph() : textParagraph(line));
    }

    // Numbered clause paragraphs
    body.paragraphs.forEach((para, idx) => {
      const number = idx + 1;
      const prefix: Segment = { kind: "text", value: `${number}. ` };
      const runs = segmentsToRuns([prefix, ...para.segments]);
      bodyParts.push(makeParagraph(runs));
      bodyParts.push(emptyParagraph());
    });

    // Footer lines (closing paragraph / contact)
    for (const line of body.footer.lines) {
      bodyParts.push(line === "" ? emptyParagraph() : textParagraph(line));
    }

    // ── Signature block ──────────────────────────────────────────────────
    const sig = body.signatureBlock;
    if (sig) {
      // "Sincerely,"
      bodyParts.push(emptyParagraph());
      bodyParts.push(textParagraph("Sincerely,"));
      bodyParts.push(emptyParagraph());

      // Two-column table: HR (left) + Management (right)
      bodyParts.push(makeSignatureTable(sig));

      // Acceptance statement
      bodyParts.push(emptyParagraph());
      bodyParts.push(emptyParagraph());
      bodyParts.push(textParagraph(
        `The above terms and conditions of employment are acceptable to me, dated this date of __________________ ${sig.year}.`
      ));

      // Candidate signature line + name
      bodyParts.push(emptyParagraph());
      bodyParts.push(emptyParagraph());
      bodyParts.push(emptyParagraph());
      bodyParts.push(textParagraph("__________________________"));
      bodyParts.push(textParagraph(sig.candidateName, true));
    } else {
      // Fallback: plain Sincerely block (no signatureBlock supplied)
      bodyParts.push(emptyParagraph());
      bodyParts.push(textParagraph("Sincerely,"));
    }

    // 4. Read existing document.xml and inject body content
    const docXmlFile = zip.file("word/document.xml");
    if (!docXmlFile) {
      res.status(500).json({ error: "Malformed letterhead: missing word/document.xml" });
      return;
    }
    const docXml = await docXmlFile.async("string");

    // Replace the body content; keep <w:sectPr>…</w:body>
    const sectPrMatch = docXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
    const sectPr = sectPrMatch ? sectPrMatch[0] : "";

    const newDocXml =
      docXml.slice(0, docXml.indexOf("<w:body>") + "<w:body>".length) +
      bodyParts.join("") +
      sectPr +
      "</w:body></w:document>";

    if (!newDocXml.includes("<w:body>") || !newDocXml.includes("</w:body>")) {
      res.status(500).json({ error: "Failed to generate document structure." });
      return;
    }

    // 5. Update the ZIP and return
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
