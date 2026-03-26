import { useParams, Link } from 'wouter';
import { AdminLayout } from './AdminLayout';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Eye } from 'lucide-react';

function apiBase() {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
  return `${base}/../api`.replace('//', '/');
}

export default function IssuePreview() {
  const params = useParams<{ id: string }>();
  const { id } = params;

  const { data: snap, isLoading } = useQuery({
    queryKey: ['issue-preview', id],
    queryFn: () =>
      fetch(`${apiBase()}/admin/issues/${id}/preview`, { credentials: 'include' }).then(r => {
        if (!r.ok) throw new Error('Preview not found');
        return r.json();
      }),
  });

  const { data: issueData } = useQuery({
    queryKey: ['admin-issue', id],
    queryFn: () =>
      fetch(`${apiBase()}/admin/issues/${id}`, { credentials: 'include' }).then(r => r.json()),
  });

  const issue = issueData?.issue;

  if (isLoading) return <AdminLayout><p className="text-muted-foreground">Loading preview…</p></AdminLayout>;
  if (!snap) return <AdminLayout><p className="text-destructive">No preview available for this issue.</p></AdminLayout>;

  const structural = snap.structuralData as Record<string, unknown>;
  const sections = (structural.sections ?? []) as Array<{ name: string; fields: string[] }>;

  return (
    <AdminLayout>
      <div className="max-w-3xl">
        <div className="flex items-center gap-3 mb-4">
          <Link href={`/admin/issues/${id}`} className="text-sm text-primary hover:underline">
            ← Back to issue
          </Link>
        </div>

        {/* Read-only label */}
        <div className="flex items-center gap-3 px-4 py-3 mb-6 bg-red-50 border-2 border-red-300 rounded-xl text-red-800">
          <Eye className="w-5 h-5 shrink-0 text-red-600" />
          <div>
            <strong>Issue Preview — Read Only</strong>
            <p className="text-xs mt-0.5">
              This is a structural shell of the page at the time the issue was reported.
              No actual candidate data is shown. The highlighted element indicates the reported location.
            </p>
          </div>
        </div>

        {/* Page shell */}
        <div className="border-2 rounded-xl overflow-hidden bg-white opacity-90">
          {/* Simulated page header */}
          <div className="bg-slate-800 px-6 py-3 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <div className="w-3 h-3 rounded-full bg-emerald-400" />
            <span className="ml-3 text-white text-xs font-mono">{issue?.currentRoute ?? '/offer'}</span>
          </div>

          {/* Page title bar */}
          <div className="border-b px-6 py-3 bg-slate-50 flex items-center gap-3">
            <span className="font-serif font-semibold text-slate-800">{issue?.pageTitle ?? 'Offer Letter Assembly'}</span>
            <span className="ml-auto text-xs text-slate-500 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
              ISSUE PREVIEW — NON-INTERACTIVE
            </span>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4 pointer-events-none select-none">
            {sections.length === 0 ? (
              // Generic structure when no sections captured
              ['Candidate Details', 'Employment', 'Compensation', 'PTO & Benefits'].map((s, i) => (
                <SectionShell
                  key={i}
                  title={s}
                  fields={['[Field 1]', '[Field 2]', '[Field 3]']}
                  highlighted={s.toLowerCase().includes(issue?.currentSection?.toLowerCase() ?? '___')}
                  highlightedField={snap.highlightedElementLabel ?? snap.highlightedElementId}
                />
              ))
            ) : (
              sections.map((s, i) => (
                <SectionShell
                  key={i}
                  title={s.name}
                  fields={s.fields}
                  highlighted={s.name === issue?.currentSection}
                  highlightedField={snap.highlightedElementLabel ?? snap.highlightedElementId}
                />
              ))
            )}
          </div>

          {/* Notice */}
          <div className="border-t px-6 py-3 bg-slate-50 text-xs text-slate-500 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Field placeholders are used instead of real candidate data. Layout and structure are preserved.
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function SectionShell({
  title, fields, highlighted, highlightedField,
}: {
  title: string;
  fields: string[];
  highlighted: boolean;
  highlightedField?: string | null;
}) {
  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${highlighted ? 'border-red-400 shadow-md shadow-red-100' : 'border-slate-200 opacity-60'}`}>
      <div className={`px-4 py-2.5 font-medium text-sm ${highlighted ? 'bg-red-50 text-red-800' : 'bg-slate-50 text-slate-600'}`}>
        {title}
        {highlighted && (
          <span className="ml-2 text-xs font-normal text-red-600">(reported area)</span>
        )}
      </div>
      <div className="p-4 grid grid-cols-2 gap-3">
        {fields.map((f, i) => {
          const isHighlighted = highlighted && highlightedField && (f === highlightedField || f.toLowerCase().includes((highlightedField || '').toLowerCase()));
          return (
            <div key={i} className={isHighlighted ? 'col-span-2' : ''}>
              <label className="text-xs text-slate-400 block mb-1">{f}</label>
              <div className={`h-8 rounded border ${isHighlighted ? 'border-red-500 bg-red-50 ring-2 ring-red-300' : 'border-slate-200 bg-slate-50'}`}>
                {isHighlighted && (
                  <div className="flex items-center h-full px-2 text-xs text-red-600 font-medium">
                    ← Issue reported here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
