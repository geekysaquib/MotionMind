import { useState, type FormEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../stores/RootStore';
import { Button, Card, Field } from '../../components/ui';
import { errorText } from '../../lib/format';
import { passwordProblem } from '../auth/SignupPage';
import { getTheme, setTheme, type Theme } from '../../lib/theme';
import { cn } from '../../lib/cn';

export const AccountSettings = observer(function AccountSettings() {
  const { auth, toasts } = useStores();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const problem = pw ? passwordProblem(pw) : null;
  const [theme, setThemeState] = useState<Theme>(getTheme());

  async function change(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await auth.updatePassword(pw);
      setPw('');
      toasts.push('success', 'Password changed.');
    } catch (err) {
      toasts.push('error', errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-semibold">Email</h2>
        <p className="mt-1 text-sm text-ink-400">{auth.session?.email}</p>
      </Card>
      <Card>
        <h2 className="font-semibold">Appearance</h2>
        <div className="mt-4 inline-flex rounded-xl border border-line/15 p-1 text-sm">
          {(['light', 'dark'] as const).map((t) => (
            <button
              key={t}
              aria-pressed={theme === t}
              onClick={() => {
                setTheme(t);
                setThemeState(t);
              }}
              className={cn('rounded-lg px-4 py-1.5 font-medium capitalize', theme === t ? 'bg-line/[0.08] text-ink-100' : 'text-ink-400 hover:text-ink-100')}
            >
              {t}
            </button>
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="font-semibold">Change password</h2>
        <form onSubmit={change} className="mt-4 flex flex-wrap items-start gap-3">
          <Field className="min-w-[240px] flex-1" label="New password" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} error={problem} />
          <Button type="submit" className="mt-6" loading={busy} disabled={!pw || Boolean(problem)}>
            Update
          </Button>
        </form>
      </Card>
      <Card>
        <h2 className="font-semibold">Sign out</h2>
        <p className="mt-1 text-sm text-ink-400">Signs you out on this device.</p>
        <Button className="mt-4" variant="secondary" onClick={() => void auth.signOut()}>
          Sign out
        </Button>
      </Card>
    </div>
  );
});
