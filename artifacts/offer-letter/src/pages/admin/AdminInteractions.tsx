import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from './AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiBase } from '@/hooks/use-auth';
import { Activity, RefreshCw, Download } from 'lucide-react';
import { format } from 'date-fns';

interface Interaction {
  id: number;
  userId: number | null;
  username: string | null;
  action: string;
  element: string;
  page: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  CLICK: 'bg-blue-100 text-blue-800',
  CHANGE: 'bg-purple-100 text-purple-800',
  EXPORT: 'bg-green-100 text-green-800',
  SUBMIT: 'bg-amber-100 text-amber-800',
  LOAD: 'bg-slate-100 text-slate-700',
  SAVE: 'bg-indigo-100 text-indigo-800',
  DEFAULT: 'bg-gray-100 text-gray-700',
};

function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_COLORS[action] ?? ACTION_COLORS.DEFAULT;
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide ${cls}`}>
      {action}
    </span>
  );
}

export default function AdminInteractions() {
  const { toast } = useToast();
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${apiBase()}/admin/interactions?limit=300`, { credentials: 'include' });
      if (r.ok) {
        const data = await r.json();
        setInteractions(data.interactions ?? []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  const filtered = filter.trim()
    ? interactions.filter(i =>
        (i.username ?? '').toLowerCase().includes(filter.toLowerCase()) ||
        i.element.toLowerCase().includes(filter.toLowerCase()) ||
        i.action.toLowerCase().includes(filter.toLowerCase()) ||
        (i.page ?? '').toLowerCase().includes(filter.toLowerCase())
      )
    : interactions;

  function handleExport() {
    const csv = [
      'timestamp,user,action,element,page,details',
      ...filtered.map(i => [
        `"${i.createdAt}"`,
        `"${i.username ?? ''}"`,
        `"${i.action}"`,
        `"${i.element.replace(/"/g, '""')}"`,
        `"${i.page ?? ''}"`,
        `"${i.details ? JSON.stringify(i.details).replace(/"/g, '""') : ''}"`,
      ].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interactions_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${filtered.length} rows exported as CSV.` });
  }

  return (
    <AdminLayout>
      <div className="max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-serif font-bold">Activity Log</h1>
              <p className="text-sm text-muted-foreground">
                All user interactions — actions, timestamps, and elements interacted with.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
                className="accent-primary"
              />
              Auto-refresh (10s)
            </label>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0}>
              <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
            </Button>
          </div>
        </div>

        <div className="mb-4">
          <Input
            placeholder="Filter by user, action, element, or page…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {filter ? 'No matching interactions.' : 'No interactions recorded yet. Activity will appear here as users interact with the app.'}
          </p>
        ) : (
          <div className="border rounded-lg overflow-hidden text-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5 font-medium">Timestamp</th>
                  <th className="text-left px-4 py-2.5 font-medium">User</th>
                  <th className="text-left px-4 py-2.5 font-medium">Action</th>
                  <th className="text-left px-4 py-2.5 font-medium">Element</th>
                  <th className="text-left px-4 py-2.5 font-medium">Page</th>
                  <th className="text-left px-4 py-2.5 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(i => (
                  <tr key={i.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap font-mono">
                      {format(new Date(i.createdAt), 'MMM d, yyyy HH:mm:ss')}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-xs whitespace-nowrap">
                      {i.username ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <ActionBadge action={i.action} />
                    </td>
                    <td className="px-4 py-2.5 max-w-[220px] truncate" title={i.element}>
                      {i.element}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {i.page ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[180px] truncate font-mono">
                      {i.details ? JSON.stringify(i.details) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 text-xs text-muted-foreground bg-muted/20 border-t">
              Showing {filtered.length} of {interactions.length} interactions
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
