import { Shield, Lock, Database, FileText, AlertTriangle, CheckCircle, Server, Code } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

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

export default function AdminSecuritySpec() {
  const { data: config } = useQuery({
    queryKey: ["security-config"],
    queryFn: () =>
      fetch(
        `${import.meta.env.BASE_URL?.replace(/\/$/, "")}/../api/security/config-summary`.replace("//", "/"),
      ).then((r) => r.json()),
    retry: false,
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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

        {/* Warning */}
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
          <Row label="Encrypted fields" value="All DB rows via hosting layer; no application-level field encryption currently (see Known Gaps)" />
          <Row label="Log redaction" value="PII fields redacted before writing to pino logger" />
        </Section>

        {/* B. Session Management */}
        <Section title="B. Session Management" icon={Shield}>
          <Row label="Session storage" value="React state only (in-browser memory, no cookies, no localStorage)" />
          <Row label="Session TTL" value={config ? `${config.sessionTTLHours}h (server config)` : "8 hours (default)"} />
          <Row label="Idle timeout" value="Session cleared on browser close; no persistent token issued" />
          <Row label="Cookie config" value="No auth cookies issued — internal tool, no user login" />
          <Row label="Rotation" value="State reset on each new letter workflow" />
        </Section>

        {/* C. Authorization */}
        <Section title="C. Authorization Model" icon={Shield}>
          <Row label="Auth model" value="Network-level (internal tool, no public auth system)" />
          <Row label="RBAC" value="Not enforced at application layer — relies on network access control" />
          <Row label="Admin routes" value="/admin/* — no server-side auth gate (see Known Gaps)" />
          <Row label="API routes" value="No bearer token required — internal-only deployment assumed" />
        </Section>

        {/* D. Audit Logging */}
        <Section title="D. Audit Logging" icon={Database}>
          <Row label="Logged events" value="OFFER_DRAFT_CREATED, OFFER_DRAFT_UPDATED, OFFER_DRAFT_DELETED, TEMPLATE_CREATED, TEMPLATE_UPDATED, TEMPLATE_DELETED" />
          <Row label="Redacted fields" value="candidate_full_name, candidate_email, annual_salary_input, hourly_rate_input, relocation_amount, email" />
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
          <Row label="Draft documents" value={config ? `${config.documentRetentionHours}h (DB) unless deleted` : "24h (DB)"} />
          <Row label="Sessions" value={config ? `${config.sessionTTLHours}h TTL` : "8h TTL"} />
          <Row label="Purge mechanism" value="Manual deletion via UI; automatic expiry via session close" />
          <Row label="Override" value="HR can delete drafts at any time via draft management UI" />
        </Section>

        {/* J. OWASP Mapping */}
        <Section title="J. OWASP Top 10 Coverage" icon={CheckCircle}>
          <Row label="A01 Broken Access Control" value="Internal network only; no public endpoint" />
          <Row label="A02 Cryptographic Failures" value="TLS in transit; DB encryption at rest; PII log redaction" />
          <Row label="A03 Injection" value="Drizzle ORM parameterized queries; HTML sanitization on all inputs" />
          <Row label="A04 Insecure Design" value="Security-first defaults; fail-closed on missing config" />
          <Row label="A05 Security Misconfiguration" value="Helmet headers; debug disabled in production; no stack traces in prod" />
          <Row label="A06 Vulnerable Components" value="Pinned dependencies; pnpm audit available" />
          <Row label="A07 Auth Failures" value="No auth system (internal tool); rate limiting on all API routes" />
          <Row label="A08 Software/Data Integrity" value="Zod schema validation on all structured inputs" />
          <Row label="A09 Logging Failures" value="Structured audit logging; PII redaction; all sensitive ops logged" />
          <Row label="A10 SSRF" value="No server-side URL fetching; file parsing is client-side only" />
        </Section>

        {/* K. Known Gaps */}
        <Section title="K. Known Limitations & Gaps" icon={AlertTriangle}>
          <div className="space-y-2">
            <Gap severity="high" label="No application-level authentication — relies entirely on network access control. Recommended: add Replit Auth or equivalent before broader deployment." />
            <Gap severity="high" label="/admin/security-spec has no server-side auth gate — any user who can reach the app can view this page." />
            <Gap severity="medium" label="No application-level field encryption — sensitive DB fields (salary, compensation) are not encrypted at the column level; rely on hosting-layer encryption only." />
            <Gap severity="medium" label="No server-side session store — session data lives in browser React state only; cannot be remotely invalidated." />
            <Gap severity="low" label="Dependency audit (pnpm audit) not automated in CI — should be added to the build pipeline." />
            <Gap severity="low" label="No automated data-purge job — draft retention relies on manual deletion; a cron job should be added for production deployment." />
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
