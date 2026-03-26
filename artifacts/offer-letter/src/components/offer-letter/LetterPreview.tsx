import React from 'react';
import { useOfferStore } from '@/hooks/use-offer-store';
import { format } from 'date-fns';
import { getClausesForScenario, ScenarioId, ClauseRecord } from '@/data/clause-library';
import { buildTokenMap, renderSegments, RenderedSegment } from '@/lib/render-clause';

// ─── Segment renderer ──────────────────────────────────────
function RenderSegments({ segments }: { segments: RenderedSegment[] }) {
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === 'text') return <React.Fragment key={i}>{seg.value}</React.Fragment>;
        if (seg.kind === 'filled') return <span key={i}>{seg.value}</span>;
        // unfilled token — render as highlighted placeholder
        return (
          <span
            key={i}
            className="bg-amber-100 text-amber-800 rounded px-0.5 font-mono text-[0.72em] border border-amber-300"
            title="Token not yet filled"
          >
            [{seg.token}]
          </span>
        );
      })}
    </>
  );
}

// ─── Single clause block ────────────────────────────────────
function ClauseBlock({ clause, tokenMap }: { clause: ClauseRecord; tokenMap: Record<string, string> }) {
  const segments = renderSegments(clause.tokenized_text, tokenMap);
  return (
    <p className="mb-4 leading-relaxed text-[13px]">
      <RenderSegments segments={segments} />
    </p>
  );
}

// ─── Salutation ──────────────────────────────────────────────
function Salutation({ name }: { name: string }) {
  return <p className="mb-6 text-[13px]">Dear {name || '[Name]'},</p>;
}

// ─── Intro line (salaried scenarios) ────────────────────────
function TermsIntroLine() {
  return (
    <p className="mb-4 text-[13px]">
      The following terms and conditions of this offer are set out below:
    </p>
  );
}

// ─── Signature block ─────────────────────────────────────────
function SignatureBlock({ candidateName, formData }: { candidateName: string; formData: Record<string, any> }) {
  return (
    <div className="mt-10">
      <p className="mb-6 text-[13px]">Sincerely,</p>
      <div className="grid grid-cols-2 gap-10 mt-8 pt-8 border-t border-slate-200">
        <div>
          <div className="border-b border-black mb-2 mt-10"></div>
          <p className="font-bold text-[13px]">{formData.company_representative_name || 'Gina Myers'}</p>
          <p className="text-[12px] text-slate-500">{formData.company_representative_title || 'President & General Manager'}</p>
        </div>
        <div>
          <div className="border-b border-black mb-2 mt-10"></div>
          <p className="font-bold text-[13px]">{candidateName || '[Candidate Name]'}</p>
          <p className="text-[12px] text-slate-500">Candidate</p>
        </div>
      </div>
      <p className="text-[12px] text-slate-400 mt-6">
        The above terms and conditions of employment are acceptable to me, dated this __________, {new Date().getFullYear()}.
      </p>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────
export function LetterPreview() {
  const { state } = useOfferStore();
  const { formData, fieldStates } = state;

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
    <div className="bg-white rounded-sm shadow-xl border border-black/5 p-10 h-full overflow-y-auto letter-document">
      {/* Letterhead Header */}
      <div className="flex items-start justify-between border-b-2 border-primary pb-6 mb-8">
        <div className="flex items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}images/kinross-logo-placeholder.png`}
            alt="Kinross Logo"
            className="w-12 h-12"
          />
          <div className="font-sans font-bold text-xl tracking-tight text-foreground">KINROSS</div>
        </div>
        <div className="text-right text-sm text-slate-500 font-sans">
          <p>Kinross Gold Corporation</p>
          <p>25 York Street, 17th Floor</p>
          <p>Toronto, ON M5J 2V5</p>
        </div>
      </div>

      {/* Letter Date */}
      <p className="mb-6 text-[13px]">{formattedDate}</p>

      {/* Candidate Address Block */}
      <div className="mb-8 text-[13px]">
        <p className="font-semibold">{candidateName}</p>
        {formData.candidate_email && <p className="text-slate-500">{formData.candidate_email}</p>}
      </div>

      <p className="mb-6 text-xs text-slate-500 italic">Private and Confidential</p>

      {/* Salutation */}
      <Salutation name={candidateName} />

      {/* Opening / Header clause */}
      {headerClause && (
        <ClauseBlock clause={headerClause} tokenMap={tokenMap} />
      )}

      {/* Immigration paragraph (optional) */}
      {immigrationClause && shouldRender(immigrationClause) && (
        <ClauseBlock clause={immigrationClause} tokenMap={tokenMap} />
      )}

      {/* Salaried intro line */}
      {isSalariedScenario && <TermsIntroLine />}

      {/* Body clauses */}
      {bodyClausesSorted.map(clause => {
        if (!shouldRender(clause)) return null;
        return <ClauseBlock key={clause.clause_id} clause={clause} tokenMap={tokenMap} />;
      })}

      {/* Closing paragraph */}
      {closingParaClause && (
        <ClauseBlock clause={closingParaClause} tokenMap={tokenMap} />
      )}

      {/* Closing contact */}
      {closingContactClause && (
        <ClauseBlock clause={closingContactClause} tokenMap={tokenMap} />
      )}

      {/* Signature block */}
      <SignatureBlock candidateName={candidateName} formData={formData} />

      {/* Source integrity note (subtle, for internal users) */}
      <div className="mt-8 pt-4 border-t border-slate-100">
        <p className="text-[10px] text-slate-300 text-center">
          Clause source: {clauses[0]?.source_file_name ?? scenario}
        </p>
      </div>
    </div>
  );
}
