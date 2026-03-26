import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useOfferStore } from '@/hooks/use-offer-store';
import { X, AlertTriangle, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  onClose: () => void;
  selectedElement?: {
    id: string;
    label: string;
    role?: string;
    componentName?: string;
    section?: string;
  } | null;
}

function apiBase() {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
  return `${base}/../api`.replace('//', '/');
}

export function ReportIssuePanel({ onClose, selectedElement }: Props) {
  const { user } = useAuth();
  const { state } = useOfferStore();
  const [summary, setSummary] = useState('');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!summary.trim()) { setError('Please provide a brief issue summary.'); return; }
    setSubmitting(true);
    setError('');

    // Build sanitized structural snapshot (NO actual candidate values)
    const structuralSnapshot = {
      pageTitle: 'Offer Letter Assembly',
      route: window.location.pathname,
      sections: [
        { name: 'Candidate Details', fields: ['[Full Name]', '[Email Address]', '[Letter Date]', '[Return By Date]'] },
        { name: 'Employment', fields: ['[Job Title]', '[Site Name]', '[Start Date]', '[Reporting To]'] },
        { name: 'Compensation', fields: ['[Pay Basis]', '[Salary/Rate]', '[STIP Target]'] },
        { name: 'PTO & Benefits', fields: ['[PTO Hours]'] },
        { name: 'LTI', fields: ['[LTI Applicable]', '[Cash RSU Value CAD]'] },
        { name: 'Relocation', fields: ['[Relocation Bonus]'] },
        { name: 'Immigration', fields: ['[Immigration Required]'] },
        { name: 'Contingencies', fields: ['[Background Check]', '[Drug Screen]', '[Physical]'] },
      ],
      // Structural refs only — never include formData values
      activeScenario: state.formData.scenario_type ?? null,
      sectionCount: 8,
    };

    try {
      const resp = await fetch(`${apiBase()}/telemetry/issues`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentRoute: window.location.pathname,
          pageTitle: 'Offer Letter Assembly',
          elementId: selectedElement?.id,
          elementName: selectedElement?.label,
          elementRole: selectedElement?.role,
          elementLabelText: selectedElement?.label,
          componentName: selectedElement?.componentName ?? 'OfferEditor',
          issueSummary: summary,
          issueDetail: detail || undefined,
          activeTemplateProfile: state.templateProfileId ? String(state.templateProfileId) : undefined,
          activeScenario: state.formData.scenario_type ?? undefined,
          currentSection: selectedElement?.section ?? undefined,
          structuralSnapshot,
          highlightedElementId: selectedElement?.id,
          highlightedElementLabel: selectedElement?.label,
        }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? 'Failed to submit');
      setSubmitted(json.issueRef);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Send className="w-6 h-6 text-emerald-600" />
          </div>
          <h2 className="font-serif text-xl font-bold mb-2">Issue Reported</h2>
          <p className="text-muted-foreground text-sm mb-1">Your issue has been logged as:</p>
          <code className="font-mono text-lg font-bold text-primary">{submitted}</code>
          <p className="text-xs text-muted-foreground mt-2">An admin will review it shortly.</p>
          <Button className="w-full mt-6" onClick={onClose}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="font-serif font-semibold">Report Issue</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {selectedElement && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <p className="text-xs text-muted-foreground mb-0.5">Reporting issue on</p>
              <p className="font-medium">{selectedElement.label}</p>
              {selectedElement.section && <p className="text-xs text-muted-foreground">Section: {selectedElement.section}</p>}
            </div>
          )}

          <div>
            <label className="text-sm font-medium block mb-1">Brief summary <span className="text-destructive">*</span></label>
            <Input
              placeholder="e.g. The salary field shows the wrong format"
              value={summary}
              onChange={e => setSummary(e.target.value)}
              maxLength={300}
            />
            <p className="text-xs text-muted-foreground mt-1">{summary.length}/300</p>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Additional detail (optional)</label>
            <Textarea
              placeholder="Describe what you expected vs. what you saw…"
              value={detail}
              onChange={e => setDetail(e.target.value)}
              rows={3}
              maxLength={2000}
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting || !summary.trim()} className="flex-1">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Submit Report
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Only structural metadata is captured. No candidate names, salaries, or personal data are included in the report.
          </p>
        </div>
      </div>
    </div>
  );
}
