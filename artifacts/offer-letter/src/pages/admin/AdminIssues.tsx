import { useState } from 'react';
import { AdminLayout } from './AdminLayout';
import { Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Eye } from 'lucide-react';

function apiBase() {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
  return `${base}/../api`.replace('//', '/');
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-red-100 text-red-700',
  triaged: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  dismissed: 'bg-slate-100 text-slate-500',
};

export default function AdminIssues() {
  const [status, setStatus] = useState('');
  const [route, setRoute] = useState('');
  const qc = useQueryClient();

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (route) params.set('route', route);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-issues', status, route],
    queryFn: () =>
      fetch(`${apiBase()}/admin/issues?${params}`, { credentials: 'include' }).then(r => r.json()),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      fetch(`${apiBase()}/admin/issues/${id}/status`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-issues'] }),
  });

  const issues: any[] = data?.issues ?? [];

  return (
    <AdminLayout>
      <div className="max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-serif font-bold">Issue Reports</h1>
          <span className="text-sm text-muted-foreground">{issues.length} issues</span>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <select
            className="border rounded-md px-3 py-1.5 text-sm"
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="triaged">Triaged</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
          <Input
            className="w-48 h-8 text-sm"
            placeholder="Filter by route…"
            value={route}
            onChange={e => setRoute(e.target.value)}
          />
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading issues…</p>
        ) : issues.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No issues found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {issues.map((issue: any) => (
              <div key={issue.id} className="border rounded-xl bg-card p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-xs text-muted-foreground">{issue.issueRef}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[issue.status] ?? ''}`}>
                      {issue.status}
                    </span>
                    {issue.currentSection && (
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {issue.currentSection}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium mb-0.5">{issue.issueSummary}</p>
                  <p className="text-xs text-muted-foreground">
                    {issue.reportingUserDisplayName} · {issue.pageTitle} ·{' '}
                    {issue.createdAt ? format(new Date(issue.createdAt), 'MMM d, yyyy HH:mm') : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    className="text-xs border rounded px-2 py-1"
                    value={issue.status}
                    onChange={e => statusMutation.mutate({ id: issue.id, status: e.target.value })}
                  >
                    <option value="new">New</option>
                    <option value="triaged">Triaged</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                  <Link href={`/admin/issues/${issue.id}`}>
                    <Button size="sm" variant="outline" className="h-7 text-xs">
                      <Eye className="w-3.5 h-3.5 mr-1" /> View
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
