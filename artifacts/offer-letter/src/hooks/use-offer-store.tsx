import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { TemplateProfile } from '@workspace/api-client-react';
import { KINROSS_SITES } from '@/data/kinross-sites';
import {
  getUnresolvedFieldIds,
  snapshotTemplateBaseline,
  TEMPLATE_CONTROLLED_FORM_FIELDS,
  type FieldState,
  type TemplateBaseline,
} from '@/lib/offer-rules';

export type { FieldState };

export interface OfferState {
  step: 'upload' | 'form';
  resumeData: {
    fullName: string;
    email: string;
    location: string;
    isCanada: boolean;
    isWA: boolean;
  } | null;
  templateProfileId: number | null;
  templateBaseline: TemplateBaseline | null;
  formData: Record<string, any>;
  fieldStates: Record<string, FieldState>;
  unresolvedDecisions: number;
  normalizationConfirmed: boolean;
  ptoConfirmed: boolean;
}

type OfferAction =
  | { type: 'SET_STEP'; payload: 'upload' | 'form' }
  | { type: 'SET_RESUME_DATA'; payload: NonNullable<OfferState['resumeData']> }
  | { type: 'SET_FIELD_VALUE'; field: string; value: any }
  | { type: 'SET_FIELD_STATE'; field: string; state: FieldState }
  | { type: 'LOAD_TEMPLATE'; payload: TemplateProfile }
  | { type: 'CLEAR_TEMPLATE' }
  | { type: 'CONFIRM_NORMALIZATION'; normalizedAnnual: number; normalizedBiweekly: number }
  | { type: 'CONFIRM_PTO' }
  | { type: 'RESET' };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function plusDaysISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const initialState: OfferState = {
  step: 'upload',
  resumeData: null,
  templateProfileId: null,
  templateBaseline: null,
  formData: {
    scenario_type: 'new_hire_salaried',
    pay_basis: 'salaried',
    background_check_required: true,
    drug_screen_required: true,
    physical_required: true,
    work_authorization_clause_required: true,
    letter_date: todayISO(),
    acceptance_deadline: plusDaysISO(8),
    stip_effective_year: new Date().getFullYear(),
    next_review_year: new Date().getFullYear() + 1,
  },
  fieldStates: {},
  unresolvedDecisions: 0,
  normalizationConfirmed: false,
  ptoConfirmed: false,
};

function recalculateUnresolved(state: OfferState): number {
  return getUnresolvedFieldIds({
    formData: state.formData,
    fieldStates: state.fieldStates,
    normalizationConfirmed: state.normalizationConfirmed,
    ptoConfirmed: state.ptoConfirmed,
  }).length;
}

function restoreCurrentTemplate(state: OfferState): Pick<OfferState, 'formData' | 'fieldStates'> {
  if (!state.templateBaseline) {
    return { formData: state.formData, fieldStates: state.fieldStates };
  }

  const { templateBaseline } = state;
  const restoredForm = { ...state.formData };
  for (const key of templateBaseline.controlledFormFields) {
    restoredForm[key] = templateBaseline.formData[key];
  }

  const restoredFieldStates: Record<string, FieldState> = { ...state.fieldStates };
  for (const key of templateBaseline.controlledFieldStateKeys) {
    delete restoredFieldStates[key];
  }
  for (const [key, value] of Object.entries(templateBaseline.fieldStates)) {
    if (value !== undefined) {
      restoredFieldStates[key] = value;
    }
  }

  return { formData: restoredForm, fieldStates: restoredFieldStates };
}

