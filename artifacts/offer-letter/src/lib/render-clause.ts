// ============================================================
// CLAUSE TOKEN RENDERER
// ============================================================
// Substitutes {{TOKEN}} placeholders in tokenized_text with
// actual form values.  Any token that cannot be resolved is
// left as-is so it remains visible in the preview as a
// highlighted placeholder (handled in LetterPreview).
// ============================================================

import { format } from 'date-fns';

function fmtDate(val: string | undefined): string {
  if (!val) return '';
  try { return format(new Date(val + 'T12:00:00'), 'MMMM d, yyyy'); }
  catch { return val; }
}

function fmtCurrency(val: number | string | undefined): string {
  const n = typeof val === 'string' ? parseFloat(val) : (val ?? NaN);
  if (isNaN(n)) return '';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Build the full token→value map from formData */
export function buildTokenMap(formData: Record<string, any>): Record<string, string> {
  // Use confirmed normalized values when available (set after user clicks Confirm in normalization panel)
  const annual = parseFloat(formData.normalized_annual_salary ?? formData.annual_salary_input) || 0;
  const biweekly = formData.normalized_biweekly_pay
    ? parseFloat(formData.normalized_biweekly_pay)
    : annual > 0 ? annual / 26 : 0;
  const hourly = parseFloat(formData.hourly_rate_input) || 0;

  return {
    // Dates
    DATE:                   fmtDate(formData.letter_date),
    START_DATE:             fmtDate(formData.start_date),
    ACCEPTANCE_DEADLINE:    fmtDate(formData.acceptance_deadline),

    // People
    EMPLOYEE_NAME:          formData.candidate_full_name || '',
    JOB_TITLE:              formData.job_title || '',
    JOB_TITLE_INTERN:       formData.job_title || '',   // intern scenario uses same field
    POSITION_STEP:          formData.position_step || formData.job_title || '',
    REPORTS_TO_TITLE:       formData.reports_to_title || '',
    HR_CONTACT:             formData.hr_contact_name || '',
    HR_EMAIL:               formData.hr_contact_email || '',

    // Company / Site
    SITE_SUBSIDIARY_NAME:   formData.site_subsidiary_name || '',
    SITE_NAME:              formData.site_name || '',
    SITE_LOCATION:          formData.site_location || '',
    SUBSIDIARY_SITE:        formData.subsidiary_site || formData.site_subsidiary_name || '',
    MOBILITY_PARTNER:       formData.immigration_partner_name || '',

    // Compensation — salaried
    ANNUAL_SALARY:          annual > 0 ? fmtCurrency(annual) : '',
    BIWEEKLY_PAY:           biweekly > 0 ? fmtCurrency(biweekly) : '',
    NEXT_REVIEW_YEAR:       formData.next_review_year != null ? String(formData.next_review_year) : '',
    LTI_GRANT_VALUE:        formData.lti_grant_value != null ? String(formData.lti_grant_value) : '',
    LTI_TRANSFER_LANGUAGE:  formData.lti_transfer_language || '',

    // Compensation — hourly
    HOURLY_RATE:            hourly > 0 ? fmtCurrency(hourly) : '',

    // Incentive
    STIP_EFFECTIVE_YEAR:    formData.stip_effective_year != null ? String(formData.stip_effective_year) : '',
    STIP_TARGET_PERCENT:    formData.stip_target_percent != null ? String(formData.stip_target_percent) : '',

    // Geo
    GEO_PAY_PERCENT:        formData.geo_pay_percent != null ? String(formData.geo_pay_percent) : '',
    GEO_PREMIUM_CHANGE_NOTE: formData.geo_premium_change_note || '',

    // PTO
    PTO_HOURS:              formData.pto_confirmed_value != null ? String(formData.pto_confirmed_value) : '',

    // Relocation
    RELOCATION_ORIGIN:      formData.relocation_origin || '',
    RELOCATION_DESTINATION: formData.relocation_destination || '',

    // Prior service / tax
    RECOGNIZED_SERVICE_DATE: formData.recognized_service_date || '',
    TAX_YEAR:               formData.tax_year != null ? String(formData.tax_year) : '',
    HOME_COUNTRY:           formData.home_country || '',

    // Internship
    MAX_MONTHS:             formData.max_months != null ? String(formData.max_months) : '',

    // Fixed-term
    ASSIGNMENT_DURATION_TEXT: formData.assignment_duration_text || '',

    // Pay date note
    PAY_DATE_CHANGE_NOTE:   formData.pay_date_change_note || '',

    // Governing
    GOVERNING_STATE:        formData.governing_state || '',
  };
}

/**
 * Render tokenized_text by substituting all {{TOKEN}} placeholders.
 * Returns an array of segments: strings and unfilled-token markers.
 */
export type RenderedSegment =
  | { kind: 'text'; value: string }
  | { kind: 'filled'; token: string; value: string }
  | { kind: 'unfilled'; token: string };

export function renderSegments(
  tokenizedText: string,
  tokenMap: Record<string, string>,
): RenderedSegment[] {
  // Ensure a space before {{ when preceded by a non-space character,
  // and after }} when followed by a word character (not punctuation).
  const normalized = tokenizedText
    .replace(/([^\s])\{\{/g, '$1 {{')
    .replace(/\}\}([^\s,;:.!?)\]])/g, '}} $1');
  const parts = normalized.split(/(\{\{[A-Z_]+\}\})/g);
  const segments: RenderedSegment[] = [];

  for (const part of parts) {
    const m = part.match(/^\{\{([A-Z_]+)\}\}$/);
    if (!m) {
      if (part) segments.push({ kind: 'text', value: part });
      continue;
    }
    const token = m[1];
    const value = tokenMap[token];
    if (value) {
      segments.push({ kind: 'filled', token, value });
    } else {
      segments.push({ kind: 'unfilled', token });
    }
  }
  return segments;
}

/** Render to plain string (for export / copy) */
export function renderToString(
  tokenizedText: string,
  tokenMap: Record<string, string>,
): string {
  const normalized = tokenizedText
    .replace(/([^\s])\{\{/g, '$1 {{')
    .replace(/\}\}([^\s,;:.!?)\]])/g, '}} $1');
  return normalized.replace(/\{\{([A-Z_]+)\}\}/g, (_, token) => tokenMap[token] ?? `[${token}]`);
}
