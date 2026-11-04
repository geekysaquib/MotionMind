import { useCallback, useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink, Flame, RefreshCw, Sparkles } from 'lucide-react';
import { useStores } from '../../stores/RootStore';
import { Alert, Button, Card, Spinner } from '../../components/ui';
import { Reveal } from '../../components/motion';
import { errorText } from '../../lib/format';
import { log } from '../../lib/logger';
import { cn } from '../../lib/cn';
import type { TrendIdea, Trending } from '../../services/claudeHttp';
import { ClaudeAiPanel } from './PasteScriptPanel';

type Lang = 'en' | 'hi';
const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English Wikipedia' },
  { id: 'hi', label: 'हिन्दी Wikipedia' },
];

const ideasKey = (lang: Lang) => `mm-trend-ideas-${lang}`;

function loadIdeas(lang: Lang): { date: string; ideas: TrendIdea[] } | null {
  try {
    const raw = JSON.parse(window.localStorage.getItem(ideasKey(lang)) ?? 'null') as { date?: string; ideas?: TrendIdea[] } | null;
    return raw?.date && Array.isArray(raw.ideas) ? { date: raw.date, ideas: raw.ideas } : null;
  } catch {
    return null;
  }
}

/**
 * Discover > Trending now: what people read on Wikipedia yesterday (a real signal, with the source and the numbers),
 * and reel ideas Claude makes from it: one click with the server's key, or copy and paste with a Claude subscription.
 */
export const TrendingPanel = observer(function TrendingPanel() {
  const { services, auth, aiMode } = useStores();
  const api = services.claude(() => auth.session?.accessToken ?? null);
  const [lang, setLang] = useState<Lang>('en');
  const [trending, setTrending] = useState<Trending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(() => loadIdeas('en'));
  const [busy, setBusy] = useState(false);
  const [ideaError, setIdeaError] = useState<string | null>(null);

  const load = useCallback(() => {
    setTrending(null);
    setError(null);
    api
      .trending(lang)
      .then(setTrending)
      .catch((e) => setError(errorText(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  useEffect(load, [load]);
  useEffect(() => setSaved(loadIdeas(lang)), [lang]);

  function keep(date: string, ideas: TrendIdea[]) {
    const next = { date, ideas };
    setSaved(next);
    try {
      window.localStorage.setItem(ideasKey(lang), JSON.stringify(next));
    } catch {
      /* the ideas stay for this visit */
    }
    log.info('discover', 'Trending ideas ready', { lang, count: ideas.length });
  }

  async function askClaude() {
    setBusy(true);
    setIdeaError(null);
    try {
      const r = await api.trendingIdeas(lang);
      keep(r.date, r.ideas);
    } catch (e) {
      setIdeaError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Flame className="h-5 w-5 text-coral-500" /> Trending now
          </h2>
          <p className="mt-1 text-sm text-ink-400">
            The pages most read on Wikipedia{trending ? ` on ${trending.date}` : ' yesterday'}. This is a real signal of what people are curious about, with the numbers and the source.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-ink-700/70 p-1 text-sm" role="group" aria-label="Wikipedia language">
            {LANGS.map((l) => (
              <button key={l.id} aria-pressed={lang === l.id} onClick={() => setLang(l.id)} className={cn('rounded-md px-3 py-1.5 font-medium transition', lang === l.id ? 'bg-ink-900 text-ink-100 shadow-sm' : 'text-ink-400 hover:text-ink-100')}>
                {l.label}
              </button>
            ))}
          </div>
          <Button variant="ghost" aria-label="Refresh" onClick={load} icon={<RefreshCw className="h-4 w-4" />} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card className="p-0">
          {error ? (
            <div className="p-5">
              <Alert>{error}</Alert>
            </div>
          ) : !trending ? (
            <div className="p-5">
              <Spinner label="Asking Wikipedia" />
            </div>
          ) : (
            <ol className="divide-y divide-line/[0.07]">
              {trending.items.map((it, i) => (
                <li key={it.url} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-6 shrink-0 text-xs font-semibold text-ink-400">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{it.title}</div>
                    <div className="text-xs text-ink-400">{it.views.toLocaleString('en-IN')} views</div>
                  </div>
                  <a href={it.url} target="_blank" rel="noreferrer" aria-label={`Open ${it.title} on Wikipedia`} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-ink-100">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <Link to={`/app?new=1&topic=${encodeURIComponent(it.title)}`} className="shrink-0 text-xs font-semibold text-accent hover:underline">
                    Use as topic
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <div className="space-y-5">
          {aiMode.paste ? (
            <ClaudeAiPanel
              title="Turn these into reel ideas in claude.ai"
              placeholder='{ "ideas": [ { "topic": "...", "hook": "...", "seconds": 45, "why": "..." } ] }'
              disabled={!trending}
              logScope="Trending"
              getPrompt={() => api.trendingPrompt(lang)}
              onImport={async (text) => {
                const ideas = await api.importTrendingIdeas(text);
                keep(trending?.date ?? new Date().toISOString().slice(0, 10), ideas);
              }}
            />
          ) : (
            <Card>
              <h3 className="font-semibold">Turn these into reel ideas</h3>
              <p className="mt-1 text-sm text-ink-400">Claude picks the pages worth explaining and writes a topic and an opening hook for each.</p>
              <Button className="mt-3" loading={busy} disabled={!trending} icon={<Sparkles className="h-4 w-4" />} onClick={() => void askClaude()}>
                {saved ? 'Make new ideas' : 'Make reel ideas'}
              </Button>
              {ideaError && <div className="mt-3"><Alert>{ideaError}</Alert></div>}
            </Card>
          )}

          {saved && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-ink-400">Ideas from {saved.date}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {saved.ideas.map((idea, i) => (
                  <Reveal key={idea.topic} delay={i * 50}>
                    <Link to={`/app?new=1&topic=${encodeURIComponent(idea.topic)}`} className="card card-hover group flex h-full flex-col p-4">
                      <h4 className="font-display font-bold leading-snug">{idea.topic}</h4>
                      <p className="mt-2 flex-1 text-sm text-ink-400">{idea.hook}</p>
                      {idea.why && <p className="mt-2 text-xs text-ink-400">Why now: {idea.why}</p>}
                      <div className="mt-3 flex items-center justify-between text-xs text-ink-400">
                        <span>About {idea.seconds} seconds</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-accent">
                          Make this reel <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                        </span>
                      </div>
                    </Link>
                  </Reveal>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
