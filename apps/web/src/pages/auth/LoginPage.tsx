import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, KeyRound } from 'lucide-react';
import { useStores } from '../../stores/RootStore';
import { AuthLayout } from '../../layout/AuthLayout';
import { Alert, Button, Field } from '../../components/ui';
import { errorText } from '../../lib/format';
import { cn } from '../../lib/cn';

export function LoginPage() {
  const { auth, services } = useStores();
  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'password') await auth.signIn(email, password);
      else {
        await auth.sendMagicLink(email);
        setSent(true);
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue making reels."
      footer={
        <>
          New to Motion Mind?{' '}
          <Link to="/signup" className="font-semibold text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <div className="mb-6 grid grid-cols-2 rounded-xl border border-line/10 bg-ink-900 p-1 text-sm" role="tablist">
        {(['password', 'magic'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
              setSent(false);
            }}
            className={cn('flex items-center justify-center gap-2 rounded-lg py-2 font-medium transition', mode === m ? 'bg-line/10 text-ink-100' : 'text-ink-400 hover:text-ink-100')}
          >
            {m === 'password' ? <KeyRound className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
            {m === 'password' ? 'Password' : 'Email link'}
          </button>
        ))}
      </div>
      {sent ? (
        <Alert tone="success">Check {email} for a sign-in link. You can close this tab.</Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          {mode === 'password' && (
            <Field
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint={
                <Link to="/forgot-password" className="text-accent hover:underline">
                  Forgot password?
                </Link>
              }
            />
          )}
          {mode === 'magic' && services.mode === 'memory' && <Alert tone="info">Email links need Supabase. In demo mode, use a password.</Alert>}
          {error && <Alert>{error}</Alert>}
          <Button type="submit" className="w-full" size="lg" loading={busy}>
            {mode === 'password' ? 'Sign in' : 'Email me a link'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
