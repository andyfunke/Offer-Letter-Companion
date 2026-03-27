import { Shield, Lock, Database, FileText, AlertTriangle, CheckCircle, Server, Code } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiBase } from "../hooks/use-auth";

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <section className="mb-8 border rounded-xl overflow-hidden bg-card">
      <div className="flex items-center gap-3 px-5 py-4 bg-slate-50 border-b">
        <Icon className="w-5 h-5 text-primary" />
        <h2 className="font-mono font-semibold text-sm uppercase tracking-wide text-foreground">{title}</h2>
      </div>
      <div className="p-5 space-y-2 text-sm text-muted-foreground font-mono">{children}</div>
    </section>
  );
}

function Row({ label, value, redacted }: { label: string; value: React.ReactNode; redacted?: boolean }) {
  return (
    <div className="flex gap-4 py-1.5 border-b border-dashed border-border/40 last:border-0">
      <span className="w-56 shrink-0 text-foreground font-medium">{label}</span>
      <span className={redacted ? "text-amber-600" : ""}>{value}</span>
    </div>
  );
}

function Gap({ label, severity }: { label: string; severity: "low" | "medium" | "high" }) {
  const color = severity === "high" ? "text-red-600 bg-red-50 border-red-200"
    : severity === "medium" ? "text-amber-600 bg-amber-50 border-amber-200"
    : "text-muted-foreground bg-muted border-border";
  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${color}`}>
      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      <span>{label}</span>
    </div>
  );
}

function Resolved({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg border text-xs text-green-700 bg-green-50 border-green-200">
      <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      <span>{label}</span>
    </div>
  );
}

export default function AdminSecuritySpec() {
  const { data: config } = useQuery({
    queryKey: ["security-config"],
    queryFn: () => fetch(`${apiBase()}/security/config-summary`, { credentials: "include" }).then((r) => r.json()),
    retry: false,
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="w-6 h-6 text-primary" />
            <div>
              <h1 className="font-mono font-bold text-xl text-foreground">Technical Security Specification</h1>
              <p className="text-xs text-muted-foreground">INTERNAL / ADMIN ONLY — Kinross Offer Letter Companion</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/security" className="text-sm text-primary hover:underline">Public policy →</Link>
            <Link href="/" className="text-sm text-muted-foreground hover:underline">← App</Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">

        <div className="flex items-start gap-3 p-4 mb-8 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
          <p>
            <strong>INTERNAL DOCUMENT.</strong> This page documents security implementation details.
            Do not share publicly. Not for external distribution.
          </p>
        </div>

        {/* A. Encryption */}
        <Section title="A. Encryption" icon={Lock}>
          <Row label="Algorithm" value="AES-256-GCM (PostgreSQL hosting layer)" />
          <Row label="In-transit" value="TLS 1.2+ enforced by hosting (Replit HTTPS proxy)" />
          <Row label="At-rest" value="PostgreSQL encryption-at-rest via hosting environment" />
          <Row label="Key management" value="Environment secrets (DATABASE_URL, not in source)" redacted />
          <Row label="Encrypted fields" value="All DB rows via hosting layer; no application-level column encryption currently (see Known Gaps)" />
          <Row label="Password hashing" value="bcrypt, cost factor 12 — passwords never stored in plaintext" />
          <Row label="Session token storage" value="SHA-256 hash of token stored in DB — raw token never persisted" />
          <Row label="Log redaction" value="PII fields redacted before writing to pino logger" />
        </Section>

        {/* B. Authentication */}
        <Section title="B. Authentication" icon={Shield}>
          <Row label="Auth model" value="Session-based — bcrypt password verification on login" />
          <Row label="Session token" value="256-bit random token (crypto.randomBytes(32)), SHA-256 hashed for DB storage" />
          <Row label="Cookie name" value="kol_session" />
          <Row label="Cookie flags" value="httpOnly=true, sameSite=strict, secure (in production)" />
          <Row label="Session store" value="PostgreSQL sessionsTable — server-side, remotely invalidatable" />
          <Row label="Session TTL" value={config ? `${config.sessionTTLHours}h (server config)` : "8 hours (default)"} />
          <Row label="Login rate limit" value="5 attempts per 15 minutes per IP — HTTP 429 on breach" />
          <Row label="Timing safety" value="Dummy bcrypt compare on unknown username to prevent user enumeration" />
          <Row label="First-login flow" value="Blank-password accounts require password reset on first login" />
          <Row label="Logout" value="Session token deleted from DB on POST /api/auth/logout" />
          <Row label="Godmode" value="Internal debug bypass — logged as GODMODE_LOGIN audit event each use" redacted />
        </Section>

        {/* C. Authorization */}
        <Section title="C. Authorization Model" icon={Shield}>
          <Row label="RBAC roles" value="viewer → hr_user → hr_admin → system_admin (hierarchical)" />
          <Row label="API enforcement" value="requireAuth + requireRole middleware on all protected endpoints" />
          <Row label="Admin API routes" value="/api/admin/* — requireRole('hr_admin') or requireRole('system_admin')" />
          <Row label="Security spec page" value="/admin/security-spec — RequireAuth('system_admin') frontend + server-side requireRole gate on config endpoint" />
          <Row label="AUTHZ failures" value="HTTP 403 returned; AUTHZ_FAILURE audit event logged with userId, role, path" />
          <Row label="Frontend gate" value="<RequireAuth minRole=…> wrapper — server-side is authoritative, frontend is UX only" />
        </Section>

        {/* D. Audit Logging */}
        <Section title="D. Audit Logging" icon={Database}>
          <Row label="Logged events" value="LOGIN_SUCCESS, LOGIN_FAILURE, LOGOUT, GODMODE_LOGIN, AUTHZ_FAILURE, PASSWORD_SET, OFFER_DRAFT_CREATED, OFFER_DRAFT_UPDATED, OFFER_DRAFT_DELETED, TEMPLATE_CREATED, TEMPLATE_UPDATED, TEMPLATE_DELETED, USER_CREATED, USER_UPDATED" />
          <Row label="Redacted fields" value="candidate_full_name, candidate_email, annual_salary_input, hourly_rate_input, relocation_amount, email, passwordHash" />
          <Row label="Storage" value="pino structured JSON logs — routed to stdout for hosting-layer capture" />
          <Row label="Immutability" value="Log rotation handled by hosting infrastructure; append-only in application layer" />
          <Row label="Audit flag" value='All audit entries carry { audit: true } field for easy filtering' />
        </Section>

        {/* E. File Security */}
        <Section title="E. File Security" icon={FileText}>
          <Row label="Storage" value="Browser memory only — resume files never transmitted to server" />
          <Row label="Allowed types" value={config ? config.allowedFileTypes.join(", ") : ".pdf, .docx, .doc, .txt"} />
          <Row label="Max file size" value={config ? `${config.maxFileSizeMB} MB` : "10 MB"} />
          <Row label="MIME validation" value="Client-side extension + MIME type check; document parsing validates structure" />
          <Row label="Deletion lifecycle" value="In-browser files released when session is cleared or browser tab closed" />
          <Row label="Server upload" value="No file upload endpoints exist — parsing is entirely client-side" />
        </Section>

        {/* F. Validation */}
        <Section title="F. Input Validation" icon={Code}>
          <Row label="Schema validation" value="Zod schemas on all API request bodies (api-zod package)" />
          <Row label="Sanitization" value="All string inputs: HTML tag stripping, null-byte removal, whitespace trim" />
          <Row label="Body size limit" value={`${MAX_JSON_BODY_SIZE} JSON / 256 KB URL-encoded (express middleware)`} />
          <Row label="Parameterized queries" value="All DB queries via Drizzle ORM — no string interpolation" />
          <Row label="Enforcement" value="Server-side only — client validation is UX only, not trusted" />
        </Section>

        {/* G. Rate Limiting */}
        <Section title="G. Rate Limiting" icon={Shield}>
          <Row label="Window" value={config ? `${config.rateLimitWindowMs / 1000}s` : "60s"} />
          <Row label="Max requests (general)" value={config ? String(config.rateLimitMaxRequests) : "120 req/window"} />
          <Row label="Login endpoint" value="5 req / 15 min per IP (strict limiter)" />
          <Row label="Max writes" value="20 write ops/window" />
          <Row label="Enforcement" value="express-rate-limit on /api/* — standard headers returned" />
          <Row label="Response" value='HTTP 429 with { "error": "Too many requests…" }' />
        </Section>

        {/* H. Security Headers */}
        <Section title="H. Security Headers (Helmet)" icon={Shield}>
          <Row label="Content-Security-Policy" value="default-src 'self'; frame-src 'none'; object-src 'none'" />
          <Row label="Strict-Transport-Security" value="max-age=31536000; includeSubDomains; preload" />
          <Row label="X-Frame-Options" value="SAMEORIGIN" />
          <Row label="X-Content-Type-Options" value="nosniff" />
          <Row label="Referrer-Policy" value="strict-origin-when-cross-origin" />
          <Row label="X-Powered-By" value="Removed (hidePoweredBy: true)" />
          <Row label="X-XSS-Protection" value="Enabled (legacy browsers)" />
          <Row label="Data classification header" value="X-Data-Classification: Confidential-PII (all responses)" />
        </Section>

        {/* I. Retention */}
        <Section title="I. Retention Engine" icon={Database}>
          <Row label="Resume text" value={config ? `${config.resumeRetentionHours}h in browser session; not stored server-side` : "1h in browser session"} />
          <Row label="Draft documents" value={config ? `${config.documentRetentionHours}h (DB) — auto-purged by server job` : "24h (DB) — auto-purged hourly"} />
          <Row label="Sessions" value={config ? `${config.sessionTTLHours}h TTL — auto-purged hourly` : "8h TTL — auto-purged hourly"} />
          <Row label="Purge mechanism" value="setInterval purge job runs every hour on server startup — removes expired sessions and old drafts" />
          <Row label="Override" value="HR can delete drafts at any time via draft management UI" />
        </Section>

        {/* J. OWASP Mapping */}
        <Section title="J. OWASP Top 10 Coverage" icon={CheckCircle}>
          <Row label="A01 Broken Access Control" value="Session-based auth; RBAC enforced server-side on all protected routes; 403 on failure" />
          <Row label="A02 Cryptographic Failures" value="TLS in transit; DB encryption at rest; bcrypt pw hashing; SHA-256 session token hashing; PII log redaction" />
          <Row label="A03 Injection" value="Drizzle ORM parameterized queries; HTML sanitization on all inputs; Zod schema validation" />
          <Row label="A04 Insecure Design" value="Security-first defaults; fail-closed on missing config; no stack traces in production" />
          <Row label="A05 Security Misconfiguration" value="Helmet headers; debug disabled in production; no stack traces in prod; PORT/DB required env vars" />
          <Row label="A06 Vulnerable Components" value="Pinned dependencies; pnpm audit available" />
          <Row label="A07 Auth Failures" value="bcrypt + session store + rate limiting on login; timing-safe user lookup; httpOnly session cookies" />
          <Row label="A08 Software/Data Integrity" value="Zod schema validation on all structured inputs; no eval or dynamic code execution" />
          <Row label="A09 Logging Failures" value="Structured audit logging; PII redaction; all auth and sensitive ops logged with { audit: true }" />
          <Row label="A10 SSRF" value="No server-side URL fetching; file parsing is entirely client-side" />
        </Section>

        {/* K. Known Gaps */}
        <Section title="K. Known Limitations & Gaps" icon={AlertTriangle}>
          <div className="space-y-2">
            <Gap severity="medium" label="No application-level column encryption — sensitive DB fields (salary, compensation) rely on hosting-layer encryption only; no per-column AES encryption." />
            <Gap severity="low" label="Dependency audit (pnpm audit) not automated in CI pipeline — should be added as a pre-deploy step for production." />
            <Resolved label="Application-level authentication — session-based auth with bcrypt, DB session store, httpOnly cookie, and RBAC middleware. Fully implemented." />
            <Resolved label="/admin/security-spec auth gate — requireAuth + requireRole('system_admin') added to /api/security/config-summary endpoint; frontend gated by RequireAuth." />
            <Resolved label="Server-side session store — sessions stored in PostgreSQL sessionsTable; can be remotely invalidated; tokens SHA-256 hashed at rest." />
            <Resolved label="Automated data-purge job — hourly setInterval purges expired sessions and offer drafts older than 24h." />
          </div>
        </Section>

        <div className="border-t pt-6 text-xs text-muted-foreground font-mono">
          <p>Generated: {new Date().toISOString()} · Kinross Offer Letter Companion · INTERNAL ONLY</p>
        </div>
      </div>
    </div>
  );
}

const MAX_JSON_BODY_SIZE = "512kb";
