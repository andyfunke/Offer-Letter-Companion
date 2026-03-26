import { useState } from 'react';
import { useParams, Link } from 'wouter';
import { AdminLayout } from './AdminLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { Eye, MessageSquare, ChevronLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function apiBase() {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
  return `${base}/../api`.replace('//', '/');
}

const STATUS_COLORS: Record<string, string> = {
  new: 'text-red-600 bg-red-50 border-red-200',
  triaged: 'text-amber-600 bg-amber-50 border-amber-200',
  in_progress: 'text-blue-600 bg-blue-50 border-blue-200',
  resolved: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  dismissed: 'text-slate-500 bg-slate-50 border-slate-200',
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 border-b border-dashed last:border-0">
      <span className="w-44 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value || <span className="text-muted-foreground/50">—</span>}</span>
    </div>
  );
}

export default function AdminIssueDetail() {
  const params = useParams<{ id: string }>();
  const issueId = params.id;
  const qc = useQueryClient();
  const [note, setNote] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-issue', issueId],
    queryFn: () =>
      fetch(`${apiBase()}/admin/issues/${issueId}`, { credentials: 'include' }).then(r => r.json()),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      fetch(`${apiBase()}/admin/issues/${issueId}/status`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-issue', issueId] }),
  });

  const noteMutation = useMutation({
    mutationFn: (noteText: string) =>
      fetch(`${apiBase()}/admin/issues/${issueId}/notes`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteText }),
      }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-issue', issueId] }); setNote(''); },
  });

  if (isLoading) return <AdminLayout><p className="text-muted-foreground">Loading…</p></AdminLayout>;
  const { issue, notes = [], snapshot } = data ?? {};
  if (!issue) return <AdminLayout><p className="text-destructive">Issue not found.</p></AdminLayout>;

  return (
    <AdminLayout>
      <div className="max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin/issues" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">{issue.issueRef}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[issue.status] ?? ''}`}>
                {issue.status}
              </span>
            </div>
            <h1 className="text-xl font-serif font-bold mt-0.5">{issue.issueSummary}</h1>
          </div>
        </div>

        {/* Plain-text log */}
        <div className="mb-6 p-4 bg-slate-50 border rounded-xl text-sm font-mono text-muted-foreground">
          {issue.plaintextLog}
        </div>

        {/* Metadata */}
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-sm">Issue Metadata</CardTitle></CardHeader>
          <CardContent>
            <Row label="Reported by" value={issue.reportingUserDisplayName} />
            <Row label="Timestamp" value={issue.createdAt ? format(new Date(issue.createdAt), 'PPpp') : '—'} />
            <Row label="Route" value={<code className="text-xs bg-muted px-1 rounded">{issue.currentRoute}</code>} />
            <Row label="Page" value={issue.pageTitle} />
            <Row label="Section" value={issue.currentSection} />
            <Row label="Element" value={issue.elementLabelText ?? issue.elementId} />
            <Row label="Component" value={issue.componentName} />
            <Row label="Scenario" value={issue.activeScenario} />
            <Row label="Template Profile" value={issue.activeTemplateProfile} />
            <Row label="App Version" value={issue.appVersion} />
            {issue.issueDetail && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-muted-foreground mb-1">Additional Detail</p>
                <p className="text-sm">{issue.issueDetail}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview link */}
        {snapshot && (
          <div className="mb-6 flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
            <Eye className="w-4 h-4 shrink-0" />
            <span>A read-only structural preview is available.</span>
            <Link href={`/admin/issues/${issueId}/preview`} className="ml-auto underline font-medium">
              View preview →
            </Link>
          </div>
        )}

        {/* Status control */}
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-sm">Status</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {['new', 'triaged', 'in_progress', 'resolved', 'dismissed'].map(s => (
                <Button
                  key={s}
                  size="sm"
                  variant={issue.status === s ? 'default' : 'outline'}
                  onClick={() => statusMutation.mutate(s)}
                  disabled={statusMutation.isPending}
                >
                  {s.replace('_', ' ')}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Admin notes */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              <CardTitle className="text-sm">Admin Notes ({notes.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {notes.map((n: any) => (
              <div key={n.id} className="mb-3 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium">{n.authorDisplayName}</span>
                  <span className="text-xs text-muted-foreground">{n.createdAt ? format(new Date(n.createdAt), 'MMM d, yyyy HH:mm') : ''}</span>
                </div>
                <p className="text-sm">{n.noteText}</p>
              </div>
            ))}
            <div className="mt-3 space-y-2">
              <Textarea
                placeholder="Add a note… (append-only, cannot be edited)"
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={3}
              />
              <Button size="sm" onClick={() => note.trim() && noteMutation.mutate(note)} disabled={noteMutation.isPending || !note.trim()}>
                Add Note
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
