import React, { useState, useCallback, useRef, DragEvent, ChangeEvent } from 'react';
import { useOfferStore } from '@/hooks/use-offer-store';
import { UploadCloud, FileText, Loader2, MapPin, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

// ── PDF text extraction via pdfjs-dist ──────────────────────────────────────
// Uses each item's Y coordinate to reconstruct real line breaks instead of
// joining the entire page into one flat string.
async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageTexts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items as Array<{ str: string; transform: number[] }>;

    // Group items by rounded Y position so each visual line becomes one entry
    const lineMap = new Map<number, string[]>();
    for (const item of items) {
      if (!item.str.trim()) continue;
      const y = Math.round(item.transform[5]); // transform[5] = y position
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y)!.push(item.str);
    }

    // Sort descending by Y (PDF origin is bottom-left, so larger Y = higher on page)
    const sortedLines = [...lineMap.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, parts]) => parts.join(' ').replace(/\s{2,}/g, ' ').trim())
      .filter(Boolean);

    pageTexts.push(sortedLines.join('\n'));
  }

  return pageTexts.join('\n');
}

// ── DOCX text extraction via mammoth ────────────────────────────────────────
async function extractTextFromDocx(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

// ── Parse candidate fields from plain text ──────────────────────────────────
function parseResumeText(text: string) {
  // Email
  const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : '';

  // Name: take first non-blank line that looks like a personal name (2–4 words, no digits/symbols/geography)
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  let fullName = '';

  // Patterns that indicate the line is NOT a name
  const NOT_NAME = /\d|@|http|\.com|Street|Ave|Blvd|Dr\.|Suite|Floor|P\.?O\.\s*Box|Apt\.?|Unit\s|\bWA\b|\bOR\b|\bCA\b|\bBC\b|\bAB\b|\bON\b|\bNY\b|\bTX\b|\bFL\b|\bCO\b|\bID\b|\bMT\b|\bUT\b|\bNV\b|\bAZ\b|\bNM\b|\bState\b|\bCounty\b|\bCity\b|LinkedIn|GitHub|Portfolio|Summary|Objective|Experience|Education|Skills|References|Profile|Resume|Curriculum|Confidential|Private|Dear\b|Offer|Salary|Position|Letter|Sincerely|Regards|Inc\.|LLC|Corp|Corporation|Gold|Mining|Minerals/i;

  for (const line of lines.slice(0, 12)) {
    const words = line.split(/\s+/);
    if (
      words.length >= 2 &&
      words.length <= 4 &&
      /^[A-ZÀ-Ý]/.test(line) &&           // starts with uppercase
      !/[,|•·–\-\/\\]/.test(line) &&       // no punctuation typical of address/header lines
      !NOT_NAME.test(line)
    ) {
      fullName = line;
      break;
    }
  }

  // Location: look for city/state patterns.
  // NOTE: use [a-zA-Z ]+ (space only, NOT \s) so the match cannot cross a line break
  // and accidentally absorb the candidate's name from the previous line.
  const locationPatterns = [
    // City name: 1-3 words, each word starts with uppercase — prevents absorbing full sentences
    /\b([A-Z][a-zA-Z]+(?:[ \t][A-Z][a-zA-Z]+){0,2}),[ \t]*(BC|AB|ON|QC|SK|MB|NS|NB|PE|NL|YT|NT|NU)\b/,   // Canadian province
    /\b([A-Z][a-zA-Z]+(?:[ \t][A-Z][a-zA-Z]+){0,2}),[ \t]*(WA|OR|CA|AZ|TX|NY|FL|CO|NV|ID|MT|UT|GA|NC|VA|PA|OH|MI|IL|MN|MO|TN|AL|LA|AR|KY|IN|WI|IA|OK|KS|NE|SD|ND|WY|NM|AK|HI|DE|MD|DC|CT|RI|VT|NH|ME|WV|MS)\b/,  // US state abbrev
  ];
  let location = '';
  let isCanada = false;
  let isWA = false;

  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) {
      location = match[0];
      const stateOrProvince = match[2].toUpperCase();
      isCanada = ['BC', 'AB', 'ON', 'QC', 'SK', 'MB', 'NS', 'NB', 'PE', 'NL', 'YT', 'NT', 'NU'].includes(stateOrProvince);
      isWA = stateOrProvince === 'WA';
      break;
    }
  }

  // Fallback: look for "Vancouver" or "Toronto" etc
  if (!location) {
    const canadianCities = /\b(Vancouver|Toronto|Calgary|Edmonton|Ottawa|Winnipeg|Quebec|Montreal|Halifax)\b/i;
    const canadianMatch = text.match(canadianCities);
    if (canadianMatch) {
      location = canadianMatch[0];
      isCanada = true;
    }
  }

  return { email, fullName, location, isCanada, isWA };
}