function offerReducer(state: OfferState, action: OfferAction): OfferState {
  let newState = { ...state };
  switch (action.type) {
    case 'SET_STEP':
      newState.step = action.payload;
      break;
    case 'SET_RESUME_DATA':
      newState.resumeData = action.payload;
      newState.step = 'form';
      newState.formData = {
        ...state.formData,
        candidate_full_name: action.payload.fullName || state.formData.candidate_full_name || '',
        candidate_email: action.payload.email || state.formData.candidate_email || '',
      };
      break;
    case 'SET_FIELD_VALUE':
      newState.formData = { ...state.formData, [action.field]: action.value };
      if (action.field === 'annual_salary_input' || action.field === 'pay_basis') {
        newState.normalizationConfirmed = false;
        newState.formData = {
          ...newState.formData,
          normalized_annual_salary: undefined,
          normalized_biweekly_pay: undefined,
        };
      }
      if (action.field === 'pto_confirmed_value') {
        newState.ptoConfirmed = false;
      }
      break;
    case 'SET_FIELD_STATE':
      newState.fieldStates = { ...state.fieldStates, [action.field]: action.state };
      if (action.field === 'relocation_applicable' && action.state === 'removed') {
        newState.fieldStates.relocation_repayment_agreement_required = 'removed';
        newState.fieldStates.relocation_policy_attached = 'removed';
      }
      break;
    case 'LOAD_TEMPLATE': {
      const tpl = action.payload;

      // Always restore previous template before applying a new one.
      const base = restoreCurrentTemplate(state);
      const baseFormData = base.formData;
      const baseFieldStates = base.fieldStates;

      const site = tpl.site ? KINROSS_SITES.find(s => s.id === tpl.site) : undefined;
      const hrContact = tpl.defaultHrContact ?? {};

      const templateFieldStates: Record<string, FieldState> = {};
      (tpl.activeFields ?? []).forEach((f: string) => { templateFieldStates[f] = 'inherited'; });
      (tpl.removedFields ?? []).forEach((f: string) => { templateFieldStates[f] = 'removed'; });
      const templateFieldStateKeys = Object.keys(templateFieldStates);

      const baselineFieldStates: Record<string, FieldState> = {};
      for (const key of templateFieldStateKeys) {
        if (baseFieldStates[key] !== undefined) baselineFieldStates[key] = baseFieldStates[key];
      }

      const baseline: TemplateBaseline = {
        formData: snapshotTemplateBaseline(baseFormData),
        fieldStates: baselineFieldStates,
        controlledFormFields: [...TEMPLATE_CONTROLLED_FORM_FIELDS],
        controlledFieldStateKeys: templateFieldStateKeys,
      };

      const nextFormData = { ...baseFormData };
      nextFormData.scenario_type = tpl.baseScenario;
      nextFormData.selected_site_id = tpl.site || '';
      nextFormData.site_subsidiary_name = site?.subsidiaryName || '';
      nextFormData.site_location = site?.location || '';
      nextFormData.governing_state = site?.governingState || '';
      nextFormData.hr_contact_name = hrContact.name || '';
      nextFormData.hr_contact_email = hrContact.email || '';

      newState.templateProfileId = tpl.id;
      newState.templateBaseline = baseline;
      newState.formData = nextFormData;
      newState.fieldStates = { ...baseFieldStates, ...templateFieldStates };
      newState.normalizationConfirmed = false;
      break;
    }
    case 'CLEAR_TEMPLATE': {
      const base = restoreCurrentTemplate(state);
      const clearedFieldStates: Record<string, FieldState> = {};
      for (const [key, value] of Object.entries(base.fieldStates)) {
        if (value !== 'inherited') clearedFieldStates[key] = value;
      }

      newState.templateProfileId = null;
      newState.templateBaseline = null;
      newState.formData = base.formData;
      newState.fieldStates = clearedFieldStates;
      break;
    }
    case 'CONFIRM_NORMALIZATION':
      newState.normalizationConfirmed = true;
      newState.formData = {
        ...newState.formData,
        normalized_annual_salary: action.normalizedAnnual,
        normalized_biweekly_pay: action.normalizedBiweekly,
      };
      break;
    case 'CONFIRM_PTO':
      newState.ptoConfirmed = true;
      break;
    case 'RESET':
      return { ...initialState, step: 'upload' };
    default:
      return state;
  }

  newState.unresolvedDecisions = recalculateUnresolved(newState);
  return newState;
}

const OfferContext = createContext<{
  state: OfferState;
  dispatch: React.Dispatch<OfferAction>;
} | undefined>(undefined);

export function OfferProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(offerReducer, initialState);
  return (
    <OfferContext.Provider value={{ state, dispatch }}>
      {children}
    </OfferContext.Provider>
  );
}

export function useOfferStore() {
  const context = useContext(OfferContext);
  if (context === undefined) {
    throw new Error('useOfferStore must be used within an OfferProvider');
  }
  return context;
}
