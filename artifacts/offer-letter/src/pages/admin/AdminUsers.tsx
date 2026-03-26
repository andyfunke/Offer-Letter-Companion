import { useState } from 'react';
import { AdminLayout } from './AdminLayout';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, RefreshCw, Check, X, Key } from 'lucide-react';
import { format } from 'date-fns';

function apiBase() {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
  return `${base}/../api`.replace('//', '/');
}

const ROLE_COLORS: Record<string, string> = {
  recruiter: 'bg-slate-100 text-slate-700',
  hr_admin: 'bg-blue-100 text-blue-700',
  system_admin: 'bg-purple-100 text-purple-700',
};

export default function AdminUsers() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'recruiter' });
  const [formError, setFormError] = useState('');
  const [resetTarget, setResetTarget] = useState<number | null>(null);
  const [resetPw, setResetPw] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () =>
      fetch(`${apiBase()}/admin/users`, { credentials: 'include' }).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) =>
      fetch(`${apiBase()}/admin/users`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? 'Failed');
        return j;
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); setCreating(false); setForm({ username: '', email: '', password: '', role: 'recruiter' }); },
    onError: (e: Error) => setFormError(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      id === me?.id && !isActive
        ? Promise.reject(new Error("Cannot deactivate your own account."))
        : fetch(`${apiBase()}/admin/users/${id}`, {
            method: 'PUT', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive }),
          }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) =>
      fetch(`${apiBase()}/admin/users/${id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: number; newPassword: string }) =>
      fetch(`${apiBase()}/admin/users/${id}/reset-password`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; }),
    onSuccess: () => { setResetTarget(null); setResetPw(''); },
    onError: (e: Error) => alert(e.message),
  });

  const users: any[] = data?.users ?? [];

  return (
    <AdminLayout>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-serif font-bold">User Management</h1>
          <Button size="sm" onClick={() => setCreating(v => !v)}>
            <UserPlus className="w-4 h-4 mr-2" /> New User
          </Button>
        </div>

        {creating && (
          <Card className="mb-6 border-primary/30">
            <CardHeader><CardTitle className="text-base">Create User</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div><label className="text-xs font-medium mb-1 block">Username *</label><Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} /></div>
                <div><label className="text-xs font-medium mb-1 block">Email</label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div><label className="text-xs font-medium mb-1 block">Password * (12+ chars)</label><Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Role</label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="recruiter">Recruiter</option>
                    <option value="hr_admin">HR Admin</option>
                    <option value="system_admin">System Admin</option>
                  </select>
                </div>
              </div>
              {formError && <p className="text-xs text-destructive mb-2">{formError}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { setFormError(''); createMutation.mutate(form); }} disabled={createMutation.isPending}><Check className="w-4 h-4 mr-1" /> Create</Button>
                <Button size="sm" variant="ghost" onClick={() => setCreating(false)}><X className="w-4 h-4 mr-1" /> Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? <p className="text-muted-foreground text-sm">Loading users…</p> : (
          <div className="space-y-2">
            {users.map((u: any) => (
              <Card key={u.id} className={u.isActive ? '' : 'opacity-60'}>
                <CardContent className="py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{u.username}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] ?? ''}`}>{u.role}</span>
                      {!u.isActive && <span className="text-xs text-muted-foreground">(deactivated)</span>}
                      {u.isBootstrapAdmin && <span className="text-xs text-amber-600">(bootstrap admin)</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {u.email ?? 'No email'} · Created {u.createdAt ? format(new Date(u.createdAt), 'MMM d, yyyy') : '—'}
                      {u.lastLoginAt ? ` · Last login ${format(new Date(u.lastLoginAt), 'MMM d, yyyy HH:mm')}` : ' · Never logged in'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Role change */}
                    <select
                      className="text-xs border rounded px-2 py-1"
                      value={u.role}
                      disabled={u.id === me?.id}
                      onChange={e => roleMutation.mutate({ id: u.id, role: e.target.value })}
                    >
                      <option value="recruiter">Recruiter</option>
                      <option value="hr_admin">HR Admin</option>
                      <option value="system_admin">System Admin</option>
                    </select>
                    {/* Reset password */}
                    {resetTarget === u.id ? (
                      <div className="flex items-center gap-1">
                        <Input type="password" placeholder="New password" className="h-7 text-xs w-32" value={resetPw} onChange={e => setResetPw(e.target.value)} />
                        <Button size="sm" className="h-7 text-xs" onClick={() => resetMutation.mutate({ id: u.id, newPassword: resetPw })}>Set</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setResetTarget(null)}>✕</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setResetTarget(u.id)}>
                        <Key className="w-3.5 h-3.5 mr-1" /> Reset PW
                      </Button>
                    )}
                    {/* Deactivate / Reactivate */}
                    {u.id !== me?.id && (
                      <Button
                        size="sm"
                        variant={u.isActive ? 'destructive' : 'outline'}
                        className="h-7 text-xs"
                        onClick={() => toggleMutation.mutate({ id: u.id, isActive: !u.isActive })}
                      >
                        {u.isActive ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    )}
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
