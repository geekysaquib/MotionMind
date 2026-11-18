import { useState, type FormEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { Navigate, useNavigate } from 'react-router-dom';
import { AtSign, Check, Loader2, X } from 'lucide-react';
import { useStores } from '../../stores/RootStore';
import { Alert, Button, Field, Select } from '../../components/ui';
import { Logo } from '../../components/Logo';
import { DemoBanner } from '../../components/DemoBanner';
import { errorText } from '../../lib/format';
import { cn } from '../../lib/cn';

const NICHES = ['Technology', 'Science', 'Business & finance', 'History', 'Geography', 'Health education', 'General knowledge', 'Other'];

export const OnboardingPage = observer(function OnboardingPage() {
  const { profile, toasts } = useStores();
  const nav = useNavigate();
  const p = profile.profile;
  const [step, setStep] = useState<1 | 2>(1);
  const [displayName, setDisplayName] = useState(p?.displayName ?? '');
  const [channelName, setChannelName] = useState(p?.channelName ?? '');
  const [niche, setNiche] = useState(p?.niche ?? 'Technology');
  const [language, setLanguage] = useState<'en' | 'hi' | 'hinglish'>(p?.language ?? 'hinglish');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (p && !profile.needsOnboarding) return <Navigate to="/app" replace />;

  const status = profile.handleStatus;
  const statusIcon =
    status === 'checking' ? <Loader2 className="h-4 w-4 animate-spin text-ink-400" /> : status === 'available' ? <Check className="h-4 w-4 text-accent" /> : status === 'taken' || status === 'invalid' ? <X className="h-4 w-4 text-danger" /> : null;

  async function finish(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await profile.completeOnboarding({ displayName: displayName.trim(), channelName: channelName.trim() || null, niche, language });
      toasts.push('success', `Welcome to Motion Mind, @${profile.profile?.handle}!`);
      nav('/app', { replace: true });
    } catch (err) {
      setError(errorText(err));
      if ((err as { code?: string }).code === 'handle_taken') setStep(1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-ink-950">
      <div className="aurora pointer-events-none absolute inset-0" aria-hidden />
      <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative z-10">
        <DemoBanner />
      </div>
      <div className="relative z-10 flex flex-1 items-center justify-center overflow-y-auto px-6 py-12">
        <div className="w-full max-w-lg animate-fade-up">
          <Logo />
          <div className="mt-8 flex gap-2" aria-label={`Step ${step} of 2`}>
            {[1, 2].map((n) => (
              <div key={n} className={cn('h-1 flex-1 rounded-full', n <= step ? 'bg-brand' : 'bg-line/10')} />
            ))}
          </div>
          <div className="card mt-6 p-8">
            {step === 1 ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (status === 'available' && displayName.trim()) setStep(2);
                }}
                className="space-y-5"
              >
                <div>
                  <h1 className="font-display text-2xl font-bold">Claim your handle</h1>
                  <p className="mt-1 text-sm text-ink-400">This is your creator name on Motion Mind and on your reels' end card. Match your Instagram handle if you can.</p>
                </div>
                <Field
                  label="Handle"
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={profile.handleInput}
                  onChange={(e) => profile.setHandleInput(e.target.value)}
                  placeholder="motionmind.in"
                  trailing={statusIcon}
                  error={status === 'invalid' || status === 'taken' || status === 'error' ? profile.handleMessage : null}
                  hint={
                    status === 'available' ? (
                      <span className="text-accent">{profile.handleMessage}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <AtSign className="h-3 w-3" /> 3–30 characters: letters, numbers, dots, underscores.
                      </span>
                    )
                  }
                />
                <Field label="Display name" required maxLength={60} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Saquib Khan" />
                <Button type="submit" className="w-full" size="lg" disabled={status !== 'available' || !displayName.trim()}>
                  Continue
                </Button>
              </form>
            ) : (
              <form onSubmit={finish} className="space-y-5">
                <div>
                  <h1 className="font-display text-2xl font-bold">Set up your channel</h1>
                  <p className="mt-1 text-sm text-ink-400">We use this to tailor topic ideas and the narration language. You can change it later in Settings.</p>
                </div>
                <Field label="Channel name" maxLength={60} value={channelName} onChange={(e) => setChannelName(e.target.value)} placeholder="Motion Mind" hint="Shown on your reels. Optional." />
                <Select label="Main topic area" value={niche} onChange={(e) => setNiche(e.target.value)}>
                  {NICHES.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </Select>
                <div>
                  <span className="label">Narration language</span>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ['hinglish', 'Hinglish'],
                        ['hi', 'Hindi'],
                        ['en', 'English'],
                      ] as const
                    ).map(([v, l]) => (
                      <button
                        type="button"
                        key={v}
                        aria-pressed={language === v}
                        onClick={() => setLanguage(v)}
                        className={cn('rounded-xl border py-2.5 text-sm font-medium transition', language === v ? 'border-mint-400/60 bg-mint-400/10 text-accent' : 'border-line/10 text-ink-300 hover:border-line/20')}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                {error && <Alert>{error}</Alert>}
                <div className="flex gap-3">
                  <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button type="submit" className="flex-1" size="lg" loading={busy}>
                    Open my studio
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
