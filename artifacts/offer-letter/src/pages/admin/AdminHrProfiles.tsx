import { useState, useEffect } from 'react';
import { AdminLayout } from './AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiBase } from '@/hooks/use-auth';
import { KINROSS_SITES, siteLabel } from '@/data/kinross-sites';
import { Plus, Pencil, Trash2, UserCheck, X, Check } from 'lucide-react';

interface HrProfile {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  site: string | null;
  isActive: boolean;
  createdAt: string;
}

const EMPTY: Omit<HrProfile, 'id' | 'createdAt'> = {
  firstName: '', lastName: '', email: '', site: '', isActive: true,
};

export default function AdminHrProfiles() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<HrProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  async function load() {
    const r = await fetch(`${apiBase()}/admin/hr-profiles`, { credentials: 'include' });
    if (r.ok) setProfiles(await r.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startAdd() {
    setForm({ ...EMPTY });
    setEditId(null);
    setShowAdd(true);
  }

  function startEdit(p: HrProfile) {
    setForm({ firstName: p.firstName, lastName: p.lastName, email: p.email ?? '', site: p.site ?? '', isActive: p.isActive });
    setEditId(p.id);
    setShowAdd(true);
  }

  function cancelForm() {
    setShowAdd(false);
    setEditId(null);
    setForm({ ...EMPTY });
  }

  async function handleSave() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast({ title: 'Required', description: 'First and last name are required.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const url = editId != null
        ? `${apiBase()}/admin/hr-profiles/${editId}`
        : `${apiBase()}/admin/hr-profiles`;
      const method = editId != null ? 'PUT' : 'POST';
      const r = await fetch(url, {
        method, credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, email: form.email || null, site: form.site || null }),
      });
      if (r.ok) {
        await load();
        cancelForm();
        toast({ title: editId != null ? 'Profile updated' : 'Profile created', description: `${form.firstName} ${form.lastName} saved.` });
      } else {
        const err = await r.json().catch(() => ({}));
        toast({ title: 'Error', description: err.error ?? 'Save failed.', variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: HrProfile) {
    if (!confirm(`Delete HR profile for ${p.firstName} ${p.lastName}? This cannot be undone.`)) return;
    const r = await fetch(`${apiBase()}/admin/hr-profiles/${p.id}`, { method: 'DELETE', credentials: 'include' });
    if (r.ok) {
      await load();
      toast({ title: 'Deleted', description: `${p.firstName} ${p.lastName} removed.` });
    } else {
      toast({ title: 'Error', description: 'Failed to delete profile.', variant: 'destructive' });
    }
  }

  async function handleToggleActive(p: HrProfile) {
    const r = await fetch(`${apiBase()}/admin/hr-profiles/${p.id}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: p.firstName, lastName: p.lastName, email: p.email, site: p.site, isActive: !p.isActive }),
    });
    if (r.ok) {
      await load();
      toast({ title: p.isActive ? 'Deactivated' : 'Activated', description: `${p.firstName} ${p.lastName} ${p.isActive ? 'will no longer appear in dropdowns' : 'is now active'}.` });
    } else {
      toast({ title: 'Error', description: 'Failed to update status.', variant: 'destructive' });
    }
  }

  return (
    <AdminLayout>
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <UserCheck className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-serif font-bold">HR Contacts</h1>
              <p className="text-sm text-muted-foreground">
                Manage HR representatives that appear in the offer letter HR Contact dropdown. These are separate from user accounts.
              </p>
            </div>
          </div>
          {!showAdd && (
            <Button onClick={startAdd} size="sm">
              <Plus className="w-4 h-4 mr-1.5" /> Add Contact
            </Button>
          )}
        </div>

        {/* Add / Edit form */}
        {showAdd && (
          <Card className="mb-6 border-primary/30 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{editId != null ? 'Edit HR Contact' : 'New HR Contact'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">First Name *</label>
                  <Input
                    value={form.firstName}
                    onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                    placeholder="Renee"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Last Name *</label>
                  <Input
                    value={form.lastName}
                    onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                    placeholder="Karikas"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <Input
                    type="email"
                    value={form.email ?? ''}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="renee.karikas@kinross.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Site (optional)</label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                    value={form.site ?? ''}
                    onChange={e => setForm(f => ({ ...f, site: e.target.value || '' }))}
                  >
                    <option value="">— No site —</option>
                    {KINROSS_SITES.map(s => (
                      <option key={s.id} value={s.id}>{siteLabel(s)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                    className="accent-primary"
                  />
                  Active (appears in dropdowns)
                </label>
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={handleSave} disabled={saving} size="sm">
                  <Check className="w-4 h-4 mr-1.5" /> {saving ? 'Saving…' : 'Save'}
                </Button>
                <Button variant="ghost" onClick={cancelForm} size="sm">
                  <X className="w-4 h-4 mr-1.5" /> Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Profile list */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : profiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No HR contacts yet. Add one above.</p>
        ) : (
          <div className="space-y-2">
            {profiles.map(p => (
              <Card key={p.id} className={`${!p.isActive ? 'opacity-50' : ''}`}>
                <CardContent className="py-3 px-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {p.firstName} {p.lastName}
                      {!p.isActive && <span className="ml-2 text-xs text-muted-foreground font-normal">(inactive)</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 space-x-3">
                      {p.email && <span>{p.email}</span>}
                      {p.site && <span>{(() => { const s = KINROSS_SITES.find(x => x.id === p.site); return s ? siteLabel(s) : p.site; })()}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleToggleActive(p)}
                    >
                      {p.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => startEdit(p)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 hover:text-destructive"
                      onClick={() => handleDelete(p)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
