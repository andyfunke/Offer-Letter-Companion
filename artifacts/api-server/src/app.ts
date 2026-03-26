// Security config is validated at import time — server refuses to start if
// required environment variables are missing.
import "./config/security";

import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  helmetMiddleware,
  corsOptions,
  apiRateLimiter,
  inputSanitizer,
  requestSizeGuard,
  securityNoticeHeader,
} from "./middleware/security";
import { auditLogger } from "./middleware/audit";
import { MAX_JSON_BODY_SIZE, SECURITY_CONFIG } from "./config/security";

const app: Express = express();

// ── 1. Security headers (must be first) ──────────────────────────────────
app.use(helmetMiddleware);
app.use(securityNoticeHeader);

// ── 2. CORS ───────────────────────────────────────────────────────────────
app.use(cors(corsOptions()));

// ── 3. Request logging (redacts auth/cookie headers) ─────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          // Strip query string so no PII leaks via URL params
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── 4. Body parsing with strict size limits ───────────────────────────────
app.use(express.json({ limit: MAX_JSON_BODY_SIZE }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));

// ── 5. Request size guard ─────────────────────────────────────────────────
app.use(requestSizeGuard);

// ── 6. Input sanitization (HTML / null-byte stripping) ───────────────────
app.use(inputSanitizer);

// ── 7. Rate limiting ──────────────────────────────────────────────────────
app.use("/api", apiRateLimiter);

// ── 8. Audit logging for sensitive operations ─────────────────────────────
app.use(auditLogger);

// ── 9. Routes ─────────────────────────────────────────────────────────────
app.use("/api", router);

// ── 10. Security config endpoint (non-sensitive summary only) ─────────────
app.get("/api/security/config-summary", (_req, res) => {
  res.json({
    rateLimitWindowMs: SECURITY_CONFIG.rateLimitWindowMs,
    rateLimitMaxRequests: SECURITY_CONFIG.rateLimitMaxRequests,
    maxFileSizeMB: Math.round(SECURITY_CONFIG.maxFileSizeBytes / 1048576),
    sessionTTLHours: Math.round(SECURITY_CONFIG.sessionTTLSeconds / 3600),
    documentRetentionHours: SECURITY_CONFIG.documentRetentionHours,
    resumeRetentionHours: SECURITY_CONFIG.resumeRetentionHours,
    encryptionEnabled: SECURITY_CONFIG.encryptionEnabled,
    allowedFileTypes: Array.from(SECURITY_CONFIG.allowedExtensions),
    environment: SECURITY_CONFIG.isProduction ? "production" : "development",
  });
});

// ── 11. Global error handler ──────────────────────────────────────────────
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    logger.error({ err: { message: err.message, name: err.name } }, "Unhandled error");
    // Never expose stack traces in production
    const message = SECURITY_CONFIG.isProduction
      ? "An unexpected error occurred."
      : err.message;
    res.status(500).json({ error: message });
  },
);

export default app;
