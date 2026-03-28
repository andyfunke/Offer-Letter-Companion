import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useOfferStore, OfferProvider } from '@/hooks/use-offer-store';
import { ResumeUpload } from '@/components/offer-letter/ResumeUpload';
import { LetterPreview } from '@/components/offer-letter/LetterPreview';
import { FieldWrapper } from '@/components/offer-letter/FieldWrapper';
import { NormalizationPreview } from '@/components/offer-letter/NormalizationPreview';
import { ReportIssuePanel } from '@/components/offer-letter/ReportIssuePanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useListTemplates, useCreateOffer } from '@workspace/api-client-react';
import {
  Briefcase, Calendar, CheckCircle, FileCheck, FileText,
  MapPin, User, Wallet, Save, Download, FileJson, AlertCircle, Shield, LogOut,
  AlertTriangle, LayoutDashboard, ClipboardList, Trash2, BookmarkPlus
} from 'lucide-react';
import { SCENARIO_LABELS, ScenarioId, getClausesForScenario, ClauseRecord } from '@/data/clause-library';
import { buildTokenMap, renderToString, renderSegments } from '@/lib/render-clause';
import { KINROSS_SITES, US_STATES, CA_PROVINCES } from '@/data/kinross-sites';
import { useToast } from '@/hooks/use-toast';
import { useAuth, apiBase } from '@/hooks/use-auth';
import { useInteractionLog } from '@/hooks/use-interaction-log';

interface HrContact { id: number; firstName: string; lastName: string; email: string | null; site: string | null; isDefault?: boolean; }

interface PtoOption { id: number; value: number; label: string | null; }

