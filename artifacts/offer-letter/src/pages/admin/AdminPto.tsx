import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiBase } from '@/hooks/use-auth';
import { Plus, Trash2, Calendar } from 'lucide-react';

interface PtoOption { id: number; value: number; createdAt: string; }

export default function AdminPto() {
  const { toast } = useToast();
  const [options, setOptions] = useState<PtoOption[]>([]);
  const [newValue, setNewValue] = useState('');
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
    if (isNaN(val) || val <= 0) { toast({ title: 'Invalid value', description: 'Enter a positive integer.', variant: 'destructive' }); return; }
    setAdding(true);
    try {
      const r = await fetch(`${apiBase()}/admin/pto-options`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: val }),
      });
      if (r.ok) {
        setNewValue('');
        await load();
        toast({ title: 'PTO Option Added', description: `${val} hours added.` });
      } else {
        const err = await r.json().catch(() => ({}));
        toast({ title: 'Error', description: err.error ?? 'Failed to add option.', variant: 'destructive' });
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: number, value: number) {
    const r = await fetch(`${apiBase()}/admin/pto-options/${id}`, { method: 'DELETE', credentials: 'include' });
    if (r.ok) {
      await load();
      toast({ title: 'Removed', description: `${value} hours removed.` });
    } else {
      toast({ title: 'Error', description: 'Failed to remove option.', variant: 'destructive' });
    }
  }

  return (
    <AdminLayout>
      <div className="max-w-lg">
        <div className="flex items-center gap-3 mb-6">
          <Calendar className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-serif font-bold">PTO Options</h1>
            <p className="text-sm text-muted-foreground">Manage the available annual PTO hours values shown in the offer form dropdown.</p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Add New Option</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                type="number"
                placeholder="e.g. 160"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                className="w-40"
                min={1}
              />
              <span className="flex items-center text-sm text-muted-foreground">hours</span>
              <Button onClick={handleAdd} disabled={adding || !newValue}>
                <Plus className="w-4 h-4 mr-2" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current Options ({options.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : options.length === 0 ? (
              <p className="text-sm text-muted-foreground">No PTO options configured yet.</p>
            ) : (
              <div className="divide-y">
                {options.map(opt => (
                  <div key={opt.id} className="flex items-center justify-between py-3">
                    <span className="font-medium tabular-nums">{opt.value} hours</span>
                    <Button
                      variant="ghost" size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(opt.id, opt.value)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
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
