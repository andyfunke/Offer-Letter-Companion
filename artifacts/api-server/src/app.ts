// Security config validation runs at import — fails fast if required env vars missing
import "./config/security";

import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
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
import { attachUser } from "./middleware/auth-guard";
import { MAX_JSON_BODY_SIZE, SECURITY_CONFIG } from "./config/security";

const app: Express = express();

// Trust the first proxy (Replit's reverse proxy) so rate-limiting uses the
// correct client IP from X-Forwarded-For instead of the proxy IP.
app.set("trust proxy", 1);

// ── 1. Security headers ───────────────────────────────────────────────────
app.use(helmetMiddleware);
app.use(securityNoticeHeader);

// ── 2. CORS ───────────────────────────────────────────────────────────────
app.use(cors(corsOptions()));

// ── 3. Cookie parsing (required for session cookie auth) ──────────────────
app.use(cookieParser());

// ── 4. Request logging ────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) { return { id: req.id, method: req.method, url: req.url?.split("?")[0] }; },
      res(res) { return { statusCode: res.statusCode }; },
    },
  }),
);

// ── 5. Body parsing with size limits ─────────────────────────────────────
app.use(express.json({ limit: MAX_JSON_BODY_SIZE }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));

// ── 6. Request size guard ─────────────────────────────────────────────────
app.use(requestSizeGuard);

// ── 7. Input sanitization ─────────────────────────────────────────────────
app.use(inputSanitizer);

// ── 8. Rate limiting ──────────────────────────────────────────────────────
app.use("/api", apiRateLimiter);

// ── 9. Audit logging ──────────────────────────────────────────────────────
app.use(auditLogger);

// ── 10. Attach authenticated user to every request ────────────────────────
app.use(attachUser);

// ── 11. Routes ────────────────────────────────────────────────────────────
app.use("/api", router);

// ── 12. Security config summary (non-sensitive) ───────────────────────────
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

// ── 13. Global error handler ──────────────────────────────────────────────
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    logger.error({ err: { message: err.message, name: err.name } }, "Unhandled error");
    const message = SECURITY_CONFIG.isProduction ? "An unexpected error occurred." : err.message;
    res.status(500).json({ error: message });
  },
);

export default app;
