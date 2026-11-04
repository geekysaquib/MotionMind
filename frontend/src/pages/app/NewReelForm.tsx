import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import type { QualityTier } from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { Button, Select } from '../../components/ui';
import { errorText } from '../../lib/format';

const IDEAS = [
  'How does a UPI Soundbox know the money arrived?',
  'How does a vaccine train your body?',
  'How does Where is my Train work without GPS?',
  'Why does 5G need so many towers?',
  'How does Google Maps predict traffic?',
  'What happens when you tap your card to pay?',
];

export function NewReelForm({ autoFocus, initialTopic = '' }: { autoFocus?: boolean; initialTopic?: string }) {
  const { projects, toasts } = useStores();
  const nav = useNavigate();
  const [topic, setTopic] = useState(initialTopic);
  const [duration, setDuration] = useState(60);
  const [tier, setTier] = useState<QualityTier>('standard');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const t = topic.trim();
    if (!t) return;
    setBusy(true);
    try {
      const p = await projects.create({ title: t.length > 80 ? `${t.slice(0, 77)}…` : t, topic: t, durationSec: duration, qualityTier: tier });
      toasts.push('success', 'Project created.');
      nav(`/app/projects/${p.id}`);
    } catch (err) {
      toasts.push('error', errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label htmlFor="new-topic" className="label">
        What should the reel explain?
      </label>
      <textarea
        id="new-topic"
        autoFocus={autoFocus}
        rows={2}
        maxLength={500}
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="How does the Where is my Train app work without GPS and internet?"
        className="field resize-none text-base"
      />
      <div className="flex flex-wrap items-center gap-2" aria-label="Topic ideas">
        <span className="text-xs text-ink-400">Try:</span>
        {IDEAS.map((idea) => (
          <button
            key={idea}
            type="button"
            onClick={() => setTopic(idea)}
            className="rounded-full border border-line/10 bg-line/[0.03] px-3 py-1 text-xs text-ink-300 transition hover:-translate-y-0.5 hover:border-mint-400/50 hover:bg-mint-400/10 hover:text-ink-100"
          >
            {idea}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Select label="Duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
          {[15, 30, 45, 60, 90].map((d) => (
            <option key={d} value={d}>
              {d} seconds
            </option>
          ))}
        </Select>
        <Select label="Quality" value={tier} onChange={(e) => setTier(e.target.value as QualityTier)}>
          <option value="draft">Draft (cheapest)</option>
          <option value="standard">Standard</option>
          <option value="premium">Premium</option>
          <option value="cinematic">Cinematic</option>
        </Select>
        <Button type="submit" size="lg" loading={busy} disabled={!topic.trim()} icon={<Sparkles className="h-4 w-4" />}>
          Create project
        </Button>
      </div>
    </form>
  );
}
