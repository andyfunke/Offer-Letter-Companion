import { useState, FormEvent } from 'react';
import { useAuth, apiBase } from '@/hooks/use-auth';
import { Shield, Eye, EyeOff, Loader2, CheckCircle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Step = 'form' | 'done';

export default function Setup() {
  const { completeSetup } = useAuth();
  const [step, setStep] = useState<Step>('form');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function passwordStrength(pw: string): { label: string; color: string; pct: number } {
    if (pw.length === 0) return { label: '', color: 'bg-muted', pct: 0 };
    const checks = [
      pw.length >= 12,
      /[A-Z]/.test(pw),
      /[a-z]/.test(pw),
      /[0-9]/.test(pw),
      /[^A-Za-z0-9]/.test(pw),
    ];
    const score = checks.filter(Boolean).length;
    if (score <= 2) return { label: 'Weak', color: 'bg-red-500', pct: 33 };
    if (score <= 3) return { label: 'Fair', color: 'bg-amber-500', pct: 60 };
    if (score === 4) return { label: 'Good', color: 'bg-blue-500', pct: 80 };
    return { label: 'Strong', color: 'bg-emerald-500', pct: 100 };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }

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
      if (!r.ok) {
        setError(json.error ?? 'Setup failed. Please try again.');
        return;
      }
      // API auto-logs in after setup
      completeSetup(json);
      setStep('done');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const strength = passwordStrength(password);

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="inline-flex w-16 h-16 items-center justify-center rounded-full bg-emerald-100 mb-6">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="font-serif text-2xl font-bold mb-2">You're all set</h1>
          <p className="text-muted-foreground text-sm mb-8">
            Your admin account has been created and you're signed in. Welcome to the Kinross Offer Letter Companion.
          </p>
          <Button className="w-full" onClick={() => window.location.href = '/'}>
            Go to app →
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 items-center justify-center rounded-full bg-primary/10 mb-4">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-serif text-2xl font-bold">Welcome to Kinross HR</h1>
          <p className="text-muted-foreground text-sm mt-1">Let's create your admin account to get started.</p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex-1 h-1.5 rounded-full bg-primary" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">Step 1 of 1</span>
          <div className="flex-1 h-1.5 rounded-full bg-muted" />
        </div>

        <Card className="shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              Create First Admin Account
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              This account will have full system access. You can create more users afterward.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Username <span className="text-destructive">*</span></label>
                <Input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="e.g. admin"
                  required
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">Letters, numbers, _ . - only</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Email <span className="text-muted-foreground text-xs">(optional)</span></label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="hr@kinross.com"
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Password <span className="text-destructive">*</span></label>
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

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Confirm Password <span className="text-destructive">*</span></label>
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

              <Button
                type="submit"
                className="w-full"
                disabled={loading || !username || !password || password !== confirm}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create account and continue
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex gap-2">
          <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <span>
            This screen only appears once, when no accounts exist.
            After setup, access is restricted to authenticated users only.
          </span>
        </div>
      </div>
    </div>
  );
}
