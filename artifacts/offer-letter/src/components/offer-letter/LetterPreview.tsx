import React, { useEffect, useState } from 'react';
import { useOfferStore } from '@/hooks/use-offer-store';
import { format } from 'date-fns';
import { getClausesForScenario, ScenarioId, ClauseRecord } from '@/data/clause-library';
import { buildTokenMap, renderSegments, RenderedSegment } from '@/lib/render-clause';
import { shouldApplyClause } from '@/lib/offer-rules';
import { apiBase } from '@/hooks/use-auth';

function RenderSegments({ segments, onTokenClick }: { segments: RenderedSegment[]; onTokenClick?: (token: string) => void }) {
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === 'text') return <React.Fragment key={i}>{seg.value}</React.Fragment>;
        if (seg.kind === 'filled') return <strong key={i}>{seg.value}</strong>;
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

function ClauseBlock({ clause, tokenMap, onTokenClick }: { clause: ClauseRecord; tokenMap: Record<string, string>; onTokenClick?: (token: string) => void }) {
  const segments = renderSegments(clause.tokenized_text, tokenMap);
  return (
    <p className="mb-3 leading-normal">
      <RenderSegments segments={segments} onTokenClick={onTokenClick} />
    </p>
  );
}

function Salutation({ name }: { name: string }) {
  return <p className="mb-4 leading-normal">Dear {name || '[Name]'},</p>;
}

function TermsIntroLine() {
  return (
    <p className="mb-3 leading-normal">
      The following terms and conditions of this offer are set out below:
    </p>
  );
}

function SignatureBlock({ candidateName, formData }: { candidateName: string; formData: Record<string, any> }) {
  const year = new Date().getFullYear();
  const hrName = formData.hr_contact_name || 'HR Representative';
  const hrTitle = formData.hr_contact_title || 'Human Resources';
  const mgmtName = formData.company_representative_name || 'Company Representative';
  const mgmtTitle = formData.company_representative_title || 'Company Representative';

  return (
    <div className="mt-8 break-inside-avoid" style={{ breakInside: 'avoid-page' }}>
      <p className="mb-6 leading-normal">Sincerely,</p>

      <div className="grid grid-cols-2 gap-12">
        <div>
          <div className="h-14" />
          <p className="font-bold leading-normal">{hrName}</p>
          <p className="text-slate-600 leading-normal">{hrTitle}</p>
        </div>
        <div>
          <div className="h-14" />
          <p className="font-bold leading-normal">{mgmtName}</p>
          <p className="text-slate-600 leading-normal">{mgmtTitle}</p>
        </div>
      </div>

      <p className="mt-8 leading-normal">
        The above terms and conditions of employment are acceptable to me, dated this date of __________________ {year}.
      </p>

      <div className="mt-8">
        <div className="border-b border-black w-56 mb-1" />
        <p className="font-bold leading-normal">{candidateName || '[Candidate Name]'}</p>
      </div>
    </div>
  );
}

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
      style={{ fontFamily: 'Arial, sans-serif', fontSize: '10pt', lineHeight: 1.2, letterSpacing: 'normal' }}
    >
      <p className="mb-4 leading-normal">{formattedDate}</p>

      <p className="mb-5 font-semibold leading-normal">
        {candidateName}
        {formData.candidate_email && (
          <><br /><span className="font-normal text-slate-500">{formData.candidate_email}</span></>
        )}
      </p>

      <p className="mb-4 text-slate-500 italic leading-normal">Private and Confidential</p>

      <Salutation name={candidateName} />

      {headerClause && (
        <ClauseBlock clause={headerClause} tokenMap={tokenMap} onTokenClick={onTokenClick} />
      )}

      {immigrationClause && shouldApplyClause(immigrationClause, { formData, fieldStates }) && (
        <ClauseBlock clause={immigrationClause} tokenMap={tokenMap} onTokenClick={onTokenClick} />
      )}

      {isSalariedScenario && <TermsIntroLine />}

      {bodyClausesSorted.map(clause => {
        if (!shouldApplyClause(clause, { formData, fieldStates })) return null;
        return <ClauseBlock key={clause.clause_id} clause={clause} tokenMap={tokenMap} onTokenClick={onTokenClick} />;
      })}

      {closingParaClause && (
        <ClauseBlock clause={closingParaClause} tokenMap={tokenMap} onTokenClick={onTokenClick} />
      )}

      {closingContactClause && (
        <ClauseBlock clause={closingContactClause} tokenMap={tokenMap} onTokenClick={onTokenClick} />
      )}

      <SignatureBlock candidateName={candidateName} formData={formData} />

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
