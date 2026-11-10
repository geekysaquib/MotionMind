import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, useOutletContext } from 'react-router-dom';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { FACT_STATUS_LABELS, type FactStatus, type Project } from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { Alert, Badge, Button, Card } from '../../components/ui';
import { errorText, timeAgo } from '../../lib/format';
import { ClaudeAiPanel } from './PasteScriptPanel';

const STATUS_TONE: Record<FactStatus, 'mint' | 'violet' | 'amber' | 'coral'> = {
  verified: 'mint',
  single_source: 'violet',
  estimate: 'amber',
  conflicting: 'coral',
};

/** Research stage: Claude finds how the topic really works, with sources; the user approves it before the script. */
export const ResearchStagePage = observer(function ResearchStagePage() {
  const project = useOutletContext<Project>();
  const { projects, services, auth } = useStores();
  const [busy, setBusy] = useState<'approve' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const research = project.research;

  async function run(kind: 'approve') {
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'approve') await projects.approveResearch(project.id);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="space-y-6">
        <ClaudeAiPanel
            title="Research it in claude.ai"
            chatHint="Turn on web search in claude.ai first, so Claude can read real sources."
            placeholder='{ "summary": "...", "facts": [...], "sources": [...] }'
            disabled={!project.topic}
            logScope="Research"
            getPrompt={() => services.claude(() => auth.session?.accessToken ?? null).researchPrompt(project.id)}
            onImport={(text) => projects.importResearch(project.id, text)}
          />

        {error && <Alert>{error}</Alert>}

        {research && (
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="font-display text-xl font-bold">What Claude found</h3>
              {research.approvedAt ? (
                <Badge tone="mint">Approved</Badge>
              ) : (
                <Button icon={<CheckCircle2 className="h-4 w-4" />} loading={busy === 'approve'} onClick={() => void run('approve')}>
                  Approve research
                </Button>
              )}
            </div>
            <p className="mt-3 text-sm leading-relaxed">{research.summary}</p>
            {!research.approvedAt && <p className="mt-2 text-xs text-ink-400">Check the facts below. Once you approve, the script is written from them.</p>}
            {research.approvedAt && (
              <p className="mt-2 text-xs text-ink-400">
                The script will use these facts.{' '}
                <Link to={`/app/projects/${project.id}/script`} className="text-accent hover:underline">
                  Go to Script
                </Link>
              </p>
            )}

            <ul className="mt-5 space-y-3">
              {research.facts.map((f, i) => (
                <li key={i} className="rounded-xl border border-line/10 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="text-sm">{f.claim}</span>
                    <Badge tone={STATUS_TONE[f.status]}>{FACT_STATUS_LABELS[f.status]}</Badge>
                  </div>
                  {f.sources.length > 0 && (
                    <div className="mt-1 text-xs text-ink-400">
                      Sources: {f.sources.map((s) => `[${s + 1}]`).join(' ')}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <h4 className="mt-6 text-sm font-semibold">Sources</h4>
            <ol className="mt-2 space-y-1.5 text-sm">
              {research.sources.map((s, i) => (
                <li key={s.url + i} className="flex gap-2">
                  <span className="text-ink-400">[{i + 1}]</span>
                  <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                    {s.title} <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-ink-400">
              {research.model === 'claude.ai (pasted)' ? 'Pasted from claude.ai' : `Researched by ${research.model}`}
              {research.writtenAt ? ` · ${timeAgo(research.writtenAt)}` : ''}
            </p>
          </Card>
        )}
      </div>

    </div>
  );
});
