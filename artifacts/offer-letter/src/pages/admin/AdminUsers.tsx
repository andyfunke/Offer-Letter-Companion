import { useState } from 'react';
import { AdminLayout } from './AdminLayout';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Check, X, Key, AlertTriangle, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { KINROSS_SITES } from '@/data/kinross-sites';

function apiBase() {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
  return `${base}/../api`.replace('//', '/');
}

const ROLE_COLORS: Record<string, string> = {
  user: 'bg-slate-100 text-slate-700',
  admin: 'bg-purple-100 text-purple-700',
  // legacy
  recruiter: 'bg-slate-100 text-slate-700',
  hr_admin: 'bg-blue-100 text-blue-700',
  system_admin: 'bg-purple-100 text-purple-700',
};

const ROLE_LABEL: Record<string, string> = {
  user: 'User', admin: 'Admin',
  recruiter: 'User (legacy)', hr_admin: 'Admin (legacy)', system_admin: 'Admin (legacy)',
};

const EMPTY_FORM = { username: '', email: '', password: '', role: 'user', site: '' };

export default function AdminUsers() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [resetTarget, setResetTarget] = useState<number | null>(null);
  const [resetPw, setResetPw] = useState('');
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => fetch(`${apiBase()}/admin/users`, { credentials: 'include' }).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) =>
      fetch(`${apiBase()}/admin/users`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? 'Failed'); return j; }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); setCreating(false); setForm(EMPTY_FORM); setFormError(''); },
    onError: (e: Error) => setFormError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number; [k: string]: unknown }) =>
      fetch(`${apiBase()}/admin/users/${id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
    onSuccess: () => { setResetTarget(null); setResetPw(''); qc.invalidateQueries({ queryKey: ['admin-users'] }); },
    onError: (e: Error) => alert(e.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${apiBase()}/admin/users/${id}`, { method: 'DELETE', credentials: 'include' }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${apiBase()}/admin/users/${id}?hard=true`, { method: 'DELETE', credentials: 'include' })
        .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; }),
    onSuccess: () => { setConfirmDelete(null); qc.invalidateQueries({ queryKey: ['admin-users'] }); },
    onError: (e: Error) => alert(e.message),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${apiBase()}/admin/users/${id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const users: any[] = data?.users ?? [];

  return (
    <AdminLayout>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-serif font-bold">User Management</h1>
          <Button size="sm" onClick={() => { setCreating(v => !v); setFormError(''); }}>
            <UserPlus className="w-4 h-4 mr-2" /> New User
          </Button>
        </div>

        {creating && (
          <Card className="mb-6 border-primary/30">
            <CardHeader>
              <CardTitle className="text-base">Create User</CardTitle>
              <p className="text-xs text-muted-foreground">Leave password blank to require the user to set one on first login.</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs font-medium mb-1 block">Username *</label>
                  <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="e.g. jsmith" autoFocus />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Email <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="hr@kinross.com" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Password <span className="text-muted-foreground font-normal">(leave blank for first-login setup)</span></label>
                  <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="12+ chars, or leave blank" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Role</label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium mb-1 block">Assigned Site <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.site} onChange={e => setForm(f => ({ ...f, site: e.target.value }))}>
                    <option value="">— No site assigned —</option>
                    {KINROSS_SITES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              {formError && <p className="text-xs text-destructive mb-2">{formError}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { setFormError(''); createMutation.mutate(form); }} disabled={createMutation.isPending || !form.username.trim()}>
                  <Check className="w-4 h-4 mr-1" /> Create
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setFormError(''); }}>
                  <X className="w-4 h-4 mr-1" /> Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? <p className="text-muted-foreground text-sm">Loading users…</p> : (
          <div className="space-y-2">
            {users.map((u: any) => (
              <Card key={u.id} className={u.isActive ? '' : 'opacity-60'}>
                <CardContent className="py-3 space-y-2">
                  {/* Top row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{u.username}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] ?? 'bg-slate-100'}`}>
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                    {!u.isActive && <span className="text-xs text-muted-foreground">(deactivated)</span>}
                    {u.isBootstrapAdmin && <span className="text-xs text-amber-600">(bootstrap admin)</span>}
                    {u.mustResetPassword && (
                      <span className="text-xs flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                        <AlertTriangle className="w-3 h-3" /> Must set password
                      </span>
                    )}
                  </div>

                  {/* Email + meta */}
                  <EmailRow userId={u.id} currentEmail={u.email}
                    onSave={(email) => updateMutation.mutate({ id: u.id, email })} />
                  <p className="text-xs text-muted-foreground">
                    Created {u.createdAt ? format(new Date(u.createdAt), 'MMM d, yyyy') : '—'}
                    {u.lastLoginAt ? ` · Last login ${format(new Date(u.lastLoginAt), 'MMM d HH:mm')}` : ' · Never logged in'}
                    {u.site && ` · ${KINROSS_SITES.find(s => s.id === u.site)?.label ?? u.site}`}
                  </p>

                  {/* Controls */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {/* Role selector */}
                    <select
                      className="text-xs border rounded px-2 py-1 bg-background"
                      value={['user', 'admin'].includes(u.role) ? u.role : (u.role === 'system_admin' || u.role === 'hr_admin' ? 'admin' : 'user')}
                      disabled={u.id === me?.id}
                      onChange={e => updateMutation.mutate({ id: u.id, role: e.target.value })}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>

                    {/* Site selector */}
                    <select
                      className="text-xs border rounded px-2 py-1 bg-background"
                      value={u.site ?? ''}
                      onChange={e => updateMutation.mutate({ id: u.id, site: e.target.value || null })}
                    >
                      <option value="">— No site —</option>
                      {KINROSS_SITES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>

                    {/* Password reset */}
                    {resetTarget === u.id ? (
                      <div className="flex items-center gap-1">
                        <Input type="password" placeholder="New password (12+)" className="h-7 text-xs w-44" value={resetPw} onChange={e => setResetPw(e.target.value)} />
                        <Button size="sm" className="h-7 text-xs" disabled={resetPw.length < 12} onClick={() => resetMutation.mutate({ id: u.id, newPassword: resetPw })}>Set</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setResetTarget(null)}>✕</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setResetTarget(u.id)}>
                        <Key className="w-3.5 h-3.5 mr-1" /> Reset PW
                      </Button>
                    )}

                    {u.id !== me?.id && (
                      <>
                        {u.isActive ? (
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => deactivateMutation.mutate(u.id)}>
                            Deactivate
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => reactivateMutation.mutate(u.id)}>
                            Reactivate
                          </Button>
                        )}

                        {confirmDelete === u.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-destructive font-medium">Delete permanently?</span>
                            <Button size="sm" variant="destructive" className="h-7 text-xs"
                              onClick={() => deleteMutation.mutate(u.id)} disabled={deleteMutation.isPending}>
                              Yes, Delete
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setConfirmDelete(u.id)}>
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                          </Button>
                        )}
                      </>
                    )}

                    {/* Event log toggle */}
                    <Button size="sm" variant="ghost" className="h-7 text-xs ml-auto text-muted-foreground"
                      onClick={() => setExpandedLog(expandedLog === u.id ? null : u.id)}>
                      {expandedLog === u.id ? <ChevronUp className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
                      History
                    </Button>
                  </div>

                  {/* Expandable event log */}
                  {expandedLog === u.id && <EventLog userId={u.id} />}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function EventLog({ userId }: { userId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['user-events', userId],
    queryFn: () =>
      fetch(`${apiBase()}/admin/users/${userId}/events`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : { events: [] }),
  });

  const events: any[] = data?.events ?? [];

  if (isLoading) return <p className="text-xs text-muted-foreground pl-1">Loading history…</p>;
  if (events.length === 0) return <p className="text-xs text-muted-foreground pl-1 italic">No recorded events yet.</p>;

  return (
    <div className="border-t pt-2 mt-1">
      <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Account History</p>
      <div className="space-y-1">
        {events.map((e: any) => (
          <div key={e.id} className="flex items-start gap-2 text-xs">
            <span className="text-muted-foreground shrink-0 tabular-nums">
              {e.createdAt ? format(new Date(e.createdAt), 'MMM d, yyyy HH:mm') : '—'}
            </span>
            <span className="font-medium text-foreground shrink-0">{e.event}</span>
            {e.detail && <span className="text-muted-foreground">{e.detail}</span>}
            <span className="text-muted-foreground ml-auto shrink-0">by {e.changedBy}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmailRow({ userId, currentEmail, onSave }: { userId: number; currentEmail: string | null; onSave: (email: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentEmail ?? '');

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input type="email" value={value} onChange={e => setValue(e.target.value)} className="h-7 text-xs w-52" placeholder="hr@kinross.com" autoFocus />
        <Button size="sm" className="h-7 text-xs" onClick={() => { onSave(value); setEditing(false); }}>Save</Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setValue(currentEmail ?? ''); setEditing(false); }}>✕</Button>
      </div>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 group">
      {currentEmail ? currentEmail : <span className="italic">No email — click to add</span>}
      <span className="opacity-0 group-hover:opacity-60 text-[10px] ml-1">edit</span>
    </button>
  );
}
