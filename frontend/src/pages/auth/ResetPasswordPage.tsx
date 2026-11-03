import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../stores/RootStore';
import { AuthLayout } from '../../layout/AuthLayout';
import { Alert, Button, Field, Spinner } from '../../components/ui';
import { errorText } from '../../lib/format';
import { passwordProblem } from './SignupPage';

/** Landing page for the password-recovery email. Supabase signs the user in from the link first. */
export const ResetPasswordPage = observer(function ResetPasswordPage() {
  const { auth, toasts } = useStores();
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem = password ? passwordProblem(password) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (passwordProblem(password)) return;
    setBusy(true);
    setError(null);
    try {
      await auth.updatePassword(password);
      toasts.push('success', 'Password updated.');
      nav('/app', { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (!auth.ready) return <Spinner />;
  return (
    <AuthLayout title="Choose a new password">
      {!auth.isSignedIn ? (
        <Alert>This reset link has expired or was already used. Request a new one from the sign-in page.</Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="New password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} error={problem} />
          {error && <Alert>{error}</Alert>}
          <Button type="submit" className="w-full" size="lg" loading={busy} disabled={!password || Boolean(problem)}>
            Save password
          </Button>
        </form>
      )}
    </AuthLayout>
  );
});
