import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { type Request, type Response, type NextFunction } from "express";
import { SECURITY_CONFIG, MAX_JSON_BODY_SIZE } from "../config/security";

// ── Helmet — security headers ─────────────────────────────────────────────
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],  // inline for Vite HMR in dev
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // relaxed for Replit iframe preview
  frameguard: { action: "sameorigin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  hidePoweredBy: true,
});

// ── CORS — restrict origins in production ────────────────────────────────
export function corsOptions() {
  const allowed = SECURITY_CONFIG.allowedOrigins;
  return {
    origin:
      allowed === "*"
        ? true
        : (
            origin: string | undefined,
            cb: (err: Error | null, allow?: boolean) => void,
          ) => {
            if (!origin || allowed.split(",").includes(origin)) cb(null, true);
            else cb(new Error("CORS: origin not allowed"));
          },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
    credentials: true,
    maxAge: 600,
  };
}

// ── General API rate limiter ──────────────────────────────────────────────
export const apiRateLimiter = rateLimit({
  windowMs: SECURITY_CONFIG.rateLimitWindowMs,
  max: SECURITY_CONFIG.rateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait and try again." },
  skip: (req) => req.method === "OPTIONS",
});

// ── Stricter limiter for write operations ────────────────────────────────
export const writeRateLimiter = rateLimit({
  windowMs: SECURITY_CONFIG.rateLimitWindowMs,
  max: SECURITY_CONFIG.uploadRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Write rate limit exceeded. Please slow down." },
});

// ── Input sanitization — strip HTML tags from all string values ──────────
function sanitizeValue(val: unknown): unknown {
  if (typeof val === "string") {
    // Remove HTML tags and null bytes, trim whitespace
    return val.replace(/<[^>]*>/g, "").replace(/\0/g, "").trim();
  }
  if (Array.isArray(val)) return val.map(sanitizeValue);
  if (val && typeof val === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out[k] = sanitizeValue(v);
    }
    return out;
  }
  return val;
}

export function inputSanitizer(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body);
  }
  next();
}

// ── Request size guard (belt + suspenders beyond express.json limit) ──────
export function requestSizeGuard(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const maxBytes = SECURITY_CONFIG.maxFileSizeBytes;
  const contentLength = parseInt(req.headers["content-length"] ?? "0", 10);
  if (contentLength > maxBytes) {
    res.status(413).json({ error: "Request entity too large." });
    return;
  }
  next();
}

// ── Security notice header on every response ─────────────────────────────
export function securityNoticeHeader(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  res.setHeader("X-Internal-Tool", "Kinross-Offer-Letter-Companion");
  res.setHeader("X-Data-Classification", "Confidential-PII");
  next();
}
