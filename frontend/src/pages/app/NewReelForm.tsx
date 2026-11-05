import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Gauge, Sparkles } from 'lucide-react';
import { ALL_PLATFORMS, DEFAULT_TEMPLATE, TEMPLATES, type Platform, type QualityTier, type TemplateId } from '@motionmind/shared';
import { TemplatePicker } from '../../components/TemplatePicker';
import { PlatformPicker } from '../../components/PlatformPicker';
import { useStores } from '../../stores/RootStore';
import { Button } from '../../components/ui';
import { errorText } from '../../lib/format';

const IDEAS = [
  'How does a UPI Soundbox know the money arrived?',
  'How does a vaccine train your body?',
  'How does Where is my Train work without GPS?',
  'Why does 5G need so many towers?',
  'How does Google Maps predict traffic?',
  'What happens when you tap your card to pay?',
];

const pill = 'h-8 rounded-lg border border-line/[0.12] bg-ink-900 pl-8 pr-2 text-xs font-medium text-ink-300 outline-none transition hover:bg-ink-800 focus:border-mint-500/60';

/** The "what should the reel explain?" box: a topic, how long, how polished, and one button. */
export function NewReelForm({ autoFocus, initialTopic = '' }: { autoFocus?: boolean; initialTopic?: string }) {
  const { projects, toasts } = useStores();
  const nav = useNavigate();
  const [topic, setTopic] = useState(initialTopic);
  const [duration, setDuration] = useState(60);
  const [tier, setTier] = useState<QualityTier>('standard');
  const [template, setTemplate] = useState<TemplateId>(DEFAULT_TEMPLATE);
  const [platforms, setPlatforms] = useState<Platform[]>([...ALL_PLATFORMS]);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const t = topic.trim();
    if (!t) return;
    setBusy(true);
    try {
      const p = await projects.create({ title: t.length > 80 ? `${t.slice(0, 77)}…` : t, topic: t, durationSec: duration, qualityTier: tier, platforms, ...(template !== DEFAULT_TEMPLATE ? { template } : {}) });
      toasts.push('success', 'Project created.');
      nav(`/app/projects/${p.id}`);
    } catch (err) {
      toasts.push('error', errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">1 · Choose a template</div>
        <TemplatePicker compact value={template} onChange={setTemplate} />
        <p className="mt-2 text-xs text-ink-400">{TEMPLATES[template].description}</p>
      </div>
      <div className="pt-1 text-xs font-semibold uppercase tracking-wider text-ink-400">2 · What should it explain?</div>
      <div className="rounded-2xl border border-line/[0.14] bg-ink-900 shadow-soft transition focus-within:border-mint-500/60 focus-within:shadow-[0_0_0_4px_rgba(124,58,237,0.10)]">
        <label htmlFor="new-topic" className="sr-only">
          What should the reel explain?
        </label>
        <textarea
          id="new-topic"
          autoFocus={autoFocus}
          rows={3}
          maxLength={500}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={`What should the reel explain? Try “${TEMPLATES[template].example}”`}
          className="block w-full resize-none rounded-t-2xl bg-transparent px-5 pt-4 text-base text-ink-100 outline-none placeholder:text-ink-400/70"
        />
        <div className="flex flex-wrap items-center gap-2 px-3 pb-3 pt-1">
          <div className="relative">
            <Clock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <select aria-label="Duration" className={pill} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {[15, 30, 45, 60, 90].map((d) => (
                <option key={d} value={d}>
                  {d} seconds
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Gauge className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <select aria-label="Quality" className={pill} value={tier} onChange={(e) => setTier(e.target.value as QualityTier)}>
              <option value="draft">Draft (cheapest)</option>
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
              <option value="cinematic">Cinematic</option>
            </select>
          </div>
          <PlatformPicker compact value={platforms} onChange={setPlatforms} />
          <span className="ml-auto hidden text-xs text-ink-400 sm:inline">{topic.length}/500</span>
          <Button type="submit" loading={busy} disabled={!topic.trim()} icon={<Sparkles className="h-4 w-4" />}>
            Create reel
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2" aria-label="Topic ideas">
        <span className="text-xs text-ink-400">Try:</span>
        {IDEAS.map((idea) => (
          <button
            key={idea}
            type="button"
            onClick={() => setTopic(idea)}
            className="rounded-full border border-line/10 bg-ink-900 px-3 py-1 text-xs text-ink-300 transition hover:-translate-y-0.5 hover:border-mint-400/50 hover:bg-mint-400/10 hover:text-ink-100"
          >
            {idea}
          </button>
        ))}
      </div>
    </form>
  );
}