function OfferEditor() {
  const { state, dispatch } = useOfferStore();
  const { toast } = useToast();
  const { user, logout, hasRole, isAdmin } = useAuth();
  const { data: templatesData } = useListTemplates();
  const createOfferMutation = useCreateOffer();
  const [reportIssueOpen, setReportIssueOpen] = useState(false);
  const [hrContacts, setHrContacts] = useState<HrContact[]>([]);
  const [ptoOptions, setPtoOptions] = useState<PtoOption[]>([]);
  const [saveProfileOpen, setSaveProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const { log } = useInteractionLog();

  // Load HR contacts list for dropdown; auto-select default when list arrives
  useEffect(() => {
    fetch(`${apiBase()}/auth/hr-contacts`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { contacts: [] })
      .then(data => {
        const contacts: HrContact[] = data.contacts ?? [];
        setHrContacts(contacts);
        // Auto-fill default HR contact if form field is empty
        const def = contacts.find(c => c.isDefault);
        if (def && !state.formData.hr_contact_name) {
          dispatch({ type: 'SET_FIELD_VALUE', field: 'hr_contact_name', value: `${def.firstName} ${def.lastName}` });
          if (def.email) dispatch({ type: 'SET_FIELD_VALUE', field: 'hr_contact_email', value: def.email });
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load PTO options
  useEffect(() => {
    fetch(`${apiBase()}/admin/pto-options`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => setPtoOptions(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Auto-populate site fields + HR contact from user's assigned site
  useEffect(() => {
    if (!user?.site) return;
    const site = KINROSS_SITES.find(s => s.id === user.site);
    if (!site) return;
    dispatch({ type: 'SET_FIELD_VALUE', field: 'selected_site_id', value: site.id });
    dispatch({ type: 'SET_FIELD_VALUE', field: 'site_subsidiary_name', value: site.subsidiaryName });
    dispatch({ type: 'SET_FIELD_VALUE', field: 'site_location', value: site.location });
    if (site.governingState) {
      dispatch({ type: 'SET_FIELD_VALUE', field: 'governing_state', value: site.governingState });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Load user's last governing state preference (only for users without assigned site)
  useEffect(() => {
    if (!user || user.site) return;
    fetch(`${apiBase()}/auth/preferences`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : {})
      .then(prefs => {
        if (prefs.lastGoverningState && !state.formData.governing_state) {
          dispatch({ type: 'SET_FIELD_VALUE', field: 'governing_state', value: prefs.lastGoverningState });
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Save governing state preference when it changes
  function handleGoverningStateChange(val: string) {
    setField('governing_state', val);
    if (val && user) {
      fetch(`${apiBase()}/auth/preferences`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastGoverningState: val }),
      }).catch(() => {});
    }
  }

  // Handle HR contact selection — auto-fills email + governing state from contact's site
  function handleHrContactChange(contactId: string) {
    const contact = hrContacts.find(c => String(c.id) === contactId);
    if (contact) {
      setField('hr_contact_name', `${contact.firstName} ${contact.lastName}`);
      if (contact.email) setField('hr_contact_email', contact.email);
      if (contact.site) {
        const site = KINROSS_SITES.find(s => s.id === contact.site);
        if (site?.governingState) handleGoverningStateChange(site.governingState);
      }
      log('HR Contact Dropdown', 'CHANGE', { contactId, name: `${contact.firstName} ${contact.lastName}` });
    } else {
      setField('hr_contact_name', '');
      setField('hr_contact_email', '');
    }
  }

  // Handle site selection — auto-fills subsidiary name, location, governing state
  function handleSiteChange(siteId: string) {
    const site = KINROSS_SITES.find(s => s.id === siteId);
    if (!site) return;
    setField('selected_site_id', siteId);
    setField('site_subsidiary_name', site.subsidiaryName);
    setField('site_location', site.location);
    if (site.governingState) handleGoverningStateChange(site.governingState);
    log('Site Dropdown', 'CHANGE', { siteId, siteName: site.label });
  }

  // Save current state as a named profile template
  async function handleSaveProfile() {
    if (!profileName.trim()) return;
    setSavingProfile(true);
    try {
      const scenario = (state.formData.scenario_type as ScenarioId) || 'new_hire_salaried';
      const activeFields = Object.entries(state.fieldStates).filter(([, v]) => v === 'active').map(([k]) => k);
      const removedFields = Object.entries(state.fieldStates).filter(([, v]) => v === 'removed').map(([k]) => k);
      const r = await fetch(`${apiBase()}/templates`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileName: profileName.trim(),
          baseScenario: scenario,
          site: state.formData.selected_site_id || undefined,
          activeFields, removedFields,
          clauseVariantIds: {}, outputOrder: [], defaultSigners: {},
          defaultHrContact: state.formData.hr_contact_name
            ? { name: state.formData.hr_contact_name, email: state.formData.hr_contact_email || '' }
            : {},
        }),
      });
      if (r.ok) {
        toast({ title: 'Profile Saved', description: `"${profileName.trim()}" saved as a template.` });
        log('Save Profile', 'SAVE', { profileName: profileName.trim() });
        setProfileName('');
        setSaveProfileOpen(false);
      } else {
        const err = await r.json().catch(() => ({}));
        toast({ title: 'Save Failed', description: err.error ?? 'Could not save profile.', variant: 'destructive' });
      }
    } finally {
      setSavingProfile(false);
    }
  }

  const handleCopyPayload = () => {
    const payload = JSON.stringify(state, null, 2);
    navigator.clipboard.writeText(payload);
    toast({
      title: "Payload Copied",
      description: "Claude generation payload copied to clipboard."
    });
  };

  const handleSaveDraft = () => {
    log('Save Draft Button', 'SAVE', { scenario: state.formData.scenario_type, candidate: state.formData.candidate_full_name });
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

  const handleExport = async () => {
    const scenario = (state.formData.scenario_type || 'new_hire_salaried') as ScenarioId;
    const clauses = getClausesForScenario(scenario);
    const tokenMap = buildTokenMap(state.formData);
    const { formData, fieldStates } = state;

    function shouldExport(c: ClauseRecord): boolean {
      if (!c.optional_flag) return true;
      const rule = c.applicability_rule;
      if (!rule || rule === 'always') return c.render_default;
      const fs = fieldStates[rule];
      if (fs === 'removed') return false;
      if (fs === 'active' || fs === 'inherited') return true;
      if (rule === 'stip_applicable') {
        const pct = formData.stip_target_percent;
        return typeof pct === 'number' ? !isNaN(pct) && pct > 0 : !!(pct && String(pct).trim());
      }
      if (rule === 'lti_applicable') return !!formData.lti_applicable || !!(formData.lti_grant_value);
      if (rule === 'relocation_applicable') return !!(formData.relocation_origin || formData.relocation_destination);
      if (rule === 'immigration_applicable') return !!(formData.immigration_partner_name);
      const fv = formData[rule];
      if (typeof fv === 'boolean') return fv;
      if (typeof fv === 'string' && fv.trim()) return true;
      return c.render_default;
    }

    const candidateName = formData.candidate_full_name || '[Candidate Name]';
    const letterDate = formData.letter_date
      ? new Date(formData.letter_date + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : '[Date]';
    const safeName = candidateName.replace(/[^a-zA-Z0-9]/g, '_');

    // ── Build header lines ──────────────────────────────────────────────────
    const headerLines: string[] = [letterDate, '', candidateName];
    if (formData.candidate_email) headerLines.push(formData.candidate_email);
    headerLines.push('', 'Private and Confidential', '');
    headerLines.push(`Dear ${candidateName},`, '');

    const headerClause = clauses.find(c => c.role === 'HEADER_OPENING');
    if (headerClause) {
      headerLines.push(renderToString(headerClause.tokenized_text, tokenMap), '');
    }
    const immigrationClause = clauses.find(c => c.role === 'IMMIGRATION_PARAGRAPH');
    if (immigrationClause && shouldExport(immigrationClause)) {
      headerLines.push(renderToString(immigrationClause.tokenized_text, tokenMap), '');
    }
    const isSalaried = ['new_hire_salaried', 'promotion_hourly_to_salary', 'site_to_site_transfer_salary'].includes(scenario);
    if (isSalaried) {
      headerLines.push('The following terms and conditions of this offer are set out below:', '');
    }

    // ── Build clause paragraphs (numbered, with segment data for bold) ──────
    const paragraphs: Array<{ segments: Array<{ kind: string; value?: string; token?: string }> }> = [];
    clauses
      .filter(c => c.role === 'CLAUSE')
      .sort((a, b) => a.sort_order - b.sort_order)
      .forEach(c => {
        if (!shouldExport(c)) return;
        const segs = renderSegments(c.tokenized_text, tokenMap);
        paragraphs.push({ segments: segs });
      });

    // ── Build footer lines ─────────────────────────────────────────────────
    const footerLines: string[] = [];
    const closingPara = clauses.find(c => c.role === 'CLOSING_PARAGRAPH');
    if (closingPara) footerLines.push(renderToString(closingPara.tokenized_text, tokenMap), '');
    const closingContact = clauses.find(c => c.role === 'CLOSING_CONTACT');
    if (closingContact) footerLines.push(renderToString(closingContact.tokenized_text, tokenMap), '');

    // ── Signature block (structured for proper two-column docx layout) ─────
    const signatureBlock = {
      hrName: 'Renee Karikas',
      hrTitle: 'Sr. Human Resources Generalist',
      mgmtName: formData.company_representative_name || 'Gina Myers',
      mgmtTitle: formData.company_representative_title || 'President & General Manager',
      candidateName,
      year: new Date().getFullYear(),
    };

    // ── Try .docx export via server ────────────────────────────────────────
    try {
      const response = await fetch(`${apiBase()}/export/docx`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ header: { lines: headerLines }, paragraphs, footer: { lines: footerLines }, signatureBlock }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Offer_Letter_${safeName}.docx`;
        a.click();
        URL.revokeObjectURL(url);
        log('Export Button', 'EXPORT', { format: 'docx', candidate: formData.candidate_full_name, scenario });
        toast({ title: 'Letter Exported', description: 'Offer letter downloaded as Word document.' });
        return;
      }

      const errData = await response.json().catch(() => ({ error: 'Export failed.' }));
      if (response.status === 404) {
        // No letterhead — fall back to HTML download
        toast({ title: 'No Letterhead', description: errData.error, variant: 'destructive' });
      } else {
        toast({ title: 'Export Failed', description: errData.error ?? 'An error occurred.', variant: 'destructive' });
        return;
      }
    } catch {
      // Network error — fall back to HTML
    }

    // ── Fallback: download as HTML with <p> / <b> formatting ──────────────
    const htmlParts: string[] = ['<!DOCTYPE html><html><head><meta charset="UTF-8"><style>',
      'body{font-family:Georgia,serif;max-width:800px;margin:40px auto;line-height:1.6;color:#1a1a1a}',
      'p{margin:0 0 12px}b{font-weight:bold}',
      '</style></head><body>'];

    for (const line of [...headerLines]) {
      htmlParts.push(line ? `<p>${line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>` : '<p>&nbsp;</p>');
    }
    paragraphs.forEach((para, idx) => {
      const content = para.segments.map(s => {
        const v = (s.value ?? s.token ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        return s.kind === 'filled' ? `<b>${v}</b>` : v;
      }).join('');
      htmlParts.push(`<p>${idx + 1}. ${content}</p>`);
    });
    for (const line of footerLines) {
      htmlParts.push(line ? `<p>${line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>` : '<p>&nbsp;</p>');
    }
    htmlParts.push('</body></html>');

    const blob = new Blob([htmlParts.join('')], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Offer_Letter_${safeName}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Letter Exported', description: 'Offer letter downloaded as HTML (no letterhead configured).' });
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
          <Button
            variant="default"
            className="w-full justify-start gap-2 bg-foreground text-background hover:bg-foreground/90"
            onClick={() => {
              if (confirm('Start a new letter? This will clear the current session.')) {
                dispatch({ type: 'RESET' });
              }
            }}
          >
            <FileText className="w-4 h-4" /> New Letter
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Saved Profiles</h3>
              <button
                className="flex items-center gap-1 text-xs text-primary hover:underline"
                onClick={() => setSaveProfileOpen(p => !p)}
                title="Save current form state as a named profile"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                {saveProfileOpen ? 'Cancel' : 'Save'}
              </button>
            </div>
            {saveProfileOpen && (
              <div className="mb-3 p-2.5 border rounded-lg bg-background space-y-2">
                <Input
                  placeholder="Profile name…"
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveProfile(); if (e.key === 'Escape') setSaveProfileOpen(false); }}
                  className="h-7 text-xs"
                  autoFocus
                />
                <Button
                  size="sm"
                  className="w-full h-7 text-xs"
                  onClick={handleSaveProfile}
                  disabled={savingProfile || !profileName.trim()}
                >
                  {savingProfile ? 'Saving…' : 'Save Profile'}
                </Button>
              </div>
            )}
            <div className="space-y-1">
              {templatesData?.templates?.map(tpl => (
                <button 
                  key={tpl.id}
                  onClick={() => {
                    dispatch({ type: 'LOAD_TEMPLATE', payload: tpl });
                    log('Template Sidebar', 'LOAD', { templateId: tpl.id, templateName: tpl.profileName });
                  }}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${state.templateProfileId === tpl.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent'}`}
                >
                  {tpl.profileName}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-3 mt-auto space-y-0.5">
          {user && (
            <div className="px-1.5 py-1 text-xs text-muted-foreground mb-1">
              <span className="font-medium text-foreground">{user.username}</span>{' '}
              <span className="capitalize">{user.role.replace('_', ' ')}</span>
            </div>
          )}
          {isAdmin && (
            <Link href="/admin" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <LayoutDashboard className="w-3.5 h-3.5" /> Admin Panel
            </Link>
          )}
          <Link href="/security" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Shield className="w-3.5 h-3.5" /> Security & Privacy Policy
          </Link>
          {user && (
            <button
              onClick={() => logout()}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors w-full"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          )}
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
            {user && (
              <Button
                variant="ghost"
                size="sm"
                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                onClick={() => setReportIssueOpen(true)}
                title="Report a UI or document issue"
              >
                <AlertTriangle className="w-4 h-4 mr-2" /> Report Issue
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              title="Clear all form data"
              onClick={() => {
                if (confirm('Clear all form data? This cannot be undone.')) {
                  dispatch({ type: 'RESET' });
                  log('Clear Form Button', 'CLICK');
                  toast({ title: 'Form Cleared', description: 'All candidate and offer data has been removed.' });
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Clear Form
            </Button>
            {user && (
              <Button
                variant="ghost"
                size="sm"
                title="Sign out of this account"
                onClick={() => logout()}
                className="text-muted-foreground hover:text-destructive"
              >
                <LogOut className="w-4 h-4 mr-2" /> Sign Out
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleCopyPayload} title="Copy Claude Payload">
              <FileJson className="w-4 h-4 mr-2" /> Payload
            </Button>
            <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={createOfferMutation.isPending}>
              <Save className="w-4 h-4 mr-2" /> Save Draft
            </Button>
            <Button size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" /> Export
            </Button>
          </div>
        </div>

        {/* Form Area */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-3xl mx-auto">

            {/* Security / data classification notice */}
            <div className="flex items-center gap-3 px-4 py-2.5 mb-6 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
              <Shield className="w-4 h-4 shrink-0 text-blue-600" />
              <span>
                <strong>Internal tool — confidential data.</strong> Candidate and compensation information is processed locally.
                No data is transmitted to AI services.{' '}
                <Link href="/security" className="underline hover:text-blue-900">View security policy →</Link>
              </span>
            </div>

            <div className="space-y-4">
              
              {/* SECTION: LETTER SETUP */}
              <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 font-serif font-semibold text-lg p-4 border-b">
                  <ClipboardList className="w-5 h-5 text-primary" /> Letter Setup
                </div>
                <div className="p-4 bg-slate-50/50">
                  <div className="grid grid-cols-1 gap-4 mt-4">
                    <FieldWrapper id="scenario_type" label="Scenario / Template">
                      <select
                        className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        value={state.formData.scenario_type || 'new_hire_salaried'}
                        onChange={e => {
                          setField('scenario_type', e.target.value);
                          log('Scenario Dropdown', 'CHANGE', { scenario: e.target.value });
                        }}
                      >
                        {(Object.entries(SCENARIO_LABELS) as [ScenarioId, string][]).map(([id, label]) => (
                          <option key={id} value={id}>{label}</option>
                        ))}
                      </select>
                    </FieldWrapper>
                    <div className="grid grid-cols-2 gap-4">
                      <FieldWrapper id="hr_contact_name" label="HR Contact">
                        <select
                          className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                          value={(() => {
                            const name = state.formData.hr_contact_name || '';
                            const match = hrContacts.find(c => `${c.firstName} ${c.lastName}` === name);
                            return match ? String(match.id) : '';
                          })()}
                          onChange={e => handleHrContactChange(e.target.value)}
                        >
                          <option value="">— Select HR contact —</option>
                          {hrContacts.map(c => (
                            <option key={c.id} value={String(c.id)}>{c.firstName} {c.lastName}</option>
                          ))}
                        </select>
                      </FieldWrapper>
                      <FieldWrapper id="hr_contact_email" label="HR Contact Email" optional>
                        <Input
                          type="email"
                          value={state.formData.hr_contact_email || ''}
                          onChange={e => setField('hr_contact_email', e.target.value)}
                          placeholder="Auto-filled from contact selection"
                        />
                      </FieldWrapper>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FieldWrapper id="governing_state" label="Governing State">
                        <select
                          className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                          value={state.formData.governing_state || ''}
                          onChange={e => handleGoverningStateChange(e.target.value)}
                        >
                          <option value="">— Select state/province —</option>
                          <optgroup label="US States">
                            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                          </optgroup>
                          <optgroup label="Canadian Provinces">
                            {CA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                          </optgroup>
                        </select>
                      </FieldWrapper>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION: CANDIDATE */}
              <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 font-serif font-semibold text-lg p-4 border-b">
                  <User className="w-5 h-5 text-primary" /> Candidate Details
                </div>
                <div className="p-4 bg-slate-50/50">
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
                    <FieldWrapper id="acceptance_deadline" label="Please return this offer letter by">
                      <Input type="date" value={state.formData.acceptance_deadline || ''} onChange={e => setField('acceptance_deadline', e.target.value)} />
                    </FieldWrapper>
                  </div>
                </div>
              </div>

              {/* SECTION: EMPLOYMENT */}
              <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 font-serif font-semibold text-lg p-4 border-b">
                  <Briefcase className="w-5 h-5 text-primary" /> Employment Details
                </div>
                <div className="p-4 bg-slate-50/50">
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <FieldWrapper id="job_title" label="Job Title">
                      <Input value={state.formData.job_title || ''} onChange={e => setField('job_title', e.target.value)} />
                    </FieldWrapper>
                    <FieldWrapper id="selected_site_id" label="Site">
                      <select
                        className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        value={state.formData.selected_site_id || ''}
                        onChange={e => handleSiteChange(e.target.value)}
                      >
                        <option value="">— Select site —</option>
                        {KINROSS_SITES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </FieldWrapper>
                    <FieldWrapper id="site_subsidiary_name" label="Site Subsidiary Name">
                      <Input value={state.formData.site_subsidiary_name || ''} onChange={e => setField('site_subsidiary_name', e.target.value)} placeholder="Auto-filled from site selection" />
                    </FieldWrapper>
                    <FieldWrapper id="site_location" label="Site Location">
                      <Input value={state.formData.site_location || ''} onChange={e => setField('site_location', e.target.value)} placeholder="Auto-filled from site selection" />
                    </FieldWrapper>
                    <FieldWrapper id="start_date" label="Expected Start Date">
                      <Input type="date" value={state.formData.start_date || ''} onChange={e => setField('start_date', e.target.value)} />
                    </FieldWrapper>
                    <FieldWrapper id="reports_to_title" label="Reports To (Title)">
                      <Input value={state.formData.reports_to_title || ''} onChange={e => setField('reports_to_title', e.target.value)} />
                    </FieldWrapper>
                    {/* Scenario-specific fields */}
                    {state.formData.scenario_type === 'new_hire_hourly' && (
                      <FieldWrapper id="position_step" label="Position / Step" optional>
                        <Input value={state.formData.position_step || ''} onChange={e => setField('position_step', e.target.value)} placeholder="e.g. Maintenance Technician / Step 3" />
                      </FieldWrapper>
                    )}
                    {state.formData.scenario_type === 'internship' && (
                      <FieldWrapper id="max_months" label="Maximum Term (months)">
                        <Input type="number" min={1} max={24} value={state.formData.max_months || ''} onChange={e => setField('max_months', parseInt(e.target.value))} />
                      </FieldWrapper>
                    )}
                    {state.formData.scenario_type === 'salaried_fixed_term_external' && (
                      <FieldWrapper id="assignment_duration_text" label="Assignment Duration (text)">
                        <Input value={state.formData.assignment_duration_text || ''} onChange={e => setField('assignment_duration_text', e.target.value)} placeholder="e.g. nine months" />
                      </FieldWrapper>
                    )}
                    {(state.formData.scenario_type === 'promotion_hourly_role_change' || state.formData.scenario_type === 'site_to_site_transfer_salary') && (
                      <FieldWrapper id="subsidiary_site" label="Subsidiary / Site Entity Name">
                        <Input value={state.formData.subsidiary_site || ''} onChange={e => setField('subsidiary_site', e.target.value)} placeholder="e.g. Echo Bay Minerals, Inc." />
                      </FieldWrapper>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION: COMPENSATION */}
              <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 font-serif font-semibold text-lg p-4 border-b">
                  <Wallet className="w-5 h-5 text-primary" /> Compensation
                </div>
                <div className="p-4 bg-slate-50/50">
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
                      <FieldWrapper id="stip_applicable" label="STIP Target %" optional helpText="Leave blank to omit STIP clause">
                        <div className="flex items-center gap-3">
                          <Input type="number" placeholder="Target %" value={state.formData.stip_target_percent || ''} onChange={e => setField('stip_target_percent', parseFloat(e.target.value))} />
                          <span className="text-muted-foreground font-medium">%</span>
                        </div>
                      </FieldWrapper>
                      <FieldWrapper id="stip_effective_year" label="STIP Effective Year" optional>
                        <Input type="number" placeholder={String(new Date().getFullYear())} value={state.formData.stip_effective_year || ''} onChange={e => setField('stip_effective_year', e.target.value)} />
                      </FieldWrapper>
                      <FieldWrapper id="next_review_year" label="Next Salary Review Year" optional>
                        <Input type="number" placeholder={String(new Date().getFullYear() + 1)} value={state.formData.next_review_year || ''} onChange={e => setField('next_review_year', e.target.value)} />
                      </FieldWrapper>
                      <FieldWrapper id="housing_benefit_applicable" label="Housing Allowance" optional>
                        <Input placeholder="Amount or description" value={state.formData.housing_benefit_text || ''} onChange={e => setField('housing_benefit_text', e.target.value)} />
                      </FieldWrapper>
                    </div>
                    {/* LTI — salaried scenarios only */}
                    {['new_hire_salaried', 'site_to_site_transfer_salary'].includes(state.formData.scenario_type) && (
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        <FieldWrapper id="lti_grant_value" label="LTI Grant Value (CAD $)" optional helpText="e.g. 75,000.00">
                          <Input placeholder="XX,000.00" value={state.formData.lti_grant_value || ''} onChange={e => setField('lti_grant_value', e.target.value)} />
                        </FieldWrapper>
                        <FieldWrapper id="lti_applicable" label="Include LTI Clause" optional>
                          <div className="flex items-center gap-2 h-10">
                            <Switch checked={!!state.formData.lti_applicable} onCheckedChange={c => setField('lti_applicable', c)} />
                            <span className="text-sm">Yes, include LTI clause</span>
                          </div>
                        </FieldWrapper>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION: PTO */}
              <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 font-serif font-semibold text-lg p-4 border-b">
                  <Calendar className="w-5 h-5 text-primary" /> Paid Time Off
                </div>
                <div className="p-4 bg-slate-50/50">
                  <div className="grid grid-cols-1 gap-4 mt-4">
                    <FieldWrapper id="pto_confirmed_value" label="Annual PTO (Hours)">
                      <div className="flex gap-4 items-center">
                        <select
                          className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary flex-1 min-w-0"
                          value={(() => {
                            const v = state.formData.pto_confirmed_value;
                            const l = state.formData.pto_confirmed_label as string | undefined;
                            if (v == null) return '';
                            const match = ptoOptions.find(o => o.value === Number(v) && (l ? o.label === l : true));
                            return match ? String(match.id) : '';
                          })()}
                          onChange={e => {
                            const opt = ptoOptions.find(o => String(o.id) === e.target.value);
                            if (opt) {
                              setField('pto_confirmed_value', opt.value);
                              setField('pto_confirmed_label', opt.label ?? '');
                            } else {
                              setField('pto_confirmed_value', undefined);
                              setField('pto_confirmed_label', '');
                            }
                          }}
                        >
                          <option value="">— Select —</option>
                          {ptoOptions.map(o => (
                            <option key={o.id} value={String(o.id)}>
                              {o.value} hrs{o.label ? ` – ${o.label}` : ''}
                            </option>
                          ))}
                        </select>
                        <Button variant={state.ptoConfirmed ? "secondary" : "default"} onClick={() => dispatch({ type: 'CONFIRM_PTO' })}>
                          {state.ptoConfirmed ? <><CheckCircle className="w-4 h-4 mr-2 text-green-600"/> Confirmed</> : "Confirm PTO"}
                        </Button>
                      </div>
                    </FieldWrapper>
                  </div>
                </div>
              </div>
              
              {/* SECTION: RELOCATION */}
              <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 font-serif font-semibold text-lg p-4 border-b">
                  <MapPin className="w-5 h-5 text-primary" /> Relocation & Immigration
                </div>
                <div className="p-4 bg-slate-50/50">
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
                </div>
              </div>

              {/* SECTION: CONTINGENCIES */}
              <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 font-serif font-semibold text-lg p-4 border-b">
                  <FileCheck className="w-5 h-5 text-primary" /> Contingencies
                </div>
                <div className="p-4 bg-slate-50/50">
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
                </div>
              </div>

            </div>
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

      {/* Report Issue Panel */}
      {reportIssueOpen && (
        <ReportIssuePanel
          onClose={() => setReportIssueOpen(false)}
          selectedElement={null}
        />
      )}
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
