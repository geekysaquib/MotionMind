import { useState, type FormEvent } from 'react';
import { useStores } from '../../stores/RootStore';
import { AuthLayout } from '../../layout/AuthLayout';
import { Alert, Button, Field } from '../../components/ui';
import { errorText } from '../../lib/format';
import { DEMO_CODE } from '../../services/memory';

/** One screen for sign-in and sign-up: enter an email, then the 6-digit code we send to it. */
export function LoginPage() {
  const { auth, services } = useStores();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await auth.requestCode(email);
      setStep('code');
      setCode('');
      setNotice(`We sent a 6-digit code to ${email.trim()}. It expires in 10 minutes.`);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await auth.verifyCode(email, code);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title={step === 'email' ? 'Sign in to Motion Mind' : 'Check your email'}
      subtitle={step === 'email' ? "Enter your email and we'll send you a code. New here? This creates your account." : undefined}
    >
      {step === 'email' ? (
        <form onSubmit={send} className="space-y-4">
          <Field label="Email" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          {error && <Alert>{error}</Alert>}
          <Button type="submit" className="w-full" size="lg" loading={busy}>
            Send code
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          {notice && <Alert tone="success">{notice}</Alert>}
          {services.mode === 'memory' && <Alert tone="info">Demo mode sends no email. Use code {DEMO_CODE}.</Alert>}
          <Field
            label="Sign-in code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
          />
          {error && <Alert>{error}</Alert>}
          <Button type="submit" className="w-full" size="lg" loading={busy} disabled={code.length !== 6}>
            Sign in
          </Button>
          <div className="flex justify-between text-sm">
            <button
              type="button"
              className="text-ink-400 hover:text-ink-100"
              onClick={() => {
                setStep('email');
                setError(null);
                setNotice(null);
              }}
            >
              Use a different email
            </button>
            <button type="button" className="font-semibold text-accent hover:underline" disabled={busy} onClick={() => void send()}>
              Resend code
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
