import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStores } from '../../stores/RootStore';
import { Button, Card } from '../../components/ui';
import { getTheme, setTheme, type Theme } from '../../lib/theme';
import { cn } from '../../lib/cn';

export const AccountSettings = observer(function AccountSettings() {
  const { auth } = useStores();
  const [theme, setThemeState] = useState<Theme>(getTheme());

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
        <h2 className="font-semibold">Sign out</h2>
        <p className="mt-1 text-sm text-ink-400">Signs you out on this device.</p>
        <Button className="mt-4" variant="secondary" onClick={() => void auth.signOut()}>
          Sign out
        </Button>
      </Card>
    </div>
  );
});
