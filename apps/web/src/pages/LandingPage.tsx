import { observer } from 'mobx-react-lite';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Captions,
  CheckCircle2,
  Clapperboard,
  FileSearch,
  Languages,
  Layers3,
  Mic,
  PenLine,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { BRAND } from '@motionmind/shared';
import { useStores } from '../stores/RootStore';
import { Logo, LogoMark } from '../components/Logo';

const STEPS = [
  { icon: Sparkles, title: 'Pick a topic', text: 'Type a question or browse topic ideas for short explainers.' },
  { icon: FileSearch, title: 'Research it', text: 'Trusted sources are searched, and every claim is cross-checked and cited.' },
  { icon: PenLine, title: 'Write the script', text: 'A hook, the story, a twist and a call to action, in Hindi, Hinglish or English.' },
  { icon: Layers3, title: 'Storyboard', text: 'Each line becomes a scene with visuals, camera moves and on-screen text.' },
  { icon: Boxes, title: 'Build the visuals', text: 'Animated isometric 3D worlds or AI illustrations, with one consistent style.' },
  { icon: Mic, title: 'Add the voice', text: 'Natural narration, with captions synced to every spoken word.' },
  { icon: Clapperboard, title: 'Export', text: '1080 × 1920 MP4, ready for Instagram Reels.' },
];

const FEATURES = [
  {
    icon: Boxes,
    title: 'Motion graphics, not slideshows',
    text: 'One animated world per reel, with camera moves, travelling data, pop-in labels and info cards. It looks produced, not generated.',
  },
  {
    icon: BadgeCheck,
    title: 'Facts you can trust',
    text: 'Claims are marked verified, single-source or conflicting, with links. Nothing goes into the script without a source.',
  },
  {
    icon: Languages,
    title: 'Made for Indian audiences',
    text: 'Hindi narration with Hinglish captions, or English. Captions highlight each word as it is spoken.',
  },
  {
    icon: ShieldCheck,
    title: 'You approve every stage',
    text: 'Topic, research, script, storyboard, visuals, voice and final cut. Go back and change any step without starting over.',
  },
  {
    icon: Captions,
    title: 'Instagram-ready',
    text: 'Safe margins for the Reels interface, bold readable captions, and a branded end card with your handle.',
  },
  {
    icon: Wand2,
    title: 'Bring your own AI keys',
    text: 'Use OpenAI, Anthropic, ElevenLabs, Tavily and more. Keys are encrypted on our server and never shown again.',
  },
];

const FAQ = [
  { q: 'Do I need design or editing skills?', a: 'No. You choose and approve; the studio does the research, writing, visuals, voice and editing.' },
  { q: 'Which languages are supported?', a: 'Hindi, Hinglish and English narration today. Captions can be in Hinglish (Roman script) or the narration language.' },
  { q: 'Who pays for the AI?', a: 'You connect your own provider keys, so you pay providers directly at their rates. Quality tiers let you trade cost for polish.' },
  { q: 'Is the reel above real?', a: 'Yes. It is a test reel made with the Motion Mind engine about how the Where is my Train app works offline.' },
];

function PhoneMock() {
  return (
    <div className="relative mx-auto w-[260px] sm:w-[300px]">
      <div className="absolute -inset-10 rounded-[3rem] bg-[radial-gradient(circle_at_30%_20%,rgba(45,212,191,.35),transparent_60%),radial-gradient(circle_at_80%_80%,rgba(139,92,246,.3),transparent_60%)] blur-2xl" />
      <div className="relative rounded-[2.6rem] border border-line/10 bg-ink-100 p-2.5 shadow-2xl">
        <div className="overflow-hidden rounded-[2.1rem] bg-cream">
          <video
            className="block aspect-[9/16] w-full object-cover"
            src="/reel-preview.mp4"
            poster="/reel-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            aria-label="Preview of a reel made with Motion Mind"
          />
        </div>
      </div>
    </div>
  );
}

