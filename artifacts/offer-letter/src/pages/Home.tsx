import React, { useState } from 'react';
import { useOfferStore, OfferProvider } from '@/hooks/use-offer-store';
import { ResumeUpload } from '@/components/offer-letter/ResumeUpload';
import { LetterPreview } from '@/components/offer-letter/LetterPreview';
import { FieldWrapper } from '@/components/offer-letter/FieldWrapper';
import { NormalizationPreview } from '@/components/offer-letter/NormalizationPreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { useListTemplates, useCreateOffer } from '@workspace/api-client-react';
import { format } from 'date-fns';
import {
  Briefcase, Building2, Calendar, CheckCircle, ChevronRight, FileCheck, FileText, 
  MapPin, Settings2, User, Wallet, Save, Download, FileJson, AlertCircle
} from 'lucide-react';
import * as Accordion from '@radix-ui/react-accordion';
import { useToast } from '@/hooks/use-toast';

function OfferEditor() {
  const { state, dispatch } = useOfferStore();
  const { toast } = useToast();
  const { data: templatesData } = useListTemplates();
  const createOfferMutation = useCreateOffer();

  const handleCopyPayload = () => {
    const payload = JSON.stringify(state, null, 2);
    navigator.clipboard.writeText(payload);
    toast({
      title: "Payload Copied",
      description: "Claude generation payload copied to clipboard."
    });
  };

  const handleSaveDraft = () => {
    createOfferMutation.mutate({
      data: {
        templateProfileId: state.templateProfileId || undefined,
        formData: state.formData,
        fieldStates: state.fieldStates,
        resolvedClauses: [],
        status: 'draft'
      }
    }, {
      onSuccess: () => {
        toast({
          title: "Draft Saved",
          description: "Offer letter draft saved successfully."
        });
      }
    });
  };

  if (state.step === 'upload') {
    return <ResumeUpload />;
  }

  const setField = (field: string, value: any) => dispatch({ type: 'SET_FIELD_VALUE', field, value });

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left Rail: Scenarios & Templates */}
      <div className="w-64 border-r bg-card flex flex-col z-10 shrink-0">
        <div className="p-4 border-b">
          <Button variant="default" className="w-full justify-start gap-2 bg-foreground text-background hover:bg-foreground/90">
            <FileText className="w-4 h-4" /> New Letter
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider mb-3">Saved Profiles</h3>
            <div className="space-y-1">
              {templatesData?.templates?.map(tpl => (
                <button 
                  key={tpl.id}
                  onClick={() => dispatch({ type: 'LOAD_TEMPLATE', payload: tpl })}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${state.templateProfileId === tpl.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent'}`}
                >
                  {tpl.profileName}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Center: Multi-section Form */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Bar */}
        <div className="h-16 border-b bg-card flex items-center justify-between px-6 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <h1 className="font-serif text-xl font-semibold">Offer Letter Assembly</h1>
            {state.unresolvedDecisions > 0 ? (
              <span className="flex items-center gap-1.5 text-sm font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                <AlertCircle className="w-4 h-4" />
                {state.unresolvedDecisions} Unresolved
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <CheckCircle className="w-4 h-4" />
                Ready for Generation
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleCopyPayload} title="Copy Claude Payload">
              <FileJson className="w-4 h-4 mr-2" /> Payload
            </Button>
            <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={createOfferMutation.isPending}>
              <Save className="w-4 h-4 mr-2" /> Save Draft
            </Button>
            <Button size="sm" disabled={state.unresolvedDecisions > 0}>
              <Download className="w-4 h-4 mr-2" /> Export
            </Button>
          </div>
        </div>

        {/* Form Area */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-3xl mx-auto">
            <Accordion.Root type="multiple" defaultValue={["candidate", "employment", "comp"]} className="space-y-4">
              
              {/* SECTION: CANDIDATE */}
              <Accordion.Item value="candidate" className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <Accordion.Header>
                  <Accordion.Trigger className="w-full flex items-center justify-between p-4 hover:bg-accent/5 transition-colors group">
                    <div className="flex items-center gap-3 font-serif font-semibold text-lg">
                      <User className="w-5 h-5 text-primary" /> Candidate Details
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-data-[state=open]:rotate-90 transition-transform" />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="p-4 pt-0 border-t bg-slate-50/50 data-[state=closed]:animate-slideUp data-[state=open]:animate-slideDown">
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <FieldWrapper id="candidate_full_name" label="Full Name">
                      <Input value={state.formData.candidate_full_name || ''} onChange={e => setField('candidate_full_name', e.target.value)} />
                    </FieldWrapper>
                    <FieldWrapper id="candidate_email" label="Email Address">
                      <Input type="email" value={state.formData.candidate_email || ''} onChange={e => setField('candidate_email', e.target.value)} />
                    </FieldWrapper>
                    <FieldWrapper id="letter_date" label="Letter Date" optional>
                      <Input type="date" value={state.formData.letter_date || ''} onChange={e => setField('letter_date', e.target.value)} />
                    </FieldWrapper>
                    <FieldWrapper id="acceptance_deadline" label="Acceptance Deadline" optional>
                      <Input type="date" value={state.formData.acceptance_deadline || ''} onChange={e => setField('acceptance_deadline', e.target.value)} />
                    </FieldWrapper>
                  </div>
                </Accordion.Content>
              </Accordion.Item>

              {/* SECTION: EMPLOYMENT */}
              <Accordion.Item value="employment" className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <Accordion.Header>
                  <Accordion.Trigger className="w-full flex items-center justify-between p-4 hover:bg-accent/5 transition-colors group">
                    <div className="flex items-center gap-3 font-serif font-semibold text-lg">
                      <Briefcase className="w-5 h-5 text-primary" /> Employment Details
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-data-[state=open]:rotate-90 transition-transform" />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="p-4 pt-0 border-t bg-slate-50/50">
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <FieldWrapper id="job_title" label="Job Title">
                      <Input value={state.formData.job_title || ''} onChange={e => setField('job_title', e.target.value)} />
                    </FieldWrapper>
                    <FieldWrapper id="site_name" label="Site Name">
                      <Input value={state.formData.site_name || ''} onChange={e => setField('site_name', e.target.value)} />
                    </FieldWrapper>
                    <FieldWrapper id="start_date" label="Expected Start Date">
                      <Input type="date" value={state.formData.start_date || ''} onChange={e => setField('start_date', e.target.value)} />
                    </FieldWrapper>
                    <FieldWrapper id="reports_to_title" label="Reports To (Title)">
                      <Input value={state.formData.reports_to_title || ''} onChange={e => setField('reports_to_title', e.target.value)} />
                    </FieldWrapper>
                  </div>
                </Accordion.Content>
              </Accordion.Item>

              {/* SECTION: COMPENSATION */}
              <Accordion.Item value="comp" className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <Accordion.Header>
                  <Accordion.Trigger className="w-full flex items-center justify-between p-4 hover:bg-accent/5 transition-colors group">
                    <div className="flex items-center gap-3 font-serif font-semibold text-lg">
                      <Wallet className="w-5 h-5 text-primary" /> Compensation
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-data-[state=open]:rotate-90 transition-transform" />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="p-4 pt-0 border-t bg-slate-50/50">
                  <div className="grid grid-cols-1 gap-4 mt-4">
                    <FieldWrapper id="pay_basis" label="Pay Basis">
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg hover:bg-accent/10 flex-1">
                          <input type="radio" name="pay_basis" checked={state.formData.pay_basis === 'salaried'} onChange={() => setField('pay_basis', 'salaried')} className="accent-primary w-4 h-4" /> Salaried
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg hover:bg-accent/10 flex-1">
                          <input type="radio" name="pay_basis" checked={state.formData.pay_basis === 'hourly'} onChange={() => setField('pay_basis', 'hourly')} className="accent-primary w-4 h-4" /> Hourly
                        </label>
                      </div>
                    </FieldWrapper>

                    {state.formData.pay_basis === 'salaried' ? (
                      <>
                        <FieldWrapper id="annual_salary_input" label="Target Annual Salary ($)">
                          <Input type="number" min="0" step="1000" value={state.formData.annual_salary_input || ''} onChange={e => setField('annual_salary_input', parseFloat(e.target.value))} className="text-lg font-medium" />
                        </FieldWrapper>
                        <NormalizationPreview />
                      </>
                    ) : (
                      <FieldWrapper id="hourly_rate_input" label="Hourly Rate ($)">
                        <Input type="number" min="0" step="0.01" value={state.formData.hourly_rate_input || ''} onChange={e => setField('hourly_rate_input', parseFloat(e.target.value))} className="text-lg font-medium" />
                      </FieldWrapper>
                    )}

                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <FieldWrapper id="stip_applicable" label="STIP (Short Term Incentive)" optional helpText="Requires target % if active">
                        <div className="flex items-center gap-3">
                          <Input type="number" placeholder="Target %" value={state.formData.stip_target_percent || ''} onChange={e => setField('stip_target_percent', parseFloat(e.target.value))} />
                          <span className="text-muted-foreground font-medium">%</span>
                        </div>
                      </FieldWrapper>
                      <FieldWrapper id="housing_benefit_applicable" label="Housing Allowance" optional>
                        <Input placeholder="Amount or description" value={state.formData.housing_benefit_text || ''} onChange={e => setField('housing_benefit_text', e.target.value)} />
                      </FieldWrapper>
                    </div>
                  </div>
                </Accordion.Content>
              </Accordion.Item>

              {/* SECTION: PTO */}
              <Accordion.Item value="pto" className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <Accordion.Header>
                  <Accordion.Trigger className="w-full flex items-center justify-between p-4 hover:bg-accent/5 transition-colors group">
                    <div className="flex items-center gap-3 font-serif font-semibold text-lg">
                      <Calendar className="w-5 h-5 text-primary" /> Paid Time Off
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-data-[state=open]:rotate-90 transition-transform" />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="p-4 pt-0 border-t bg-slate-50/50">
                  <div className="grid grid-cols-1 gap-4 mt-4">
                    <FieldWrapper id="pto_confirmed_value" label="Annual PTO (Hours)">
                      <div className="flex gap-4">
                        <Input type="number" value={state.formData.pto_confirmed_value || ''} onChange={e => setField('pto_confirmed_value', parseFloat(e.target.value))} className="w-32" />
                        <Button variant={state.ptoConfirmed ? "secondary" : "default"} onClick={() => dispatch({ type: 'CONFIRM_PTO' })}>
                          {state.ptoConfirmed ? <><CheckCircle className="w-4 h-4 mr-2 text-green-600"/> Confirmed</> : "Confirm PTO"}
                        </Button>
                      </div>
                    </FieldWrapper>
                  </div>
                </Accordion.Content>
              </Accordion.Item>
              
              {/* SECTION: RELOCATION */}
              <Accordion.Item value="relocation" className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <Accordion.Header>
                  <Accordion.Trigger className="w-full flex items-center justify-between p-4 hover:bg-accent/5 transition-colors group">
                    <div className="flex items-center gap-3 font-serif font-semibold text-lg">
                      <MapPin className="w-5 h-5 text-primary" /> Relocation & Immigration
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-data-[state=open]:rotate-90 transition-transform" />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="p-4 pt-0 border-t bg-slate-50/50">
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <FieldWrapper id="relocation_applicable" label="Relocation Required?" optional>
                      <div className="space-y-4 pt-2">
                        <Input placeholder="Origin City/State" value={state.formData.relocation_origin || ''} onChange={e => setField('relocation_origin', e.target.value)} />
                        <Input placeholder="Destination City/State" value={state.formData.relocation_destination || ''} onChange={e => setField('relocation_destination', e.target.value)} />
                      </div>
                    </FieldWrapper>
                    
                    <div className="space-y-4">
                      {state.fieldStates['relocation_applicable'] !== 'removed' && (
                        <FieldWrapper id="relocation_repayment_agreement_required" label="Require Repayment Agreement?" optional>
                          <div className="flex items-center gap-2 h-10">
                            <Switch checked={state.formData.relocation_repayment_agreement_required || false} onCheckedChange={c => setField('relocation_repayment_agreement_required', c)} />
                            <span className="text-sm">Yes, attach agreement</span>
                          </div>
                        </FieldWrapper>
                      )}
                      
                      <FieldWrapper id="immigration_applicable" label="Immigration Support?" optional>
                        <Input placeholder="Immigration Partner Name" value={state.formData.immigration_partner_name || ''} onChange={e => setField('immigration_partner_name', e.target.value)} />
                      </FieldWrapper>
                    </div>
                  </div>
                </Accordion.Content>
              </Accordion.Item>

              {/* SECTION: CONTINGENCIES */}
              <Accordion.Item value="contingencies" className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <Accordion.Header>
                  <Accordion.Trigger className="w-full flex items-center justify-between p-4 hover:bg-accent/5 transition-colors group">
                    <div className="flex items-center gap-3 font-serif font-semibold text-lg">
                      <FileCheck className="w-5 h-5 text-primary" /> Contingencies
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-data-[state=open]:rotate-90 transition-transform" />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="p-4 pt-0 border-t bg-slate-50/50">
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <FieldWrapper id="background_check_required" label="Background Check">
                      <Switch checked={state.formData.background_check_required} onCheckedChange={c => setField('background_check_required', c)} />
                    </FieldWrapper>
                    <FieldWrapper id="drug_screen_required" label="Drug Screen">
                      <Switch checked={state.formData.drug_screen_required} onCheckedChange={c => setField('drug_screen_required', c)} />
                    </FieldWrapper>
                    <FieldWrapper id="physical_required" label="Physical Assessment">
                      <Switch checked={state.formData.physical_required} onCheckedChange={c => setField('physical_required', c)} />
                    </FieldWrapper>
                    <FieldWrapper id="work_authorization_clause_required" label="Work Authorization">
                      <Switch checked={state.formData.work_authorization_clause_required} onCheckedChange={c => setField('work_authorization_clause_required', c)} />
                    </FieldWrapper>
                  </div>
                </Accordion.Content>
              </Accordion.Item>

            </Accordion.Root>
          </div>
        </div>
      </div>

      {/* Right Rail: Letter Preview */}
      <div className="w-[450px] border-l bg-[#E8EAEF] p-6 shrink-0 z-10 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Live Document Preview</h2>
        </div>
        <div className="flex-1 overflow-hidden">
          <LetterPreview />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <OfferProvider>
      <OfferEditor />
    </OfferProvider>
  );
}
