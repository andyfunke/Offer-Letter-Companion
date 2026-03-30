export type FieldState = 'active' | 'removed' | 'inherited';

export interface OfferRuleContext {
  formData: Record<string, any>;
  fieldStates: Record<string, FieldState>;
  normalizationConfirmed?: boolean;
  ptoConfirmed?: boolean;
}

export interface TemplateBaseline {
  formData: Record<string, any>;
  fieldStates: Record<string, FieldState>;
  controlledFormFields: string[];
  controlledFieldStateKeys: string[];
}

export const TEMPLATE_CONTROLLED_FORM_FIELDS = [
  'scenario_type',
  'selected_site_id',
  'site_subsidiary_name',
  'site_location',
  'governing_state',
  'hr_contact_name',
  'hr_contact_email',
  'hr_contact_title',
  'company_representative_name',
  'company_representative_title',
] as const;

function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return !Number.isNaN(value);
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

export function shouldApplyClause(
  clause: { optional_flag: boolean; applicability_rule?: string; render_default: boolean },
  ctx: OfferRuleContext,
): boolean {
  if (!clause.optional_flag) return true;

  const rule = clause.applicability_rule;
  if (!rule) return clause.render_default;
  if (rule === 'always') return true;

  const fieldState = ctx.fieldStates[rule];
  if (fieldState === 'removed') return false;
  if (fieldState === 'active' || fieldState === 'inherited') return true;

  const { formData } = ctx;

  if (rule === 'stip_applicable') {
    const pct = formData.stip_target_percent;
    return typeof pct === 'number' ? !Number.isNaN(pct) && pct > 0 : hasMeaningfulValue(pct);
  }
  if (rule === 'lti_applicable') {
    return Boolean(formData.lti_applicable) || hasMeaningfulValue(formData.lti_grant_value);
  }
  if (rule === 'relocation_applicable') {
    return hasMeaningfulValue(formData.relocation_origin) || hasMeaningfulValue(formData.relocation_destination);
  }
  if (rule === 'immigration_applicable') {
    return hasMeaningfulValue(formData.immigration_partner_name);
  }
  if (rule === 'prior_service_applicable') {
    return hasMeaningfulValue(formData.recognized_service_date);
  }
  if (rule === 'geo_pay_applicable') {
    return hasMeaningfulValue(formData.geo_pay_percent);
  }
  if (rule === 'tax_support_applicable') {
    return hasMeaningfulValue(formData.tax_year);
  }
  if (rule === 'pto_applicable') {
    return formData.pto_confirmed_value !== null && formData.pto_confirmed_value !== undefined;
  }
  if (rule === 'housing_benefit_applicable') {
    return Boolean(formData.housing_benefit_applicable);
  }
  if (rule === 'pay_date_change_applicable') {
    return hasMeaningfulValue(formData.pay_date_change_note);
  }
  if (rule === 'geo_premium_change_applicable') {
    return hasMeaningfulValue(formData.geo_premium_change_note);
  }
  if (rule === 'inventions_applicable') {
    return formData.inventions_applicable !== false;
  }

  return hasMeaningfulValue(formData[rule]) || clause.render_default;
}

export function getUnresolvedFieldIds(ctx: OfferRuleContext): string[] {
  const unresolved: string[] = [];
  const { formData, fieldStates } = ctx;

  if (!formData.candidate_full_name) unresolved.push('candidate_full_name');
  if (!formData.candidate_email) unresolved.push('candidate_email');
  if (!formData.start_date) unresolved.push('start_date');
  if (!formData.governing_state) unresolved.push('governing_state');

  const missingComp = !formData.annual_salary_input && !formData.hourly_rate_input;
  if (formData.pay_basis === 'salaried' && (!formData.annual_salary_input || !ctx.normalizationConfirmed)) {
    unresolved.push('annual_salary_input');
  } else if (missingComp) {
    unresolved.push('annual_salary_input');
  }

  if (!ctx.ptoConfirmed) unresolved.push('pto_confirmed_value');

  if (
    fieldStates.relocation_applicable === 'active' &&
    formData.relocation_repayment_agreement_required === undefined
  ) {
    unresolved.push('relocation_repayment_agreement_required');
  }

  if (fieldStates.immigration_applicable === 'active' && !formData.immigration_partner_name) {
    unresolved.push('immigration_partner_name');
  }

  return [...new Set(unresolved)];
}

export function snapshotTemplateBaseline(formData: Record<string, any>): Record<string, any> {
  const baseline: Record<string, any> = {};
  for (const key of TEMPLATE_CONTROLLED_FORM_FIELDS) {
    baseline[key] = formData[key];
  }
  return baseline;
}
