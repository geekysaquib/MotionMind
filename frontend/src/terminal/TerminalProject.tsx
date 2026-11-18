import { useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronLeft, Copy, Download, Play, Share2, Upload } from 'lucide-react';
import { APPROACH_IDS, APPROACHES, exportFileName, lengthPlan, lengthWarning, narrationWords, normalizePlatforms, PLATFORMS, STYLES, suggestStyles, WORDS_PER_SECOND, type ApproachId, type Platform, type Project, type StyleId } from '@motionmind/shared';
import { useStores } from '../stores/RootStore';
import { stageDone } from '../lib/progress';
import { pickedStyle, rememberStyle } from '../lib/pickedStyle';
import { pickedApproach, rememberApproach } from '../lib/pickedApproach';
import { attachVoice } from '../lib/editorActions';
import { closingLine } from '../lib/closing';
import { copyText } from '../lib/clipboard';
import { errorText } from '../lib/format';
import { log } from '../lib/logger';
import { cn } from '../lib/cn';
import { config } from '../config';
import { STYLE_FILMS, styleFilmPoster } from '../components/styleFilms';
import { StyleFilm } from '../components/StyleFilm';
import { StyleSample } from '../components/StyleSample';
import { AnimationPreview } from '../components/AnimationPreview';
import type { RenderJob } from '../services/claudeHttp';
import { CopyPasteFlow, TButton, TNote, TStepHead } from './parts';

// The steps of a reel on the phone, in the app's order. The Storyboard stays on the PC (deep edits need room).
const STEPS = [
  { key: 'topic', label: 'topic', done: 0 },
  { key: 'research', label: 'research', done: 1 },
  { key: 'style', label: 'style', done: 2 },
  { key: 'script', label: 'script', done: 3 },
  { key: 'voice', label: 'voice', done: 4 },
  { key: 'animate', label: 'animate', done: 6 },
  { key: 'export', label: 'export', done: 7 },
] as const;
type StepKey = (typeof STEPS)[number]['key'];

/** One reel, one step per screen: a top bar, a log of what is done, the step, and its actions at the bottom. */
export const TerminalProject = observer(function TerminalProject() {
  const { id = '', step } = useParams();
  const { projects } = useStores();
  const nav = useNavigate();
  const project = projects.byId(id);

  useEffect(() => {
    if (!project && projects.loaded) void projects.load();
  }, [project, projects.loaded]);

  if (!project) return <p className="font-mono text-sm text-ink-400">{projects.loaded ? 'reel not found' : 'loading…'}</p>;

  const done = stageDone(project);
  const current: StepKey = (STEPS.find((s) => s.key === step)?.key ?? STEPS.find((s) => !done[s.done])?.key ?? 'export') as StepKey;
  const index = STEPS.findIndex((s) => s.key === current);
  const go = (k: StepKey) => nav(`/t/p/${project.id}/${k}`);
  const next = () => {
    const n = STEPS[index + 1];
    if (n) go(n.key);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <Link to="/t" aria-label="Back to your reels" className="-ml-2 p-2 text-ink-300">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{project.title}</span>
          <span className="font-mono text-xs text-ink-400">
            {index + 1} / {STEPS.length}
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-line/10">
          <div className="h-full rounded-full bg-mint-500 transition-[width] duration-500" style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} />
        </div>
        {/* The log: tap any step to go to it. */}
        <nav aria-label="Steps" className="flex gap-1.5 overflow-x-auto pb-1 font-mono text-xs [scrollbar-width:none]">
          {STEPS.map((s) => (
            <button key={s.key} type="button" aria-current={s.key === current ? 'step' : undefined} onClick={() => go(s.key)} className={cn('shrink-0 rounded-lg border px-2.5 py-1.5', s.key === current ? 'border-mint-500 bg-mint-500/15 text-ink-100' : done[s.done] ? 'border-line/10 text-ink-300' : 'border-line/10 text-ink-400/70')}>
              {done[s.done] ? '✓ ' : s.key === current ? '> ' : ''}
              {s.label}
            </button>
          ))}
        </nav>
      </header>

      <div key={current} className="page-enter space-y-6">
        {current === 'topic' && <TopicStep project={project} onNext={next} />}
        {current === 'research' && <ResearchStep project={project} onNext={next} />}
        {current === 'style' && <StyleStep project={project} onNext={next} />}
        {current === 'script' && <ScriptStep project={project} onNext={next} />}
        {current === 'voice' && <VoiceStep project={project} onNext={next} />}
        {current === 'animate' && <AnimateStep project={project} onNext={next} />}
        {current === 'export' && <ExportStep project={project} />}
      </div>
    </div>
  );
});