const PARSE_STEPS = [
  'Reading document…',
  'Extracting text content…',
  'Identifying candidate details…',
  'Analyzing location…',
];

export function ResumeUpload() {
  const { state, dispatch } = useOfferStore();
  const resumeData = state.resumeData;

  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseStepIdx, setParseStepIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    setIsProcessing(true);
    setParseStepIdx(0);

    try {
      // Step 1
      setParseStepIdx(0);
      await new Promise(r => setTimeout(r, 300));

      let text = '';
      const ext = file.name.split('.').pop()?.toLowerCase();

      setParseStepIdx(1);
      if (ext === 'pdf') {
        text = await extractTextFromPdf(file);
      } else if (ext === 'docx') {
        text = await extractTextFromDocx(file);
      } else {
        // Try reading as plain text
        text = await file.text();
      }

      setParseStepIdx(2);
      await new Promise(r => setTimeout(r, 200));

      const parsed = parseResumeText(text);

      setParseStepIdx(3);
      await new Promise(r => setTimeout(r, 300));

      dispatch({
        type: 'SET_RESUME_DATA',
        payload: {
          fullName: parsed.fullName || '',
          email: parsed.email || '',
          location: parsed.location || '',
          isCanada: parsed.isCanada,
          isWA: parsed.isWA,
        },
      });
    } catch (err: any) {
      setError(`Could not parse file: ${err?.message ?? 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [dispatch]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleContinue = () => dispatch({ type: 'SET_STEP', payload: 'form' });

  // ── Parsed result view ───────────────────────────────────────────────────
  if (resumeData) {
    const hasLocation = Boolean(resumeData.location);
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-lg"
        >
          <Card className="border-primary/20 shadow-xl shadow-primary/5">
            <CardHeader className="bg-primary/5 border-b border-border/50 pb-4">
              <CardTitle className="flex items-center gap-2 text-primary">
                <FileText className="w-5 h-5" />
                Resume Parsed Successfully
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Name</p>
                  <p className="font-semibold">{resumeData.fullName || <span className="text-muted-foreground italic">Not detected</span>}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Email</p>
                  <p className="font-semibold break-all">{resumeData.email || <span className="text-muted-foreground italic">Not detected</span>}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Detected Location</p>
                  <p className="font-semibold flex items-center gap-1">
                    {hasLocation ? (
                      <><MapPin className="w-4 h-4 text-primary shrink-0" /> {resumeData.location}</>
                    ) : (
                      <span className="text-muted-foreground italic">Could not detect location</span>
                    )}
                  </p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                You can correct any field directly in the form. These values are pre-filled but editable.
              </p>

              <div className="flex gap-3 justify-between pt-2">
                <Button variant="outline" onClick={() => dispatch({ type: 'RESET' })}>
                  Upload Different File
                </Button>
                <Button onClick={handleContinue} className="bg-primary hover:bg-primary/90">
                  Continue to Letter Setup
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ── Upload view ──────────────────────────────────────────────────────────
  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-background">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl">Start New Offer Letter</CardTitle>
          <p className="text-muted-foreground text-sm mt-2">
            Upload the candidate's resume to auto-fill details and configure initial letter constraints.
          </p>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {/* Hidden file input — triggered explicitly via ref.click() for iframe compatibility */}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt"
            className="sr-only"
            onChange={handleFileChange}
            disabled={isProcessing}
            tabIndex={-1}
          />
          <div
            role="button"
            tabIndex={0}
            onClick={() => { if (!isProcessing) inputRef.current?.click(); }}
            onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !isProcessing) inputRef.current?.click(); }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={[
              'w-full flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl transition-all duration-200 select-none',
              isProcessing
                ? 'border-primary/30 bg-accent/5 cursor-default pointer-events-none'
                : isDragging
                ? 'border-primary bg-primary/10 scale-[1.01] cursor-copy'
                : 'border-primary/30 bg-accent/5 hover:bg-accent/10 hover:border-primary/60 cursor-pointer',
            ].join(' ')}
          >

            {isProcessing ? (
              <div className="flex flex-col items-center text-primary space-y-4">
                <Loader2 className="w-12 h-12 animate-spin" />
                <div className="text-sm font-medium text-center">
                  {PARSE_STEPS[parseStepIdx]}
                </div>
              </div>
            ) : isDragging ? (
              <div className="flex flex-col items-center text-primary space-y-3">
                <UploadCloud className="w-12 h-12" />
                <p className="font-medium">Drop to upload</p>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <UploadCloud className="w-8 h-8 text-primary" />
                </div>
                <p className="font-medium text-foreground mb-1">Click to browse or drag &amp; drop</p>
                <p className="text-xs text-muted-foreground">PDF or DOCX up to 10 MB</p>
              </>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="text-center pt-1">
            <button
              id="skip-resume-upload"
              type="button"
              onClick={handleContinue}
              className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
            >
              Skip — I'll enter candidate details manually
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
