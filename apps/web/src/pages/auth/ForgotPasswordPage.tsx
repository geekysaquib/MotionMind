import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useStores } from '../../stores/RootStore';
import { AuthLayout } from '../../layout/AuthLayout';
import { Alert, Button, Field } from '../../components/ui';
import { errorText } from '../../lib/format';

export function ForgotPasswordPage() {
  const { auth } = useStores();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await auth.sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a link to set a new one."
      footer={
        <Link to="/login" className="font-semibold text-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <Alert tone="success">If an account exists for {email}, a reset link is on its way.</Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <Alert>{error}</Alert>}
          <Button type="submit" className="w-full" size="lg" loading={busy}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
