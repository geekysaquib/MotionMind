import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useStores } from '../../stores/RootStore';
import { AuthLayout } from '../../layout/AuthLayout';
import { Alert, Button, Field } from '../../components/ui';
import { errorText } from '../../lib/format';

export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return 'Use at least 8 characters.';
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return 'Mix letters and numbers.';
  return null;
}

export function SignupPage() {
  const { auth } = useStores();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState(false);
  const pwProblem = passwordProblem(password);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (pwProblem) return;
    setError(null);
    setBusy(true);
    try {
      const { needsConfirmation } = await auth.signUp(email, password, name);
      if (needsConfirmation) setConfirmEmail(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Create your studio"
      subtitle="Free to start. You'll pick your handle next."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {confirmEmail ? (
        <Alert tone="success">
          Almost there. We sent a confirmation link to <strong>{email}</strong>. Open it to finish creating your account.
        </Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Your name" autoComplete="name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Saquib Khan" />
          <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <Field
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched(true)}
            error={touched ? pwProblem : null}
            hint="At least 8 characters, with letters and numbers."
          />
          {error && <Alert>{error}</Alert>}
          <Button type="submit" className="w-full" size="lg" loading={busy} disabled={!name.trim() || !email.trim()}>
            Create account
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
