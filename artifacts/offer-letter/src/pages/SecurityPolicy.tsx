import { Shield, Lock, Eye, Trash2, Users, Bell, AlertTriangle, CheckCircle } from "lucide-react";
import { Link } from "wouter";

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      </div>
      <div className="pl-12 space-y-3 text-sm text-muted-foreground leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export default function SecurityPolicy() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-primary" />
            <div>
              <h1 className="font-serif font-bold text-xl text-foreground">Security & Privacy Policy</h1>
              <p className="text-xs text-muted-foreground">Kinross Offer Letter Companion · Internal HR Tool</p>
            </div>
          </div>
          <Link href="/" className="text-sm text-primary hover:underline">← Back to app</Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">

        {/* Internal-tool notice */}
        <div className="flex items-start gap-3 p-4 mb-10 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
          <p>
            This is an <strong>internal HR tool</strong> for authorized Kinross personnel only. It processes
            confidential candidate and compensation data. Unauthorized access or use is strictly prohibited.
          </p>
        </div>

        {/* A. Data Collection */}
        <Section icon={Eye} title="A. Data We Process">
          <p>The following candidate information is handled solely to generate offer letters:</p>
          <Bullet>Candidate full name and email address</Bullet>
          <Bullet>Resume contents (text extracted locally in your browser — the raw file is never transmitted to our servers)</Bullet>
          <Bullet>Compensation data: base salary, hourly rate, bonuses, LTI values</Bullet>
          <Bullet>Employment details: job title, start date, reporting structure, relocation and immigration status</Bullet>
          <p className="mt-2 font-medium text-foreground">Data is collected only to generate offer documents. No candidate profiling or secondary use occurs.</p>
        </Section>

        {/* B. Data Usage */}
        <Section icon={Users} title="B. How Data Is Used">
          <Bullet>Offer letter generation and clause assembly</Bullet>
          <Bullet>Template population and recruiter workflow support</Bullet>
          <Bullet>Saved draft retrieval for HR personnel</Bullet>
          <p className="mt-2 font-medium text-foreground">
            No candidate data is shared with analytics platforms, advertising systems, or third-party profiling services.
          </p>
          <p className="mt-2 font-medium text-foreground bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-800">
            This system does not transmit candidate or compensation data to external AI services or third-party language models.
          </p>
        </Section>

        {/* C. Storage */}
        <Section icon={Lock} title="C. Data Storage">
          <Bullet>All data in transit is encrypted via TLS (HTTPS)</Bullet>
          <Bullet>Database storage uses PostgreSQL with encryption-at-rest enforced by the hosting environment</Bullet>
          <Bullet>Resume text is extracted entirely within your browser and is not stored on our servers unless you explicitly save a draft</Bullet>
          <Bullet>Temporary session data is held in browser memory only and is not persisted unless the user saves a draft</Bullet>
        </Section>

        {/* D. Retention */}
        <Section icon={Bell} title="D. Data Retention">
          <Bullet>Resumes: extracted text is discarded when you close or reset the session; the original file never leaves your browser</Bullet>
          <Bullet>Generated offer text: temporary unless you explicitly export or save it</Bullet>
          <Bullet>Saved drafts: retained for 24 hours by default; configurable per deployment</Bullet>
          <Bullet>Session data: cleared automatically on browser close or after 8 hours of inactivity</Bullet>
          <Bullet>Template profiles: retained indefinitely until deleted by authorized HR staff</Bullet>
        </Section>

        {/* E. Access */}
        <Section icon={Users} title="E. Data Access">
          <Bullet>Access is restricted to authorized Kinross HR personnel</Bullet>
          <Bullet>All sensitive operations (draft creation, update, deletion) are recorded in an internal audit log</Bullet>
          <Bullet>Audit log entries redact PII — logs record that an action occurred, not the underlying data values</Bullet>
        </Section>

        {/* F. Deletion */}
        <Section icon={Trash2} title="F. Your Data Deletion Rights">
          <Bullet>Clear session data at any time using the "Clear Session" control in the app header</Bullet>
          <Bullet>Delete saved drafts from the draft management interface</Bullet>
          <Bullet>Automatic cleanup policies purge session data after retention windows expire</Bullet>
        </Section>

        {/* G. Security Controls */}
        <Section icon={Shield} title="G. Security Controls in Place">
          <Bullet>TLS encryption for all data in transit</Bullet>
          <Bullet>Security response headers (Content-Security-Policy, Strict-Transport-Security, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)</Bullet>
          <Bullet>API rate limiting to prevent abuse and brute-force attempts</Bullet>
          <Bullet>Input sanitization on all user-supplied strings (HTML stripping, null-byte removal)</Bullet>
          <Bullet>Request body size limits enforced server-side</Bullet>
          <Bullet>PII fields are redacted from all application logs</Bullet>
          <Bullet>Structured audit logging for all sensitive data operations</Bullet>
          <Bullet>Error messages in production mode never expose internal stack traces</Bullet>
        </Section>

        {/* H. No AI */}
        <Section icon={Shield} title="H. No External AI Processing">
          <p className="font-medium text-foreground">
            This system does not transmit candidate or compensation data to external AI services or
            third-party language models. All offer letter generation is performed locally using structured
            templates and the data you enter.
          </p>
        </Section>

        {/* I. Incident Response */}
        <Section icon={Bell} title="I. Incident Response">
          <Bullet>All requests to sensitive API routes are logged with method, path, response status, and duration</Bullet>
          <Bullet>Failed requests, rate-limit violations, and oversized payloads are captured in application logs</Bullet>
          <Bullet>Logs are monitored for anomalous patterns; alerts can be configured at the infrastructure level</Bullet>
        </Section>

        {/* J. Compliance */}
        <Section icon={CheckCircle} title="J. Compliance Positioning">
          <p>This system is designed in alignment with the following frameworks. We do not claim formal certification.</p>
          <Bullet>SOC 2 Security Principles — access control, audit trails, encryption, least-privilege model</Bullet>
          <Bullet>OWASP Top 10 — injection prevention, secure headers, rate limiting, input validation, no PII in logs, insecure deserialization prevention</Bullet>
          <Bullet>Privacy-by-Design — data minimization, user-controlled deletion, transparent data usage, no unnecessary retention</Bullet>
        </Section>

        <div className="border-t pt-6 text-xs text-muted-foreground">
          <p>Last reviewed: {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })} · Kinross Offer Letter Companion · Internal Use Only</p>
          <p className="mt-1">
            For the internal technical security specification, contact your system administrator or visit <code className="bg-muted px-1 rounded">/admin/security-spec</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
