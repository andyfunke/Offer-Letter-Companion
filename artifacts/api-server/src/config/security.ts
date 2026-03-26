/**
 * Centralized security configuration.
 * The server will refuse to start if any REQUIRED variable is absent.
 */

function require_env(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (!val) {
    throw new Error(
      `[SECURITY] Missing required environment variable: ${key}. Server will not start.`,
    );
  }
  return val;
}

function optional_env(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

// ── Startup validation ────────────────────────────────────────────────────
require_env("DATABASE_URL"); // non-negotiable — DB must be configured
require_env("PORT");         // must have a port

// ── Security constants ────────────────────────────────────────────────────
export const SECURITY_CONFIG = {
  // Session
  sessionTTLSeconds: parseInt(optional_env("SESSION_TTL_SECONDS", "28800"), 10),  // 8 hours
  idleTimeoutSeconds: parseInt(optional_env("IDLE_TIMEOUT_SECONDS", "3600"), 10), // 1 hour

  // Rate limiting
  rateLimitWindowMs: parseInt(optional_env("RATE_LIMIT_WINDOW_MS", "60000"), 10), // 1 min
  rateLimitMaxRequests: parseInt(optional_env("RATE_LIMIT_MAX", "120"), 10),      // 120 req/min
  uploadRateLimitMax: parseInt(optional_env("UPLOAD_RATE_LIMIT_MAX", "20"), 10),  // 20 uploads/min

  // File handling
  maxFileSizeBytes: parseInt(optional_env("MAX_FILE_SIZE_BYTES", "10485760"), 10), // 10 MB
  allowedMimeTypes: new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
  ]),
  allowedExtensions: new Set([".pdf", ".docx", ".doc", ".txt"]),

  // Retention
  sessionDataRetentionHours: parseInt(optional_env("SESSION_RETENTION_HOURS", "8"), 10),
  documentRetentionHours: parseInt(optional_env("DOCUMENT_RETENTION_HOURS", "24"), 10),
  resumeRetentionHours: parseInt(optional_env("RESUME_RETENTION_HOURS", "1"), 10),

  // Encryption (AES-256-GCM via Node crypto — key from env or derived from DB URL hash)
  encryptionEnabled: optional_env("ENCRYPTION_ENABLED", "true") === "true",

  // Audit
  auditLogLevel: optional_env("AUDIT_LOG_LEVEL", "info"),

  // CORS — restrict to known origins in production
  allowedOrigins: optional_env("ALLOWED_ORIGINS", "*"),

  // Environment
  isProduction: process.env["NODE_ENV"] === "production",
} as const;

// ── PII fields that must never appear in logs ─────────────────────────────
export const PII_REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers['set-cookie']",
  "*.candidate_full_name",
  "*.candidate_email",
  "*.annual_salary_input",
  "*.hourly_rate_input",
  "*.relocation_amount",
  "*.compensation",
] as const;

// ── Input size limits ─────────────────────────────────────────────────────
export const MAX_JSON_BODY_SIZE = "512kb";
export const MAX_URL_ENCODED_SIZE = "256kb";
