import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { useQueryClient } from '@tanstack/react-query';
import {
  Briefcase, Calendar, CheckCircle, FileCheck, FileText,
  MapPin, User, Wallet, Save, Download, AlertCircle, Shield, LogOut,
  AlertTriangle, LayoutDashboard, ClipboardList, Trash2, BookmarkPlus,
  UploadCloud,
} from 'lucide-react';
import { SCENARIO_LABELS, ScenarioId, getClausesForScenario, ClauseRecord } from '@/data/clause-library';
import { buildTokenMap, renderToString, renderSegments } from '@/lib/render-clause';
import { KINROSS_SITES, US_STATES, CA_PROVINCES } from '@/data/kinross-sites';
import { useToast } from '@/hooks/use-toast';
import { useAuth, apiBase } from '@/hooks/use-auth';
import { useInteractionLog } from '@/hooks/use-interaction-log';

interface HrContact { id: number; firstName: string; lastName: string; email: string | null; site: string | null; isDefault?: boolean; }
interface PtoOption { id: number; value: number; label: string | null; }

// ── Resizable pane divider hook ──────────────────────────────────────────────
function usePaneDrag(
  onDelta: (dx: number) => void,
) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    lastX.current = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return;
      const dx = e.clientX - lastX.current;
      lastX.current = e.clientX;
      onDelta(dx);
    }
    function onMouseUp() {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onDelta]);

  return onMouseDown;
}

// ── Resume file processor (reused from ResumeUpload) ─────────────────────────
async function extractAndParse(file: File): Promise<{ fullName: string; email: string; location: string; isCanada: boolean; isWA: boolean }> {
  let text = '';
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const items = content.items as Array<{ str: string; transform: number[] }>;
      const lineMap = new Map<number, string[]>();
      for (const item of items) {
        if (!item.str.trim()) continue;
        const y = Math.round(item.transform[5]);
        if (!lineMap.has(y)) lineMap.set(y, []);
        lineMap.get(y)!.push(item.str);
      }
      const lines = [...lineMap.entries()].sort((a, b) => b[0] - a[0]).map(([, p]) => p.join(' ').trim()).filter(Boolean);
      pages.push(lines.join('\n'));
    }
    text = pages.join('\n');
  } else if (ext === 'docx') {
    const mammoth = await import('mammoth');
    const buf = await file.arrayBuffer();
    text = (await mammoth.extractRawText({ arrayBuffer: buf })).value;
  } else {
    text = await file.text();
  }

  // Parse name
  const NOT_NAME = /\d|@|http|\.com|Street|Ave|Blvd|Dr\.|Suite|Floor|P\.?O\.\s*Box|Apt\.?|Unit\s|\bWA\b|\bOR\b|\bCA\b|\bBC\b|\bAB\b|\bON\b|\bNY\b|\bTX\b|\bFL\b|\bCO\b|\bID\b|\bMT\b|\bUT\b|\bNV\b|\bAZ\b|\bNM\b|\bState\b|\bCounty\b|\bCity\b|LinkedIn|GitHub|Portfolio|Summary|Objective|Experience|Education|Skills|References|Profile|Resume|Curriculum|\bConfidential\b|\bPrivate\b|\bDear\b|\bSincerely\b|\bRegards\b|\bOffer\s+Letter\b/i;
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  let fullName = '';
  for (const line of lines.slice(0, 10)) {
    const candidate = line.split(/[|—–]/, 1)[0].trim();
    const words = candidate.split(/\s+/);
    if (words.length >= 2 && words.length <= 4 && /^[A-ZÀ-Ý]/.test(candidate) && !/[,|•·–\/\\]/.test(candidate) && !NOT_NAME.test(candidate)) {
      fullName = candidate;
      break;
    }
  }
  if (!fullName) {
    const m = text.match(/\bDear\s+([A-ZÀ-Ý][a-zA-ZÀ-ÿ]+(?:\s+[A-ZÀ-Ý][a-zA-ZÀ-ÿ]+)*),/);
    if (m) fullName = m[1];
  }

  const emailMatch = text.match(/(?<![a-zA-Z0-9])[a-z0-9][a-zA-Z0-9._%+\-]*@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : '';

  const locationPatterns = [
    /\b([A-Z][a-zA-Z]+(?:[ \t][A-Z][a-zA-Z]+){0,2}),[ \t]*(BC|AB|ON|QC|SK|MB|NS|NB|PE|NL|YT|NT|NU)\b/,
    /\b([A-Z][a-zA-Z]+(?:[ \t][A-Z][a-zA-Z]+){0,2}),[ \t]*(WA|OR|CA|AZ|TX|NY|FL|CO|NV|ID|MT|UT|GA|NC|VA|PA|OH|MI|IL|MN|MO|TN|AL|LA|AR|KY|IN|WI|IA|OK|KS|NE|SD|ND|WY|NM|AK|HI|DE|MD|DC|CT|RI|VT|NH|ME|WV|MS)\b/,
  ];
  let location = '';
  let isCanada = false;
  let isWA = false;
  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) {
      location = match[0];
      const sp = match[2].toUpperCase();
      isCanada = ['BC','AB','ON','QC','SK','MB','NS','NB','PE','NL','YT','NT','NU'].includes(sp);
      isWA = sp === 'WA';
      break;
    }
  }

  return { fullName, email, location, isCanada, isWA };
}

