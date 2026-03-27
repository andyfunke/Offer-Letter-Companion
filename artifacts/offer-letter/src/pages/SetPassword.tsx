import { useState, FormEvent } from 'react';
import { useAuth, apiBase } from '@/hooks/use-auth';
import { KeyRound, Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';
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

export default function SetPassword() {
  const { user, passwordReset } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
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
      const r = await fetch(`${apiBase()}/auth/set-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newPassword: password }),
      });
      const json = await r.json();
      if (!r.ok) { setError(json.error ?? 'Failed to set password.'); return; }
      setDone(true);
      setTimeout(() => passwordReset(), 1200);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const strength = passwordStrength(password);
  const canSubmit = password.length >= 12 && password === confirm && !loading;

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex w-16 h-16 items-center justify-center rounded-full bg-emerald-100 mb-4 animate-in zoom-in duration-300">
            <CheckCircle className="w-9 h-9 text-emerald-600" />
          </div>
          <h2 className="font-serif text-xl font-bold mb-1">Password set</h2>
          <p className="text-muted-foreground text-sm">Taking you into the app…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <div className="inline-flex w-14 h-14 items-center justify-center rounded-full bg-primary/10 mb-4">
            <KeyRound className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-serif text-2xl font-bold">Set Your Password</h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            Welcome, <strong>{user?.username}</strong>. Your account was created without a password — please set one now to continue.
          </p>
        </div>

        <Card className="shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Choose a password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Password <span className="text-destructive">*</span>
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
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`} style={{ width: `${strength.pct}%` }} />
                    </div>
                    {strength.label && <p className={`text-xs font-medium ${strength.pct <= 33 ? 'text-red-600' : strength.pct <= 60 ? 'text-amber-600' : strength.pct <= 80 ? 'text-blue-600' : 'text-emerald-600'}`}>{strength.label}</p>}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">
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
                  <p className="text-xs text-destructive">Passwords do not match</p>
                )}
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</> : 'Set password and continue →'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
