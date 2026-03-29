import React, { useEffect, useState } from 'react';
import { useOfferStore } from '@/hooks/use-offer-store';
import { format } from 'date-fns';
import { getClausesForScenario, ScenarioId, ClauseRecord } from '@/data/clause-library';
import { buildTokenMap, renderSegments, RenderedSegment } from '@/lib/render-clause';
import { apiBase } from '@/hooks/use-auth';

// ─── Segment renderer ──────────────────────────────────────
function RenderSegments({ segments, onTokenClick }: { segments: RenderedSegment[]; onTokenClick?: (token: string) => void }) {
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === 'text') return <React.Fragment key={i}>{seg.value}</React.Fragment>;
        if (seg.kind === 'filled') return <strong key={i}>{seg.value}</strong>;
        // unfilled token — red clickable button
        return (
          <button
            key={i}
            type="button"
            onClick={() => onTokenClick?.(seg.token ?? '')}
            className="bg-red-100 text-red-700 rounded px-0.5 font-mono text-[0.72em] border border-red-400 cursor-pointer hover:bg-red-200 hover:border-red-500 transition-colors underline decoration-dotted"
            title={`Click to go to: ${seg.token}`}
          >
            [{seg.token}]
          </button>
        );
      })}
    </>
  );
}

// ─── Single clause block ────────────────────────────────────
function ClauseBlock({ clause, tokenMap, onTokenClick }: { clause: ClauseRecord; tokenMap: Record<string, string>; onTokenClick?: (token: string) => void }) {
  const segments = renderSegments(clause.tokenized_text, tokenMap);
  return (
    <p className="mb-4 leading-relaxed">
      <RenderSegments segments={segments} onTokenClick={onTokenClick} />
    </p>
  );
}

// ─── Salutation ──────────────────────────────────────────────
function Salutation({ name }: { name: string }) {
  return <p className="mb-6">Dear {name || '[Name]'},</p>;
}

// ─── Intro line (salaried scenarios) ────────────────────────
function TermsIntroLine() {
  return (
    <p className="mb-4">
      The following terms and conditions of this offer are set out below:
    </p>
  );
}

