import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiBase } from '@/hooks/use-auth';
import { Plus, Trash2, Calendar } from 'lucide-react';

interface PtoOption { id: number; value: number; label: string | null; createdAt: string; }

export default function AdminPto() {
  const { toast } = useToast();
  const [options, setOptions] = useState<PtoOption[]>([]);
  const [newValue, setNewValue] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  async function load() {
    const r = await fetch(`${apiBase()}/admin/pto-options`, { credentials: 'include' });
    if (r.ok) setOptions(await r.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd() {
    const val = parseInt(newValue);
    if (isNaN(val) || val <= 0) {
      toast({ title: 'Invalid value', description: 'Enter a positive integer.', variant: 'destructive' });
      return;
    }
    setAdding(true);
    try {
      const r = await fetch(`${apiBase()}/admin/pto-options`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: val, label: newLabel.trim() || undefined }),
      });
      if (r.ok) {
        setNewValue('');
        setNewLabel('');
        await load();
        toast({ title: 'PTO Option Added', description: `${val} hrs${newLabel.trim() ? ` – ${newLabel.trim()}` : ''} added.` });
      } else {
        const err = await r.json().catch(() => ({}));
        toast({ title: 'Error', description: err.error ?? 'Failed to add option.', variant: 'destructive' });
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: number, value: number, label: string | null) {
    const r = await fetch(`${apiBase()}/admin/pto-options/${id}`, { method: 'DELETE', credentials: 'include' });
    if (r.ok) {
      await load();
      toast({ title: 'Removed', description: `${value} hrs${label ? ` – ${label}` : ''} removed.` });
    } else {
      toast({ title: 'Error', description: 'Failed to remove option.', variant: 'destructive' });
    }
  }

  // Group entries by value for display
  const grouped = options.reduce<Record<number, PtoOption[]>>((acc, o) => {
    (acc[o.value] ??= []).push(o);
    return acc;
  }, {});
  const sortedValues = Object.keys(grouped).map(Number).sort((a, b) => a - b);

  return (
    <AdminLayout>
      <div className="max-w-lg">
        <div className="flex items-center gap-3 mb-6">
          <Calendar className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-serif font-bold">PTO Options</h1>
            <p className="text-sm text-muted-foreground">
              Manage the available annual PTO hours values shown in the offer form. Multiple conditions can share the same hour count.
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Add New Option</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3 items-center">
              <Input
                type="number"
                placeholder="e.g. 160"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                className="w-32"
                min={1}
              />
              <span className="text-sm text-muted-foreground shrink-0">hrs</span>
              <Input
                placeholder="Condition (e.g. Group 1, <5 yrs)"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                className="flex-1"
              />
              <Button onClick={handleAdd} disabled={adding || !newValue}>
                <Plus className="w-4 h-4 mr-2" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current Options ({options.length} entries, {sortedValues.length} unique hour values)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : options.length === 0 ? (
              <p className="text-sm text-muted-foreground">No PTO options configured yet.</p>
            ) : (
              <div className="divide-y">
                {sortedValues.map(val => (
                  <div key={val} className="py-3">
                    <p className="text-sm font-semibold tabular-nums text-foreground mb-1">{val} hrs</p>
                    <div className="space-y-1 pl-3">
                      {grouped[val].map(opt => (
                        <div key={opt.id} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-muted-foreground">
                            {opt.label ?? <span className="italic text-slate-400">No condition specified</span>}
                          </span>
                          <Button
                            variant="ghost" size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0 h-7 w-7 p-0"
                            onClick={() => handleDelete(opt.id, opt.value, opt.label)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