export const LandingPage = observer(function LandingPage() {
  const { auth } = useStores();
  const signedIn = auth.ready && auth.isSignedIn;
  const primary = signedIn ? { to: '/app', label: 'Open your studio' } : { to: '/signup', label: 'Start creating' };

  return (
    <div className="min-h-full bg-ink-950 text-ink-100">
      <header className="sticky top-0 z-30 border-b border-line/[0.06] bg-ink-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3.5">
          <Link to="/" aria-label={`${BRAND.name} home`}>
            <Logo size="sm" />
          </Link>
          <nav className="hidden gap-6 text-sm text-ink-300 md:flex" aria-label="Sections">
            <a href="#how" className="hover:text-ink-100">How it works</a>
            <a href="#features" className="hover:text-ink-100">Features</a>
            <a href="#faq" className="hover:text-ink-100">FAQ</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {!signedIn && (
              <Link to="/login" className="rounded-xl px-3 py-2 text-sm font-medium text-ink-300 hover:text-ink-100">
                Sign in
              </Link>
            )}
            <Link to={primary.to} className="rounded-xl bg-mint-600 px-4 py-2 text-sm font-semibold text-white shadow-glow hover:bg-mint-700">
              {signedIn ? 'Open studio' : 'Get started'}
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_85%_10%,rgba(45,212,191,0.12),transparent),radial-gradient(700px_500px_at_0%_30%,rgba(139,92,246,0.08),transparent)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-16 md:grid-cols-[1.15fr_1fr] md:pt-24">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-mint-500/30 bg-mint-400/10 px-3 py-1 text-xs font-semibold text-accent">
              <Sparkles className="h-3.5 w-3.5" /> AI studio for explainer reels
            </span>
            <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
              Turn any question into a <span className="text-accent">cinematic</span> Instagram reel.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-400">
              {BRAND.name} researches the topic, writes the script, builds animated 3D visuals, adds a natural voice and synced captions,
              then hands you a ready-to-post 9:16 video.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link to={primary.to} className="inline-flex items-center gap-2 rounded-xl bg-mint-600 px-6 py-3.5 text-base font-semibold text-white shadow-glow hover:bg-mint-700">
                {primary.label} <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#how" className="rounded-xl border border-line/15 bg-ink-900 px-6 py-3.5 text-base font-semibold hover:bg-ink-800">
                See how it works
              </a>
            </div>
            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-400">
              {['Sources on every fact', 'Hindi · Hinglish · English', '1080 × 1920 MP4'].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-accent" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <PhoneMock />
        </div>
      </section>

      <section id="how" className="border-y border-line/[0.06] bg-ink-900 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">How it works</p>
          <h2 className="mt-3 max-w-2xl font-display text-4xl font-bold tracking-tight">From topic to finished reel in seven steps, with you in control.</h2>
          <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="rounded-2xl border border-line/[0.07] bg-ink-950 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint-400/15 text-accent">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-semibold text-ink-400">Step {i + 1}</span>
                </div>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-ink-400">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="features" className="py-20">
        <div className="mx-auto max-w-6xl px-5">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">Why {BRAND.name}</p>
          <h2 className="mt-3 max-w-2xl font-display text-4xl font-bold tracking-tight">Looks like a production team made it.</h2>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="card p-6">
                <Icon className="h-6 w-6 text-violet-600" />
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-400">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="border-t border-line/[0.06] bg-ink-900 py-20">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="font-display text-4xl font-bold tracking-tight">Questions</h2>
          <div className="mt-8 divide-y divide-line/[0.08]">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
                  {q}
                  <span className="text-ink-400 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-400">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-4xl px-5">
          <div className="relative overflow-hidden rounded-3xl bg-ink-100 px-8 py-14 text-center text-ink-950">
            <div className="absolute inset-0 bg-[radial-gradient(500px_300px_at_80%_0%,rgba(45,212,191,.35),transparent),radial-gradient(500px_300px_at_10%_100%,rgba(139,92,246,.3),transparent)]" />
            <div className="relative">
              <LogoMark className="mx-auto h-14 w-14" />
              <h2 className="mt-6 font-display text-4xl font-bold tracking-tight">Your next reel starts with a question.</h2>
              <Link to={primary.to} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-mint-400 px-6 py-3.5 font-semibold text-ink-100 hover:bg-mint-300">
                {primary.label} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-line/[0.06] py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 text-sm text-ink-400">
          <Logo size="sm" />
          <span>© {new Date().getFullYear()} {BRAND.name}</span>
        </div>
      </footer>
    </div>
  );
});
