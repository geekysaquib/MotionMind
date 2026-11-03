import { observer } from 'mobx-react-lite';
import { CheckCircle2, Info, XCircle, X } from 'lucide-react';
import { useStores } from '../stores/RootStore';
import { cn } from '../lib/cn';

export const Toasts = observer(function Toasts() {
  const { toasts } = useStores();
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-80 flex-col gap-2" aria-live="polite">
      {toasts.items.map((t) => {
        const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? XCircle : Info;
        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex animate-fade-up items-start gap-3 rounded-xl border bg-ink-850 px-4 py-3 text-sm shadow-xl',
              t.tone === 'success' ? 'border-mint-400/30' : t.tone === 'error' ? 'border-coral-500/40' : 'border-line/10',
            )}
          >
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', t.tone === 'success' ? 'text-accent' : t.tone === 'error' ? 'text-danger' : 'text-ink-300')} />
            <span className="flex-1 text-ink-100">{t.text}</span>
            <button onClick={() => toasts.dismiss(t.id)} className="text-ink-400 hover:text-ink-100" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
});
