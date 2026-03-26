import { useState, FormEvent } from 'react';
import { useLocation } from 'wouter';
import { useAuth, apiBase } from '@/hooks/use-auth';
import { Shield, Eye, EyeOff, Loader2, CheckCircle, Lock } from 'lucide-react';
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
  const [email, setEmail] = useState('');
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
      const r = await fetch(`${apiBase()}/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: username.trim(),
          password,
          email: email.trim() || undefined,
        }),
      });
      const json = await r.json();
      if (!r.ok) { setError(json.error ?? 'Setup failed.'); return; }

      // Mark done, update auth context, then navigate into the app
      setDone(true);
      completeSetup(json);
      setTimeout(() => navigate('/'), 1400);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const strength = passwordStrength(password);
  const canSubmit = username.trim().length >= 2 && password.length >= 12 && password === confirm && !loading;

  // ── Success flash ───────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-xs">
          <div className="inline-flex w-16 h-16 items-center justify-center rounded-full bg-emerald-100 mb-5 animate-in zoom-in duration-300">
            <CheckCircle className="w-9 h-9 text-emerald-600" />
          </div>
          <h1 className="font-serif text-2xl font-bold mb-2">Account created</h1>
          <p className="text-muted-foreground text-sm">Signing you in…</p>
        </div>
      </div>
    );
  }

  // ── Setup form ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-7">
          <div className="inline-flex w-14 h-14 items-center justify-center rounded-full bg-primary/10 mb-4">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-serif text-2xl font-bold">Welcome to Kinross HR</h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            Create your admin account to get started.
          </p>
        </div>

        {/* "First time only" badge */}
        <div className="flex items-center gap-2 justify-center mb-6">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground px-2 whitespace-nowrap flex items-center gap-1.5">
            <Lock className="w-3 h-3" /> One-time setup
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Card className="shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Create First Admin Account</CardTitle>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This account has full system access. You can add more users from the admin panel afterward.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Username */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Username <span className="text-destructive">*</span>
                </label>
                <Input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="e.g. admin"
                  required
                  disabled={loading}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">Letters, numbers, _ . - only</p>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Email <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="hr@kinross.com"
                  disabled={loading}
                />
              </div>

              {/* Password */}
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
                {/* Strength bar */}
                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                        style={{ width: `${strength.pct}%` }}
                      />
                    </div>
                    <p className={`text-xs font-medium ${
                      strength.pct <= 33 ? 'text-red-600' :
                      strength.pct <= 60 ? 'text-amber-600' :
                      strength.pct <= 80 ? 'text-blue-600' : 'text-emerald-600'
                    }`}>{strength.label}</p>
                  </div>
                )}
              </div>

              {/* Confirm */}
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

              {/* Error */}
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              {/* Submit */}
              <Button type="submit" className="w-full" disabled={!canSubmit}>
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating account…</>
                  : 'Create account and continue →'
                }
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground mt-5 leading-relaxed">
          This screen only appears once. After setup, the app requires login and
          is restricted to authorized Kinross HR personnel.
        </p>
      </div>
    </div>
  );
}
