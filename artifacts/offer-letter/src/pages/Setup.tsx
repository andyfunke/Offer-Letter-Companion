import { useState, FormEvent } from 'react';
import { useLocation } from 'wouter';
import { useAuth, apiBase } from '@/hooks/use-auth';
import { Shield, Users, Check, Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function passwordStrength(pw: string): { label: string; color: string; pct: number } {
  if (!pw) return { label: '', color: 'bg-muted', pct: 0 };
  const checks = [pw.length >= 12, /[A-Z]/.test(pw), /[a-z]/.test(pw), /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw)];
  const score = checks.filter(Boolean).length;
  if (score <= 2) return { label: 'Weak', color: 'bg-red-500', pct: 33 };
  if (score <= 3) return { label: 'Fair', color: 'bg-amber-500', pct: 60 };
  if (score === 4) return { label: 'Good', color: 'bg-blue-500', pct: 80 };
  return { label: 'Strong', color: 'bg-emerald-500', pct: 100 };
}

export default function Setup() {
  const { completeSetup } = useAuth();
  const [, navigate] = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [role, setRole] = useState('system_admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 12) { setError('Password must be at least 12 characters.'); return; }

    setLoading(true);
    try {
      const r = await fetch(`${apiBase()}/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const json = await r.json();
      if (!r.ok) { setError(json.error ?? 'Setup failed.'); return; }
      setDone(true);
      completeSetup(json);
      setTimeout(() => navigate('/'), 1200);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const strength = passwordStrength(password);
  const canSubmit = username.trim().length >= 2 && password.length >= 12 && password === confirm && !loading;

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex w-16 h-16 items-center justify-center rounded-full bg-emerald-100 mb-4 animate-in zoom-in duration-300">
            <CheckCircle className="w-9 h-9 text-emerald-600" />
          </div>
          <h2 className="font-serif text-xl font-bold mb-1">Account created</h2>
          <p className="text-muted-foreground text-sm">Signing you in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">

      {/* Sidebar — mirrors AdminLayout exactly */}
      <div className="w-56 bg-card border-r flex flex-col shrink-0">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">Admin Panel</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">First-time setup</p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {/* Only Users nav item is relevant during setup */}
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm bg-primary/10 text-primary font-medium">
            <Users className="w-4 h-4" /> Users
          </div>
        </nav>

        <div className="border-t p-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Create the first admin account to unlock the application.
          </p>
        </div>
      </div>

      {/* Main content — mirrors AdminLayout */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Breadcrumb bar */}
        <div className="h-12 border-b bg-card/50 flex items-center px-6 gap-2 text-sm text-muted-foreground shrink-0">
          <span>Admin</span>
          <span className="text-muted-foreground/50">›</span>
          <span className="text-foreground">Users</span>
        </div>

        {/* Page body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-serif font-bold">User Management</h1>
            </div>

            {/* Create user card — pre-opened, no close button during setup */}
            <Card className="mb-6 border-primary/30">
              <CardHeader>
                <CardTitle className="text-base">Create Account</CardTitle>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  No accounts exist yet. Create the first admin account to get started.
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit}>
                  <div className="grid grid-cols-2 gap-3 mb-3">

                    {/* Username */}
                    <div>
                      <label className="text-xs font-medium mb-1 block">
                        Username <span className="text-destructive">*</span>
                      </label>
                      <Input
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        autoComplete="username"
                        placeholder="e.g. andy"
                        required
                        disabled={loading}
                        autoFocus
                      />
                    </div>

                    {/* Role — locked to system_admin for first user */}
                    <div>
                      <label className="text-xs font-medium mb-1 block">Role</label>
                      <select
                        className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                        value={role}
                        onChange={e => setRole(e.target.value)}
                        disabled={loading}
                      >
                        <option value="recruiter">Recruiter</option>
                        <option value="hr_admin">HR Admin</option>
                        <option value="system_admin">System Admin</option>
                      </select>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="text-xs font-medium mb-1 block">
                        Password <span className="text-destructive">*</span>
                        <span className="font-normal text-muted-foreground ml-1">(12+ chars)</span>
                      </label>
                      <div className="relative">
                        <Input
                          type={showPw ? 'text' : 'password'}
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          autoComplete="new-password"
                          placeholder="12+ characters"
                          required
                          disabled={loading}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          tabIndex={-1}
                        >
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {password.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`} style={{ width: `${strength.pct}%` }} />
                          </div>
                          {strength.label && (
                            <p className={`text-xs font-medium ${strength.pct <= 33 ? 'text-red-600' : strength.pct <= 60 ? 'text-amber-600' : strength.pct <= 80 ? 'text-blue-600' : 'text-emerald-600'}`}>
                              {strength.label}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Confirm */}
                    <div>
                      <label className="text-xs font-medium mb-1 block">
                        Confirm Password <span className="text-destructive">*</span>
                      </label>
                      <Input
                        type={showPw ? 'text' : 'password'}
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        autoComplete="new-password"
                        placeholder="Re-enter password"
                        required
                        disabled={loading}
                      />
                      {confirm.length > 0 && confirm !== password && (
                        <p className="text-xs text-destructive mt-1">Passwords do not match</p>
                      )}
                    </div>
                  </div>

                  {error && <p className="text-xs text-destructive mb-2">{error}</p>}

                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={!canSubmit}>
                      {loading
                        ? <><Loader2 className="w-4 h-4 animate-spin mr-1" />Creating…</>
                        : <><Check className="w-4 h-4 mr-1" /> Create</>
                      }
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

    </div>
  );
}