// ─── Signature block ─────────────────────────────────────────
function SignatureBlock({ candidateName, formData }: { candidateName: string; formData: Record<string, any> }) {
  const year = new Date().getFullYear();
  // fixed: read HR signer from formData instead of hardcoded names
  const hrName = formData.hr_contact_name || 'HR Representative';
  const hrTitle = formData.hr_contact_title || 'Human Resources';
  return (
    <div className="mt-8">
      <p className="mb-10">Sincerely,</p>

      {/* Two-column: HR contact (left) + Gina (right) */}
      <div className="grid grid-cols-2 gap-12">
        <div>
          {/* signing space */}
          <div className="h-16" />
          <p className="font-bold">{hrName}</p>
          <p className="text-slate-500">{hrTitle}</p>
        </div>
        <div>
          <div className="h-16" />
          <p className="font-bold">Gina Myers</p>
          <p className="text-slate-500">President & General Manager</p>
        </div>
      </div>

      {/* Acceptance */}
      <p className="mt-10">
        The above terms and conditions of employment are acceptable to me, dated this date of __________________ {year}.
      </p>

      {/* Candidate signature */}
      <div className="mt-10">
        <div className="border-b border-black w-56 mb-1" />
        <p className="font-bold">{candidateName || '[Candidate Name]'}</p>
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────
export function LetterPreview({ onTokenClick }: { onTokenClick?: (token: string) => void } = {}) {
  const { state } = useOfferStore();
  const { formData, fieldStates } = state;

  const [letterheadFilename, setLetterheadFilename] = useState<string | null>(null);
  useEffect(() => {
    fetch(`${apiBase()}/admin/letterhead/status`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.filename) setLetterheadFilename(d.filename); })
      .catch(() => {});
  }, []);

  const scenario = (formData.scenario_type || 'new_hire_salaried') as ScenarioId;
  const clauses = getClausesForScenario(scenario);
  const tokenMap = buildTokenMap(formData);

  const formattedDate = formData.letter_date
    ? format(new Date(formData.letter_date + 'T12:00:00'), 'MMMM d, yyyy')
    : '[Date]';
  const candidateName = formData.candidate_full_name || '[Candidate Name]';

  // Determine if a clause should be rendered based on applicability_rule
  function shouldRender(clause: ClauseRecord): boolean {
    if (!clause.optional_flag) return true;
    const rule = clause.applicability_rule;
    if (!rule) return clause.render_default;
    if (rule === 'always') return true;

    // fieldStates check — explicit 'removed' always hides
    const fs = fieldStates[rule];
    if (fs === 'removed') return false;
    if (fs === 'active' || fs === 'inherited') return true;

    // Specific semantic rules
    if (rule === 'stip_applicable') {
      const pct = formData.stip_target_percent;
      return typeof pct === 'number' ? !isNaN(pct) && pct > 0 : !!(pct && String(pct).trim());
    }
    if (rule === 'lti_applicable') {
      return !!formData.lti_applicable || !!(formData.lti_grant_value && String(formData.lti_grant_value).trim());
    }
    if (rule === 'relocation_applicable') {
      return !!(formData.relocation_origin || formData.relocation_destination);
    }
    if (rule === 'immigration_applicable') {
      return !!(formData.immigration_partner_name && String(formData.immigration_partner_name).trim());
    }
    if (rule === 'prior_service_applicable') {
      return !!(formData.recognized_service_date && String(formData.recognized_service_date).trim());
    }
    if (rule === 'geo_pay_applicable') {
      return !!(formData.geo_pay_percent != null && String(formData.geo_pay_percent).trim());
    }
    if (rule === 'tax_support_applicable') {
      return !!(formData.tax_year && String(formData.tax_year).trim());
    }
    if (rule === 'pto_applicable') {
      return !!(formData.pto_confirmed_value != null);
    }
    if (rule === 'housing_benefit_applicable') {
      return !!formData.housing_benefit_applicable;
    }
    if (rule === 'pay_date_change_applicable') {
      return !!(formData.pay_date_change_note && String(formData.pay_date_change_note).trim());
    }
    if (rule === 'geo_premium_change_applicable') {
      return !!(formData.geo_premium_change_note && String(formData.geo_premium_change_note).trim());
    }
    if (rule === 'inventions_applicable') {
      const inv = formData.inventions_applicable;
      if (inv === false) return false;
      return true; // default to included
    }

    // formData check for optional fields that are enabled by having a value
    const fv = formData[rule];
    if (fv === true) return true;
    if (fv === false) return false;
    if (typeof fv === 'string' && fv.trim()) return true;
    if (typeof fv === 'number' && !isNaN(fv)) return true;

    return clause.render_default;
  }

  const headerClause = clauses.find(c => c.role === 'HEADER_OPENING');
  const immigrationClause = clauses.find(c => c.role === 'IMMIGRATION_PARAGRAPH');
  const bodyClausesSorted = clauses
    .filter(c => c.role === 'CLAUSE')
    .sort((a, b) => a.sort_order - b.sort_order);
  const closingParaClause = clauses.find(c => c.role === 'CLOSING_PARAGRAPH');
  const closingContactClause = clauses.find(c => c.role === 'CLOSING_CONTACT');

  const isSalariedScenario = ['new_hire_salaried', 'promotion_hourly_to_salary', 'site_to_site_transfer_salary'].includes(scenario);

  return (
    <div
      className="bg-white rounded-sm shadow-xl border border-black/5 p-10 h-full overflow-y-auto letter-document"
      style={{ fontFamily: 'Arial, sans-serif', fontSize: '10pt' }}
    >
      {/* Letter Date */}
      <p className="mb-6">{formattedDate}</p>

      {/* Candidate Address Block */}
      <p className="mb-8 font-semibold">
        {candidateName}
        {formData.candidate_email && (
          <><br /><span className="font-normal text-slate-500">{formData.candidate_email}</span></>
        )}
      </p>

      <p className="mb-6 text-slate-500 italic">Private and Confidential</p>

      {/* Salutation */}
      <Salutation name={candidateName} />

      {/* Opening / Header clause */}
      {headerClause && (
        <ClauseBlock clause={headerClause} tokenMap={tokenMap} onTokenClick={onTokenClick} />
      )}

      {/* Immigration paragraph (optional) */}
      {immigrationClause && shouldRender(immigrationClause) && (
        <ClauseBlock clause={immigrationClause} tokenMap={tokenMap} onTokenClick={onTokenClick} />
      )}

      {/* Salaried intro line */}
      {isSalariedScenario && <TermsIntroLine />}

      {/* Body clauses */}
      {bodyClausesSorted.map(clause => {
        if (!shouldRender(clause)) return null;
        return <ClauseBlock key={clause.clause_id} clause={clause} tokenMap={tokenMap} onTokenClick={onTokenClick} />;
      })}

      {/* Closing paragraph */}
      {closingParaClause && (
        <ClauseBlock clause={closingParaClause} tokenMap={tokenMap} onTokenClick={onTokenClick} />
      )}

      {/* Closing contact */}
      {closingContactClause && (
        <ClauseBlock clause={closingContactClause} tokenMap={tokenMap} onTokenClick={onTokenClick} />
      )}

      {/* Signature block */}
      <SignatureBlock candidateName={candidateName} formData={formData} />

      {/* Source integrity note (subtle, for internal users) */}
      <div className="mt-8 pt-4 border-t border-slate-100 space-y-0.5">
        <p className="text-[10px] text-slate-300 text-center">
          Clause source: {clauses[0]?.source_file_name ?? scenario}
        </p>
        <p className="text-[10px] text-slate-300 text-center">
          Letterhead template: {letterheadFilename ?? '(none configured)'}
        </p>
      </div>
    </div>
  );
}
