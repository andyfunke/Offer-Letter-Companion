import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { TemplateProfile } from '@workspace/api-client-react';

export type FieldState = 'active' | 'removed' | 'inherited';

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
  | { type: 'CONFIRM_NORMALIZATION' }
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
  formData: {
    scenario_type: 'new_hire_salaried',
    pay_basis: 'salaried',
    background_check_required: true,
    letter_date: todayISO(),
    acceptance_deadline: plusDaysISO(8),
    stip_effective_year: new Date().getFullYear(),
  },
  fieldStates: {},
  unresolvedDecisions: 0,
  normalizationConfirmed: false,
  ptoConfirmed: false,
};

function calculateUnresolved(state: OfferState): number {
  let count = 0;
  if (!state.resumeData) count++;
  if (!state.formData.candidate_full_name) count++;
  if (!state.formData.candidate_email) count++;
  if (!state.formData.start_date) count++;
  if (!state.formData.governing_state) count++;
  if (!state.ptoConfirmed) count++;
  
  if (state.formData.pay_basis === 'salaried' && !state.normalizationConfirmed) count++;
  if (!state.formData.annual_salary_input && !state.formData.hourly_rate_input) count++;

  if (state.fieldStates['relocation_applicable'] === 'active' && state.formData.relocation_repayment_agreement_required === undefined) count++;
  if (state.fieldStates['immigration_applicable'] === 'active' && !state.formData.immigration_partner_name) count++;

  return count;
}

function offerReducer(state: OfferState, action: OfferAction): OfferState {
  let newState = { ...state };
  switch (action.type) {
    case 'SET_STEP':
      newState.step = action.payload;
      break;
    case 'SET_RESUME_DATA':
      newState.resumeData = action.payload;
      newState.formData.candidate_full_name = action.payload.fullName;
      newState.formData.candidate_email = action.payload.email;
      newState.formData.site_location = action.payload.location;
      break;
    case 'SET_FIELD_VALUE':
      newState.formData = { ...state.formData, [action.field]: action.value };
      if (action.field === 'annual_salary_input' || action.field === 'pay_basis') {
        newState.normalizationConfirmed = false;
      }
      if (action.field === 'pto_confirmed_value') {
        newState.ptoConfirmed = false;
      }
      break;
    case 'SET_FIELD_STATE':
      newState.fieldStates = { ...state.fieldStates, [action.field]: action.state };
      
      // Cascading logic
      if (action.field === 'relocation_applicable' && action.state === 'removed') {
        newState.fieldStates['relocation_repayment_agreement_required'] = 'removed';
        newState.fieldStates['relocation_policy_attached'] = 'removed';
      }
      break;
    case 'LOAD_TEMPLATE':
      const tpl = action.payload;
      newState.templateProfileId = tpl.id;
      newState.formData.scenario_type = tpl.baseScenario;
      newState.formData.site_name = tpl.site;
      // Map active/removed fields
      const newFieldStates: Record<string, FieldState> = {};
      tpl.activeFields?.forEach(f => newFieldStates[f] = 'inherited');
      tpl.removedFields?.forEach(f => newFieldStates[f] = 'removed');
      newState.fieldStates = { ...newState.fieldStates, ...newFieldStates };
      break;
    case 'CONFIRM_NORMALIZATION':
      newState.normalizationConfirmed = true;
      break;
    case 'CONFIRM_PTO':
      newState.ptoConfirmed = true;
      break;
    case 'RESET':
      return initialState;
    default:
      return state;
  }
  
  newState.unresolvedDecisions = calculateUnresolved(newState);
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