type StepProps = { project: Project; onNext: () => void };

function useApi() {
  const { services, auth } = useStores();
  return useMemo(() => services.claude(() => auth.session?.accessToken ?? null), [services, auth]);
}

function TopicStep({ project, onNext }: StepProps) {
  return (
    <>
      <TStepHead title="The topic" help="What the reel explains, how long it is and where it goes." />
      <div className="rounded-2xl border border-line/10 p-4 text-[15px] leading-relaxed">{project.topic}</div>
      <div className="font-mono text-sm text-ink-300">
        {project.durationSec}s · {normalizePlatforms(project.platforms).map((p) => PLATFORMS[p].short).join(' + ')}
      </div>
      <TNote>To change the topic or length, use Motion Mind on your PC.</TNote>
      <TButton main onClick={onNext}>
        Next: research
      </TButton>
    </>
  );
}

function ApproachChips({ projectId, value, onChange }: { projectId: string; value: ApproachId; onChange: (a: ApproachId) => void }) {
  return (
    <div>
      <div className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-ink-400">explain it as</div>
      <div className="flex flex-wrap gap-2">
        {APPROACH_IDS.map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={a === value}
            onClick={() => {
              rememberApproach(projectId, a);
              onChange(a);
            }}
            className={cn('min-h-[40px] rounded-xl border px-3 text-sm', a === value ? 'border-mint-500 bg-mint-500/15 font-semibold text-ink-100' : 'border-line/15 text-ink-300')}
          >
            {APPROACHES[a].label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-ink-400">{APPROACHES[value].hint}</p>
    </div>
  );
}

const ResearchStep = observer(function ResearchStep({ project, onNext }: StepProps) {
  const { projects } = useStores();
  const api = useApi();
  const [approach, setApproach] = useState(() => pickedApproach(project.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const r = project.research;

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      await projects.approveResearch(project.id);
      onNext();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TStepHead title="Research it in Claude" help="Claude reads real sources and lists the facts. You approve them before the script is written." />
      <ApproachChips projectId={project.id} value={approach} onChange={setApproach} />
      {r && (
        <section className="space-y-2">
          <div className="font-mono text-xs uppercase tracking-[0.14em] text-ink-400">
            {r.facts.length} facts · {r.approvedAt ? 'approved' : 'not approved yet'}
          </div>
          <p className="text-[15px] leading-relaxed">{r.summary}</p>
          <ul className="space-y-2">
            {r.facts.slice(0, 30).map((f, i) => (
              <li key={i} className="rounded-xl border border-line/10 p-3 text-sm leading-relaxed">
                {f.claim} <span className="font-mono text-xs text-ink-400">· {f.status.replace('_', ' ')}</span>
              </li>
            ))}
          </ul>
          {!r.approvedAt ? (
            <TButton main busy={busy} icon={<Check className="h-5 w-5" />} onClick={() => void approve()}>
              Approve research
            </TButton>
          ) : (
            <TButton main onClick={onNext}>
              Next: style
            </TButton>
          )}
          {error && <TNote tone="error">{error}</TNote>}
        </section>
      )}
      <details className="rounded-2xl border border-line/10 p-4" open={!r}>
        <summary className="cursor-pointer text-[15px] font-semibold">{r ? 'Research it again' : 'Copy, ask Claude, paste'}</summary>
        <div className="mt-4">
          <CopyPasteFlow key={approach} logScope="Research" chatHint="Turn on web search in Claude first." getPrompt={(note) => api.researchPrompt(project.id, note, approach)} onImport={(text) => projects.importResearch(project.id, text)} />
        </div>
      </details>
    </>
  );
});

const StyleStep = observer(function StyleStep({ project, onNext }: StepProps) {
  const { projects } = useStores();
  const api = useApi();
  const [picked, setPicked] = useState<StyleId | null>(() => pickedStyle(project));
  const [open, setOpen] = useState<StyleId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const order = useMemo(() => suggestStyles(project.script ?? { title: project.topic ?? project.title, beats: [] }), [project.script, project.topic, project.title]);

  async function pick(id: StyleId) {
    setError(null);
    try {
      rememberStyle(project.id, id);
      setPicked(id);
      if (project.script) projects.upsert(await api.saveStyle(project.id, id));
      log.info('terminal', 'Style picked', { projectId: project.id, style: id });
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <>
      <TStepHead title="Pick a style" help="The look Claude animates your reel in. The best fit for your topic is first. Tap a style to see it move." />
      {error && <TNote tone="error">{error}</TNote>}
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {order.map((id, i) => {
          const st = STYLES[id];
          const on = picked === id;
          return (
            <li key={id} className={cn('overflow-hidden rounded-2xl border', on ? 'border-mint-500 ring-2 ring-mint-500/40' : 'border-line/10')}>
              <button type="button" aria-label={`Preview ${st.name}`} className="relative block aspect-[4/5] w-full overflow-hidden" style={{ background: `linear-gradient(160deg, ${st.swatch[0]}, ${st.swatch[1]}55)` }} onClick={() => setOpen(open === id ? null : id)}>
                {open === id ? (
                  STYLE_FILMS[id] ? <StyleFilm id={id} name={st.name} className="absolute inset-0 h-full w-full object-cover" /> : <StyleSample id={id} name={st.name} className="absolute inset-0 m-auto h-full" />
                ) : STYLE_FILMS[id] ? (
                  <img src={styleFilmPoster(id)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <Play className="absolute inset-0 m-auto h-8 w-8 text-white/80" />
                )}
                {i === 0 && <span className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white">best fit</span>}
              </button>
              <button type="button" aria-pressed={on} onClick={() => void pick(id)} className="flex w-full items-center gap-2 p-2.5 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{st.name}</span>
                  <span className="block truncate text-xs text-ink-400">{st.tagline}</span>
                </span>
                {on && <Check className="h-4 w-4 shrink-0 text-accent" />}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="sticky bottom-0 -mx-4 bg-ink-950 px-4 pb-3 pt-2">
        <TButton main disabled={!picked} onClick={onNext}>
          {picked ? `Next: script in ${STYLES[picked].name}` : 'Pick a style first'}
        </TButton>
      </div>
    </>
  );
});

const ScriptStep = observer(function ScriptStep({ project, onNext }: StepProps) {
  const { projects } = useStores();
  const api = useApi();
  const style = pickedStyle(project);
  const [approach, setApproach] = useState(() => pickedApproach(project.id));
  const s = project.script;
  const plan = lengthPlan(project.durationSec);
  const warning = s ? lengthWarning(s.beats, project.durationSec) : null;
  return (
    <>
      <TStepHead title="Write the script in Claude" help={`${plan.seconds} seconds: about ${plan.words.target} words in ${plan.beats.min} to ${plan.beats.max} scenes, written for text-to-speech.`} />
      {!style && <TNote tone="warn">Pick a style first, so Claude writes the scenes for it.</TNote>}
      <ApproachChips projectId={project.id} value={approach} onChange={setApproach} />
      {s && (
        <section className="space-y-2">
          <div className="font-mono text-xs uppercase tracking-[0.14em] text-ink-400">
            {s.beats.length} scenes · {narrationWords(s.beats)} words · about {Math.round(narrationWords(s.beats) / WORDS_PER_SECOND)}s
          </div>
          {warning && <TNote tone="warn">{warning}</TNote>}
          <ol className="space-y-2">
            {s.beats.map((b, i) => (
              <li key={b.id} className="rounded-xl border border-line/10 p-3">
                <div className="font-mono text-xs text-ink-400">scene {i + 1}</div>
                <div className="mt-1 text-[15px] leading-relaxed">{b.narration}</div>
              </li>
            ))}
          </ol>
          <TButton main onClick={onNext}>
            Next: voice
          </TButton>
        </section>
      )}
      <details className="rounded-2xl border border-line/10 p-4" open={!s}>
        <summary className="cursor-pointer text-[15px] font-semibold">{s ? 'Write it again' : 'Copy, ask Claude, paste'}</summary>
        <div className="mt-4">
          <CopyPasteFlow key={approach} logScope="Script" getPrompt={(note) => api.scriptPrompt(project.id, style, note, approach)} onImport={(text) => projects.importScript(project.id, text, style)} />
        </div>
      </details>
    </>
  );
});

const VoiceStep = observer(function VoiceStep({ project, onNext }: StepProps) {
  const { projects, profile } = useStores();
  const api = useApi();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState<number | 'all' | null>(null);
  const s = project.script;
  if (!s) return <TNote tone="warn">Write the script first.</TNote>;
  const closing = closingLine(profile.profile?.language ?? 'hinglish', profile.profile?.handle ? `@${profile.profile.handle}` : (profile.profile?.channelName ?? ''), project.platforms);
  const all = [...s.beats.map((b) => b.narration), closing].join('\n');
  const upload = project.editor?.upload;

  async function copy(i: number | 'all', text: string) {
    if (await copyText(text)) setCopied(i);
  }

  async function choose(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setNote(null);
    try {
      const current = (await api.editorFor(project.id)).editor;
      const r = await attachVoice(api, project, file, current);
      projects.upsert(r.project);
      setNote(r.fit ? { tone: 'ok', text: r.fit === 'speech' ? 'Fitted: every scene starts where you say its first word.' : 'Fitted from the pauses in your recording.' } : { tone: 'warn', text: r.note ?? 'Saved, but the fit did not run. Open the Voice step on your PC to fit it.' });
      log.info('terminal', 'Voice uploaded', { projectId: project.id, fit: r.fit });
    } catch (e) {
      setNote({ tone: 'error', text: errorText(e) });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <>
      <TStepHead title="Record the voice" help="Paste the script into AI Awaaz (or read it yourself), download the audio, and upload it here. Motion Mind fits every scene to your voice." />
      <TButton main icon={<Copy className="h-5 w-5" />} onClick={() => void copy('all', all)}>
        {copied === 'all' ? 'Script copied' : 'Copy the whole script'}
      </TButton>
      <details className="rounded-2xl border border-line/10 p-4">
        <summary className="cursor-pointer text-[15px] font-semibold">Copy scene by scene</summary>
        <ol className="mt-3 space-y-2">
          {[...s.beats.map((b) => b.narration), closing].map((line, i) => (
            <li key={i} className="flex items-start gap-2 rounded-xl border border-line/10 p-3">
              <span className="flex-1 text-sm leading-relaxed">{line}</span>
              <button type="button" aria-label={`Copy line ${i + 1}`} className="p-1.5 text-ink-400" onClick={() => void copy(i, line)}>
                {copied === i ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
              </button>
            </li>
          ))}
        </ol>
      </details>
      <input ref={input} type="file" accept="audio/*,.mp3,.wav,.m4a" className="hidden" aria-label="Voice recording" onChange={(e) => void choose(e.target.files?.[0])} />
      <TButton busy={busy} icon={<Upload className="h-5 w-5" />} onClick={() => input.current?.click()}>
        {upload ? 'Upload a new recording' : 'Upload the recording'}
      </TButton>
      {upload && <div className="font-mono text-sm text-ink-300">✓ {upload.track.fileName} · {Math.round(upload.track.durationSec)}s · {upload.cuts.length + 1} scenes</div>}
      {note && <TNote tone={note.tone}>{note.text}</TNote>}
      {upload && (
        <TButton main onClick={onNext}>
          Next: animate
        </TButton>
      )}
    </>
  );
});

const AnimateStep = observer(function AnimateStep({ project, onNext }: StepProps) {
  const { projects } = useStores();
  const api = useApi();
  const has = Boolean(project.script?.animation);
  if (!project.script) return <TNote tone="warn">Write the script first.</TNote>;
  return (
    <>
      <TStepHead title="Let Claude animate it" help="Claude writes the whole reel as an animation, timed to your voice, in your style. It is a long answer: if Claude stops, say “continue” and paste each message as its own part." />
      {!project.editor?.upload && <TNote tone="warn">Upload the voice first, so the animation is timed to it.</TNote>}
      {has && (
        <section className="space-y-3">
          <AnimationPreview project={project} />
          <TButton main onClick={onNext}>
            Next: export
          </TButton>
        </section>
      )}
      <details className="rounded-2xl border border-line/10 p-4" open={!has}>
        <summary className="cursor-pointer text-[15px] font-semibold">{has ? 'Animate it again' : 'Copy, ask Claude, paste'}</summary>
        <div className="mt-4">
          <CopyPasteFlow
            multiPart
            logScope="Animate"
            placeholder="Paste Claude's answer (the part with <!doctype html>)"
            getPrompt={(note) => api.animationPrompt(project.id, note)}
            onImport={async (text) => projects.upsert(await api.importAnimation(project.id, text))}
          />
        </div>
      </details>
    </>
  );
});

const running = (j: RenderJob | null | undefined) => j?.status === 'queued' || j?.status === 'bundling' || j?.status === 'rendering' || j?.status === 'finishing';

const ExportStep = observer(function ExportStep({ project }: { project: Project }) {
  const api = useApi();
  const platforms = normalizePlatforms(project.platforms);
  const [jobs, setJobs] = useState<Partial<Record<Platform, RenderJob | null>>>({});
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function refresh() {
    try {
      const r = await api.exportStatus(project.id);
      setAvailable(r.available);
      setJobs(r.jobs ?? { [platforms[0]!]: r.job });
    } catch (e) {
      setError(errorText(e));
    }
  }

  useEffect(() => {
    void refresh();
  }, [project.id]);

  // Poll only while a render is going and this screen is open.
  const busy = platforms.some((p) => running(jobs[p]));
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => void refresh(), 2000);
    return () => clearInterval(t);
  }, [busy]);

  async function start(p: Platform) {
    setError(null);
    try {
      const r = await api.startExport(project.id, p);
      setJobs((j) => ({ ...j, [p]: r.job }));
      log.info('terminal', 'Export started', { projectId: project.id, platform: p });
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function share(p: Platform, url: string) {
    const name = exportFileName(project.title, p, 'mp4');
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], name, { type: 'video/mp4' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: project.title });
      else window.location.href = `${url}?name=${encodeURIComponent(name)}`;
    } catch {
      // Cancelled or not supported: the download link is right there.
    }
  }

  async function copyPost(key: string, text: string) {
    if (await copyText(text)) setCopied(key);
  }

  if (!project.script?.animation) return <TNote tone="warn">Make the animation first.</TNote>;
  return (
    <>
      <TStepHead title="Make the video" help="Your PC renders the 1080 × 1920 MP4 with your voice. You can lock the phone; come back to see it." />
      {!available && <TNote tone="warn">Rendering runs on your PC: start Motion Mind there with npm run dev.</TNote>}
      {error && <TNote tone="error">{error}</TNote>}
      {platforms.map((p) => {
        const j = jobs[p];
        const url = j?.status === 'done' && j.file ? `${config.apiUrl}/api/renders/${j.file}` : null;
        const post = project.script?.post?.[p];
        return (
          <section key={p} className="space-y-3 rounded-2xl border border-line/10 p-4">
            <div className="text-[15px] font-semibold">{PLATFORMS[p].label}</div>
            {running(j) ? (
              <div className="space-y-2">
                <div className="h-2 overflow-hidden rounded-full bg-line/10">
                  <div className="bar-live h-full rounded-full transition-all duration-500" style={{ width: `${Math.round((j?.progress ?? 0) * 100)}%` }} />
                </div>
                <div className="font-mono text-xs text-ink-300">
                  {Math.round((j?.progress ?? 0) * 100)}% · {j?.detail ?? 'rendering…'}
                </div>
              </div>
            ) : url ? (
              <div className="space-y-3">
                <video src={url} controls playsInline className="aspect-[9/16] w-full rounded-xl bg-black" />
                <TButton main icon={<Share2 className="h-5 w-5" />} onClick={() => void share(p, url)}>
                  Share to {PLATFORMS[p].short}
                </TButton>
                <TButton href={`${url}?name=${encodeURIComponent(exportFileName(project.title, p, 'mp4'))}`} icon={<Download className="h-5 w-5" />}>
                  Save video
                </TButton>
              </div>
            ) : (
              <TButton main disabled={!available} onClick={() => void start(p)}>
                Render for {PLATFORMS[p].short}
              </TButton>
            )}
            {j?.status === 'failed' && <TNote tone="error">{j.error ?? 'The render failed.'}</TNote>}
            {url && !running(j) && (
              <button type="button" className="text-sm font-semibold text-accent" onClick={() => void start(p)}>
                Render again
              </button>
            )}
            {post && (
              <div className="space-y-2">
                {p === 'youtube' && post.title && (
                  <TButton onClick={() => void copyPost(`${p}-title`, post.title!)}>{copied === `${p}-title` ? 'Title copied' : 'Copy the title'}</TButton>
                )}
                <TButton onClick={() => void copyPost(`${p}-cap`, `${post.captions[0] ?? ''}\n\n${post.hashtags.join(' ')}`)}>{copied === `${p}-cap` ? 'Caption and hashtags copied' : 'Copy caption and hashtags'}</TButton>
              </div>
            )}
          </section>
        );
      })}
      <TNote>Cover pictures and captions are made on the Export step on your PC; once made, the caption shows here to copy.</TNote>
    </>
  );
});
