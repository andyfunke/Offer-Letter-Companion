import { type Request, type Response, type NextFunction } from "express";
import { logger } from "../lib/logger";

// ── PII field names that must be redacted from audit logs ─────────────────
const PII_KEYS = new Set([
  "candidate_full_name",
  "candidate_email",
  "annual_salary_input",
  "hourly_rate_input",
  "relocation_amount",
  "compensation",
  "email",
  "name",
  "full_name",
  "resumeText",
  "resume_text",
]);

function redact(obj: unknown, depth = 0): unknown {
  if (depth > 6) return "[deep]";
  if (typeof obj === "string") return obj.length > 80 ? obj.slice(0, 80) + "…" : obj;
  if (Array.isArray(obj)) return `[Array(${obj.length})]`;
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = PII_KEYS.has(k) ? "[REDACTED]" : redact(v, depth + 1);
    }
    return out;
  }
  return obj;
}

// ── Sensitive operations that trigger a dedicated audit log entry ──────────
const SENSITIVE_PATTERNS: Array<{ method: string; pathPattern: RegExp; label: string }> = [
  { method: "POST", pathPattern: /\/api\/offers/, label: "OFFER_DRAFT_CREATED" },
  { method: "PUT",  pathPattern: /\/api\/offers/, label: "OFFER_DRAFT_UPDATED" },
  { method: "DELETE", pathPattern: /\/api\/offers/, label: "OFFER_DRAFT_DELETED" },
  { method: "POST", pathPattern: /\/api\/templates/, label: "TEMPLATE_CREATED" },
  { method: "PUT",  pathPattern: /\/api\/templates/, label: "TEMPLATE_UPDATED" },
  { method: "DELETE", pathPattern: /\/api\/templates/, label: "TEMPLATE_DELETED" },
];

export function auditLogger(req: Request, res: Response, next: NextFunction) {
  const match = SENSITIVE_PATTERNS.find(
    (p) => p.method === req.method && p.pathPattern.test(req.url),
  );

  if (!match) return next();

  const start = Date.now();
  const originalEnd = res.end.bind(res);

  // Intercept response end to capture status code
  res.end = function (
    this: Response,
    ...args: Parameters<typeof res.end>
  ): typeof res {
    const duration = Date.now() - start;
    logger.info({
      audit: true,
      event: match.label,
      method: req.method,
      path: req.url,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip,
      userAgent: req.headers["user-agent"] ?? "unknown",
      body: redact(req.body),
    });
    return originalEnd(...args);
  } as typeof res.end;

  next();
}

// ── Explicit helper for logging security-sensitive events ─────────────────
export function auditEvent(
  event: string,
  details: Record<string, unknown> = {},
) {
  logger.info({
    audit: true,
    event,
    timestamp: new Date().toISOString(),
    details: redact(details),
  });
}