function OfferEditor() {
  const { state, dispatch } = useOfferStore();
  const { toast } = useToast();
  const { user, logout, isAdmin } = useAuth();
  const { data: templatesData } = useListTemplates();
  const createOfferMutation = useCreateOffer();
  const queryClient = useQueryClient();
  const [reportIssueOpen, setReportIssueOpen] = useState(false);
  const [hrContacts, setHrContacts] = useState<HrContact[]>([]);
  const [ptoOptions, setPtoOptions] = useState<PtoOption[]>([]);
  const [saveProfileOpen, setSaveProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [candidateDragOver, setCandidateDragOver] = useState(false);
  const [resumeProcessing, setResumeProcessing] = useState(false);
  const { log } = useInteractionLog();

  // ── Pane width state (px). Left rail is fixed; center and right are flexible.
  const containerRef = useRef<HTMLDivElement>(null);
  const candidateFileInputRef = useRef<HTMLInputElement>(null);
  const [centerWidth, setCenterWidth] = useState<number | null>(null); // null = flex auto
  const [rightWidth, setRightWidth] = useState(450);

  const onDragCenter = usePaneDrag(useCallback((dx: number) => {
    // Dragging the divider between center form and right preview:
    // increase center, shrink right (and vice-versa)
    setRightWidth(prev => Math.max(280, prev - dx));
  }, []));

  const onDragLeft = usePaneDrag(useCallback((dx: number) => {
    // Dragging the divider between left rail and center form:
    // We achieve this by giving the center pane a computed flex-basis instead
    setCenterWidth(prev => {
      const current = prev ?? (containerRef.current?.querySelector<HTMLElement>('.center-pane')?.offsetWidth ?? 600);
      return Math.max(320, current + dx);
    });
  }, []));

  // Load HR contacts
  useEffect(() => {
    if (!user) return;
    fetch(`${apiBase()}/auth/hr-contacts`, { credentials: 'include', cache: 'no-store' })
      .then(r => (r.ok || r.status === 304) ? r.json() : Promise.reject())
      .then(data => {
        const contacts: HrContact[] = data.contacts ?? [];
        setHrContacts(contacts);
        const def = contacts.find(c => c.isDefault);
        if (def && !state.formData.hr_contact_name) {
          dispatch({ type: 'SET_FIELD_VALUE', field: 'hr_contact_name', value: `${def.firstName} ${def.lastName}` });
          if (def.email) dispatch({ type: 'SET_FIELD_VALUE', field: 'hr_contact_email', value: def.email });
        }
      })
      .catch(err => console.error('[HR contacts]', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Load PTO options
  useEffect(() => {
    if (!user) return;
    fetch(`${apiBase()}/admin/pto-options`, { credentials: 'include', cache: 'no-store' })
      .then(r => (r.ok || r.status === 304) ? r.json() : Promise.reject())
      .then(data => setPtoOptions(Array.isArray(data) ? data : []))
      .catch(err => console.error('[PTO options]', err));
  }, [user?.id]);

  // Auto-populate site fields from user's assigned site
  useEffect(() => {
    if (!user?.site) return;
    const site = KINROSS_SITES.find(s => s.id === user.site);
    if (!site) return;
    dispatch({ type: 'SET_FIELD_VALUE', field: 'selected_site_id', value: site.id });
    dispatch({ type: 'SET_FIELD_VALUE', field: 'site_subsidiary_name', value: site.subsidiaryName });
    dispatch({ type: 'SET_FIELD_VALUE', field: 'site_location', value: site.location });
    if (site.governingState) dispatch({ type: 'SET_FIELD_VALUE', field: 'governing_state', value: site.governingState });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Load governing state preference for users without assigned site
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

  function handleGoverningStateChange(val: string) {
    setField('governing_state', val);
    if (val && user) {
      fetch(`${apiBase()}/auth/preferences`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastGoverningState: val }),
      }).catch(() => {});
    }
  }

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

  function handleSiteChange(siteId: string) {
    const site = KINROSS_SITES.find(s => s.id === siteId);
    if (!site) return;
    setField('selected_site_id', siteId);
    setField('site_subsidiary_name', site.subsidiaryName);
    setField('site_location', site.location);
    if (site.governingState) handleGoverningStateChange(site.governingState);
    log('Site Dropdown', 'CHANGE', { siteId, siteName: site.label });
  }

  // ── Inline resume drop handler for Candidate Details section ────────────────
  const handleCandidateDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setCandidateDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setResumeProcessing(true);
    try {
      const parsed = await extractAndParse(file);
      // Dispatch — store will only update candidate_full_name + candidate_email
      dispatch({
        type: 'SET_RESUME_DATA',
        payload: {
          fullName: parsed.fullName || '',
          email: parsed.email || '',
          location: parsed.location || '',
          isCanada: parsed.isCanada,
          isWA: parsed.isWA,
        },
      });
      toast({
        title: 'Resume Parsed',
        description: parsed.fullName
          ? `Filled: ${parsed.fullName}${parsed.email ? ` · ${parsed.email}` : ''}`
          : 'Could not detect name — check fields manually.',
      });
      log('Candidate Drop Zone', 'RESUME_DROP', { file: file.name });
    } catch (err: any) {
      toast({ title: 'Parse Error', description: err?.message ?? 'Could not read file.', variant: 'destructive' });
    } finally {
      setResumeProcessing(false);
    }
  }, [dispatch, log, toast]);

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
        await queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
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

  const TOKEN_FIELD_MAP: Record<string, string> = {
    annual_salary: 'annual_salary_input', hourly_rate: 'hourly_rate_input',
    salary: 'annual_salary_input', candidate_name: 'candidate_full_name',
    site_name: 'selected_site_id', subsidiary_name: 'site_subsidiary_name',
    location: 'site_location', state: 'governing_state',
    hr_contact: 'hr_contact_name', acceptance_date: 'acceptance_deadline',
    pto_hours: 'pto_confirmed_value',
  };

  function flashField(fieldId: string): boolean {
    const el = document.getElementById(`field-${fieldId}`);
    if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.transition = 'outline 0s, background-color 0.15s ease';
    el.style.outline = '2.5px solid rgb(239, 68, 68)';
    el.style.backgroundColor = 'rgba(239, 68, 68, 0.07)';
    el.style.borderRadius = '12px';
    setTimeout(() => {
      el.style.transition = 'outline 0.6s ease, background-color 0.6s ease';
      el.style.outline = '';
      el.style.backgroundColor = '';
    }, 1800);
    return true;
  }

  function handleScrollToFirstUnresolved() {
    const fd = state.formData;
    if (!fd.candidate_full_name)  return flashField('candidate_full_name');
    if (!fd.candidate_email)      return flashField('candidate_email');
    if (!fd.start_date)           return flashField('start_date');
    if (!fd.governing_state)      return flashField('governing_state');
    if (fd.pay_basis === 'salaried' && (!fd.annual_salary_input || !state.normalizationConfirmed))
                                  return flashField('annual_salary_input');
    if (!fd.annual_salary_input && !fd.hourly_rate_input)
                                  return flashField('annual_salary_input');
    if (!state.ptoConfirmed)      return flashField('pto_confirmed_value');
    if (state.fieldStates['immigration_applicable'] === 'active' && !fd.immigration_partner_name)
                                  return flashField('immigration_partner_name');
  }

  function handleTokenClick(token: string) {
    const fieldId = TOKEN_FIELD_MAP[token] ?? token;
    if (!flashField(fieldId)) {
      document.getElementById(fieldId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

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
      onSuccess: () => toast({ title: 'Draft Saved', description: 'Offer letter draft saved successfully.' }),
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

    const nameBlock = formData.candidate_email ? `${candidateName}\n${formData.candidate_email}` : candidateName;
    const headerLines: string[] = [letterDate, '', nameBlock, '', 'Private and Confidential', ''];
    headerLines.push(`Dear ${candidateName},`, '');

    const headerClause = clauses.find(c => c.role === 'HEADER_OPENING');
    if (headerClause) headerLines.push(renderToString(headerClause.tokenized_text, tokenMap), '');
    const immigrationClause = clauses.find(c => c.role === 'IMMIGRATION_PARAGRAPH');
    if (immigrationClause && shouldExport(immigrationClause))
      headerLines.push(renderToString(immigrationClause.tokenized_text, tokenMap), '');
    const isSalaried = ['new_hire_salaried', 'promotion_hourly_to_salary', 'site_to_site_transfer_salary'].includes(scenario);
    if (isSalaried) headerLines.push('The following terms and conditions of this offer are set out below:', '');

    const paragraphs: Array<{ segments: Array<{ kind: string; value?: string; token?: string }> }> = [];
    clauses.filter(c => c.role === 'CLAUSE').sort((a, b) => a.sort_order - b.sort_order).forEach(c => {
      if (!shouldExport(c)) return;
      paragraphs.push({ segments: renderSegments(c.tokenized_text, tokenMap) });
    });

    const footerLines: string[] = [];
    const closingPara = clauses.find(c => c.role === 'CLOSING_PARAGRAPH');
    if (closingPara) footerLines.push(renderToString(closingPara.tokenized_text, tokenMap), '');
    const closingContact = clauses.find(c => c.role === 'CLOSING_CONTACT');
    if (closingContact) footerLines.push(renderToString(closingContact.tokenized_text, tokenMap), '');

    const signatureBlock = {
      hrName: 'Renee Karikas', hrTitle: 'Sr. Human Resources Generalist',
      mgmtName: 'Gina Myers', mgmtTitle: 'President & General Manager',
      candidateName, year: new Date().getFullYear(),
    };

    try {
      const response = await fetch(`${apiBase()}/export/docx`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ header: { lines: headerLines }, paragraphs, footer: { lines: footerLines }, signatureBlock }),
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `Offer_Letter_${safeName}.docx`; a.click();
        URL.revokeObjectURL(url);
        log('Export Button', 'EXPORT', { format: 'docx', candidate: formData.candidate_full_name, scenario });
        toast({ title: 'Letter Exported', description: 'Offer letter downloaded as Word document.' });
        return;
      }
      const errData = await response.json().catch(() => ({ error: 'Export failed.' }));
      if (response.status === 404) {
        toast({ title: 'No Letterhead', description: errData.error, variant: 'destructive' });
      } else {
        toast({ title: 'Export Failed', description: errData.error ?? 'An error occurred.', variant: 'destructive' });
        return;
      }
    } catch { /* fall through to HTML */ }

    const htmlParts: string[] = ['<!DOCTYPE html><html><head><meta charset="UTF-8"><style>',
      'body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;line-height:1.6;color:#1a1a1a}',
      'p{margin:0 0 12px}b{font-weight:bold}',
      '</style></head><body>'];
    for (const line of headerLines) {
      if (!line) { htmlParts.push('<p>&nbsp;</p>'); continue; }
      const esc = line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      htmlParts.push(`<p>${esc.replace(/\n/g,'<br>')}</p>`);
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
    a.href = url; a.download = `Offer_Letter_${safeName}.html`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Letter Exported', description: 'Offer letter downloaded as HTML (no letterhead configured).' });
  };

  if (state.step === 'upload') return <ResumeUpload />;

  const setField = (field: string, value: any) => dispatch({ type: 'SET_FIELD_VALUE', field, value });

  return (
    <div ref={containerRef} className="flex h-screen bg-background overflow-hidden" style={{ fontFamily: 'Arial, Helvetica Neue, Helvetica, sans-serif' }}>

      {/* ── Left Rail ─────────────────────────────────────────────────────── */}
      <div className="w-64 border-r bg-card flex flex-col z-10 shrink-0">
        <div className="p-4 border-b">
          <Button
            variant="default"
            className="w-full justify-start gap-2 bg-foreground text-background hover:bg-foreground/90"
            onClick={() => { if (confirm('Start a new letter? This will clear the current session.')) dispatch({ type: 'RESET' }); }}
          >
            <FileText className="w-4 h-4" /> New Letter
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Saved Profiles</h3>
              <button className="flex items-center gap-1 text-xs text-primary hover:underline" onClick={() => setSaveProfileOpen(p => !p)} title="Save current form state as a named profile">
                <BookmarkPlus className="w-3.5 h-3.5" />{saveProfileOpen ? 'Cancel' : 'Save'}
              </button>
            </div>
            {saveProfileOpen && (
              <div className="mb-3 p-2.5 border rounded-lg bg-background space-y-2">
                <Input placeholder="Profile name…" value={profileName} onChange={e => setProfileName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveProfile(); if (e.key === 'Escape') setSaveProfileOpen(false); }}
                  className="h-7 text-xs" autoFocus />
                <Button size="sm" className="w-full h-7 text-xs" onClick={handleSaveProfile} disabled={savingProfile || !profileName.trim()}>
                  {savingProfile ? 'Saving…' : 'Save Profile'}
                </Button>
              </div>
            )}
            <div className="space-y-1">
              {templatesData?.templates?.map(tpl => (
                <div key={tpl.id} className="flex items-center gap-1 group">
                  <button
                    onClick={() => { dispatch({ type: 'LOAD_TEMPLATE', payload: tpl }); log('Template Sidebar', 'LOAD', { templateId: tpl.id, templateName: tpl.profileName }); }}
                    className={`flex-1 text-left px-3 py-2 text-sm rounded-md transition-colors ${state.templateProfileId === tpl.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent'}`}
                  >{tpl.profileName}</button>
                  <button title="Delete template"
                    onClick={async () => {
                      if (!confirm(`Delete "${tpl.profileName}"?`)) return;
                      await fetch(`${apiBase()}/templates/${tpl.id}`, { method: 'DELETE', credentials: 'include' });
                      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
                      if (state.templateProfileId === tpl.id) dispatch({ type: 'CLEAR_TEMPLATE' });
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                  ><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
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
            <button onClick={() => logout()} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors w-full">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          )}
        </div>
      </div>

      {/* ── Divider: left ↔ center ─────────────────────────────────────────── */}
      <div
        className="pane-divider"
        onMouseDown={onDragLeft}
        title="Drag to resize"
      />

      {/* ── Center: Form ──────────────────────────────────────────────────── */}
      <div
        className="center-pane flex flex-col min-w-0"
        style={centerWidth ? { width: centerWidth, flexShrink: 0 } : { flex: 1 }}
      >
        {/* Header Bar */}
        <div className="h-16 border-b bg-card flex items-center justify-between px-6 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">Offer Letter Assembly</h1>
            {state.unresolvedDecisions > 0 ? (
              <button type="button" onClick={handleScrollToFirstUnresolved}
                className="flex items-center gap-1.5 text-sm font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 hover:bg-amber-100 hover:border-amber-300 transition-colors cursor-pointer"
                title="Click to jump to the first required field that needs attention">
                <AlertCircle className="w-4 h-4" />{state.unresolvedDecisions} Unresolved
              </button>
            ) : (
              <button type="button" onClick={handleExport}
                className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-colors cursor-pointer"
                title="Generate and download the offer letter (.docx)">
                <CheckCircle className="w-4 h-4" />Ready — Generate Letter
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <Button variant="ghost" size="sm" className="text-amber-600 hover:text-amber-700 hover:bg-amber-50" onClick={() => setReportIssueOpen(true)} title="Report a UI or document issue">
                <AlertTriangle className="w-4 h-4 mr-2" /> Report Issue
              </Button>
            )}
            <Button variant="ghost" size="sm" title="Clear all form data"
              onClick={() => {
                if (confirm('Clear all form data? This cannot be undone.')) {
                  dispatch({ type: 'RESET' });
                  log('Clear Form Button', 'CLICK');
                  toast({ title: 'Form Cleared', description: 'All candidate and offer data has been removed.' });
                }
              }}>
              <Trash2 className="w-4 h-4 mr-2" /> Clear Form
            </Button>
            {user && (
              <Button variant="ghost" size="sm" title="Sign out" onClick={() => logout()} className="text-muted-foreground hover:text-destructive">
                <LogOut className="w-4 h-4 mr-2" /> Sign Out
              </Button>
            )}
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
            <div className="flex items-center gap-3 px-4 py-2.5 mb-6 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
              <Shield className="w-4 h-4 shrink-0 text-blue-600" />
              <span><strong>Internal tool — confidential data.</strong> Candidate and compensation information is processed locally. No data is transmitted to AI services.{' '}
                <Link href="/security" className="underline hover:text-blue-900">View security policy →</Link>
              </span>
            </div>

            <div className="space-y-4">

              {/* LETTER SETUP */}
              <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 font-semibold text-lg p-4 border-b">
                  <ClipboardList className="w-5 h-5 text-primary" /> Letter Setup
                </div>
                <div className="p-4 bg-slate-50/50">
                  <div className="grid grid-cols-1 gap-4 mt-4">
                    <FieldWrapper id="scenario_type" label="Scenario / Template">
                      <select className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        value={state.formData.scenario_type || 'new_hire_salaried'}
                        onChange={e => { setField('scenario_type', e.target.value); log('Scenario Dropdown', 'CHANGE', { scenario: e.target.value }); }}>
                        {(Object.entries(SCENARIO_LABELS) as [ScenarioId, string][]).map(([id, label]) => (
                          <option key={id} value={id}>{label}</option>
                        ))}
                      </select>
                    </FieldWrapper>
                    <div className="grid grid-cols-2 gap-4">
                      <FieldWrapper id="hr_contact_name" label="HR Contact">
                        <select className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                          value={(() => { const name = state.formData.hr_contact_name || ''; const match = hrContacts.find(c => `${c.firstName} ${c.lastName}` === name); return match ? String(match.id) : ''; })()}
                          onChange={e => handleHrContactChange(e.target.value)}>
                          {hrContacts.map(c => <option key={c.id} value={String(c.id)}>{c.firstName} {c.lastName}</option>)}
                        </select>
                      </FieldWrapper>
                      <FieldWrapper id="hr_contact_email" label="HR Contact Email" optional>
                        <Input type="email" value={state.formData.hr_contact_email || ''} onChange={e => setField('hr_contact_email', e.target.value)} placeholder="Auto-filled from contact selection" />
                      </FieldWrapper>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FieldWrapper id="governing_state" label="Governing State">
                        <select className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                          value={state.formData.governing_state || ''} onChange={e => handleGoverningStateChange(e.target.value)}>
                          <option value="">— Select state/province —</option>
                          <optgroup label="US States">{US_STATES.map(s => <option key={s} value={s}>{s}</option>)}</optgroup>
                          <optgroup label="Canadian Provinces">{CA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}</optgroup>
                        </select>
                      </FieldWrapper>
                    </div>
                  </div>
                </div>
              </div>

              {/* CANDIDATE DETAILS — drop zone wraps entire section */}
              <div
                className={[
                  'border rounded-xl bg-card overflow-hidden shadow-sm transition-all duration-150',
                  candidateDragOver ? 'ring-2 ring-primary border-primary bg-primary/5' : '',
                ].join(' ')}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); setCandidateDragOver(true); }}
                onDragLeave={e => { e.preventDefault(); setCandidateDragOver(false); }}
                onDrop={handleCandidateDrop}
              >
                <div className="flex items-center justify-between gap-3 font-semibold text-lg p-4 border-b">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-primary" /> Candidate Details
                  </div>
                  {candidateDragOver ? (
                    <span className="text-xs text-primary font-medium flex items-center gap-1">
                      <UploadCloud className="w-4 h-4" /> Drop resume to autofill
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { if (!resumeProcessing) candidateFileInputRef.current?.click(); }}
                      disabled={resumeProcessing}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer disabled:cursor-default"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      {resumeProcessing ? 'Parsing…' : 'Drop resume here to autofill'}
                    </button>
                  )}
                  <input
                    ref={candidateFileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.txt"
                    className="sr-only"
                    disabled={resumeProcessing}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        e.target.value = '';
                        setResumeProcessing(true);
                        try {
                          const parsed = await extractAndParse(file);
                          dispatch({ type: 'SET_RESUME_DATA', payload: { fullName: parsed.fullName || '', email: parsed.email || '', location: parsed.location || '', isCanada: parsed.isCanada, isWA: parsed.isWA } });
                          toast({ title: 'Resume Parsed', description: parsed.fullName ? `Filled: ${parsed.fullName}` : 'Could not detect name — check fields manually.' });
                          log('Candidate File Input', 'RESUME_UPLOAD', { file: file.name });
                        } catch (err: any) {
                          toast({ title: 'Parse Error', description: err?.message ?? 'Could not read file.', variant: 'destructive' });
                        } finally {
                          setResumeProcessing(false);
                        }
                      }
                    }}
                  />
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

              {/* EMPLOYMENT DETAILS */}
              <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 font-semibold text-lg p-4 border-b">
                  <Briefcase className="w-5 h-5 text-primary" /> Employment Details
                </div>
                <div className="p-4 bg-slate-50/50">
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <FieldWrapper id="job_title" label="Job Title">
                      <Input value={state.formData.job_title || ''} onChange={e => setField('job_title', e.target.value)} />
                    </FieldWrapper>
                    <FieldWrapper id="selected_site_id" label="Site">
                      <select className="w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        value={state.formData.selected_site_id || ''} onChange={e => handleSiteChange(e.target.value)}>
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
                    {(['promotion_hourly_role_change', 'site_to_site_transfer_salary'] as ScenarioId[]).includes(state.formData.scenario_type) && (
                      <FieldWrapper id="subsidiary_site" label="Subsidiary / Site Entity Name">
                        <Input value={state.formData.subsidiary_site || ''} onChange={e => setField('subsidiary_site', e.target.value)} placeholder="e.g. Echo Bay Minerals, Inc." />
                      </FieldWrapper>
                    )}
                  </div>
                </div>
              </div>

              {/* COMPENSATION */}
              <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 font-semibold text-lg p-4 border-b">
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
                    {(['new_hire_salaried', 'site_to_site_transfer_salary'] as ScenarioId[]).includes(state.formData.scenario_type) && (
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

              {/* PTO */}
              <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 font-semibold text-lg p-4 border-b">
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
                            if (opt) { setField('pto_confirmed_value', opt.value); setField('pto_confirmed_label', opt.label ?? ''); }
                            else { setField('pto_confirmed_value', undefined); setField('pto_confirmed_label', ''); }
                          }}
                        >
                          <option value="">— Select —</option>
                          {(() => {
                            const labeled = ptoOptions.filter(o => o.label);
                            const unlabeled = ptoOptions.filter(o => !o.label);
                            const groupOrder: string[] = [];
                            labeled.forEach(o => { const g = o.label!.split(' | ')[0].trim(); if (!groupOrder.includes(g)) groupOrder.push(g); });
                            groupOrder.sort((a, b) => (parseInt(a.match(/\d+/)?.[0] ?? '99') - parseInt(b.match(/\d+/)?.[0] ?? '99')));
                            return (
                              <>
                                {groupOrder.map(group => (
                                  <optgroup key={group} label={group}>
                                    {labeled.filter(o => o.label!.split(' | ')[0].trim() === group).map(o => {
                                      const yearCat = o.label!.split(' | ')[1]?.trim() ?? '';
                                      return <option key={o.id} value={String(o.id)}>{o.value} hrs{yearCat ? ` · ${yearCat}` : ''}</option>;
                                    })}
                                  </optgroup>
                                ))}
                                {unlabeled.map(o => <option key={o.id} value={String(o.id)}>{o.value} hrs</option>)}
                              </>
                            );
                          })()}
                        </select>
                        <Button variant={state.ptoConfirmed ? 'secondary' : 'default'} onClick={() => dispatch({ type: 'CONFIRM_PTO' })}>
                          {state.ptoConfirmed ? <><CheckCircle className="w-4 h-4 mr-2 text-green-600" /> Confirmed</> : 'Confirm PTO'}
                        </Button>
                      </div>
                    </FieldWrapper>
                  </div>
                </div>
              </div>

              {/* RELOCATION */}
              <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 font-semibold text-lg p-4 border-b">
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

              {/* CONTINGENCIES */}
              <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 font-semibold text-lg p-4 border-b">
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

      {/* ── Divider: center ↔ right ────────────────────────────────────────── */}
      <div
        className="pane-divider"
        onMouseDown={onDragCenter}
        title="Drag to resize"
      />

      {/* ── Right Rail: Letter Preview ─────────────────────────────────────── */}
      <div
        className="border-l bg-[#E8EAEF] p-6 shrink-0 z-10 overflow-hidden flex flex-col"
        style={{ width: rightWidth }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Live Document Preview</h2>
        </div>
        <div className="flex-1 overflow-hidden">
          <LetterPreview onTokenClick={handleTokenClick} />
        </div>
      </div>

      {reportIssueOpen && <ReportIssuePanel onClose={() => setReportIssueOpen(false)} selectedElement={null} />}
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
