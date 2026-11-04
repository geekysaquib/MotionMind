import { observer } from 'mobx-react-lite';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  AudioLines,
  BadgeCheck,
  Boxes,
  Captions,
  CheckCircle2,
  ClipboardCopy,
  Clapperboard,
  FileSearch,
  KeyRound,
  Languages,
  Layers3,
  Mic,
  PenLine,
  Play,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { BRAND } from '@motionmind/shared';
import { useStores } from '../stores/RootStore';
import { Logo, LogoMark } from '../components/Logo';
import { CountUp, Reveal, Typewriter } from '../components/motion';

const STEPS = [
  { icon: Sparkles, title: 'Pick a topic', text: 'Type a question, or start from an idea. Choose the length and the quality.', sample: '“How does a Soundbox know the money arrived?”' },
  { icon: FileSearch, title: 'Research it', text: 'Sources are searched and every claim is marked verified, single-source or conflicting.', sample: '12 facts · 9 verified · 7 sources' },
  { icon: PenLine, title: 'Write the script', text: 'A hook, the explanation in steps, and a payoff, in Hindi, Hinglish or English.', sample: '9 scenes · 52 seconds spoken' },
  { icon: Layers3, title: 'Storyboard', text: 'Every line becomes a scene. Edit the words, the objects, the links and the look.', sample: 'Phone → NPCI → Bank → Soundbox' },
  { icon: Boxes, title: 'See it in 3D', text: 'An animated isometric world where the camera glides between the things you are explaining.', sample: 'Any object, any topic' },
  { icon: Mic, title: 'Add the voice', text: 'Copy the narration into any text-to-speech tool, or upload your own recording. Set the pace per scene.', sample: 'Captions follow every word' },
  { icon: Clapperboard, title: 'Export', text: 'A 1080 × 1920 MP4 with safe margins for the Reels interface and your branded end card.', sample: 'Ready to post' },
];

const FEATURES = [
  { icon: Boxes, tone: 'from-mint-400 to-mint-600', title: 'Graphics that follow your topic', text: 'Vaccines, payments, trains, chips: each scene draws the objects the narration talks about, on a world that fits the subject.' },
  { icon: BadgeCheck, tone: 'from-violet-400 to-violet-600', title: 'Facts you can trust', text: 'Research keeps its sources. You approve it before the script is written from it.' },
  { icon: Languages, tone: 'from-coral-300 to-coral-500', title: 'Made for Indian audiences', text: 'Hindi, Hinglish or English narration. Translate the voice script in one click.' },
  { icon: ShieldCheck, tone: 'from-mint-300 to-violet-500', title: 'You approve every stage', text: 'Go back and change any step without starting over. Nothing is locked in.' },
  { icon: Captions, tone: 'from-violet-400 to-coral-500', title: 'Captions with timing', text: 'Words highlight as they are spoken. Choose size, position and style.' },
  { icon: AudioLines, tone: 'from-mint-400 to-violet-500', title: 'A real reel editor', text: 'Drag scene breaks on the waveform, set the pace for the whole reel or one scene, add music.' },
];

const TOPICS = [
  'How UPI Soundbox speaks', 'Where is my Train works offline', 'How a vaccine trains your body', 'Why 5G needs so many towers', 'How GPS finds you', 'What happens when you tap a card',
  'How Google Maps predicts traffic', 'Why your phone gets hot', 'How a bank keeps your money safe', 'How Netflix streams without buffering', 'How an ATM knows your PIN', 'How WhatsApp delivers a message',
];

const FAQ = [
  { q: 'Do I need design or editing skills?', a: 'No. You choose and approve; the studio does the research, writing, visuals and timing.' },
  { q: 'Do I need an API key?', a: 'No. Pick “Copy and paste” in Settings: Motion Mind gives you a ready prompt, you run it in claude.ai with your own subscription, and paste the answer back. If your server has API keys, you can switch to one-click mode instead.' },
  { q: 'Which languages are supported?', a: 'Hindi, Hinglish and English for narration and captions. The voice script can be translated between English and Hindi.' },
  { q: 'How does the voice work?', a: 'Copy the narration into any text-to-speech tool, or record it yourself, then upload one file. You mark where each scene starts, and set the speed for any scene. With an ElevenLabs key, the studio can also speak every scene for you.' },
  { q: 'Is the reel above real?', a: 'Yes. It is a test reel made with the Motion Mind engine about how the Where is my Train app works offline.' },
];

function PhoneMock() {
  return (
    <div className="relative mx-auto w-[260px] sm:w-[300px]">
      <div className="orb -left-10 -top-6 h-52 w-52 bg-mint-400/60" />
      <div className="orb -bottom-8 -right-8 h-56 w-56 bg-violet-500/50" style={{ animationDelay: '-6s' }} />
      <div className="relative animate-float rounded-[2.6rem] border border-line/10 bg-ink-100 p-2.5 shadow-2xl">
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
      <Chip className="-left-16 top-16 sm:-left-24" icon={<FileSearch className="h-3.5 w-3.5" />} text="12 facts verified" delay="0s" />
      <Chip className="-right-12 top-44 sm:-right-20" icon={<Boxes className="h-3.5 w-3.5" />} text="3D scene ready" delay="-2s" />
      <Chip className="-left-12 bottom-24 sm:-left-20" icon={<Mic className="h-3.5 w-3.5" />} text="Voice in sync" delay="-4s" />
    </div>
  );
}

function Chip({ icon, text, className, delay }: { icon: React.ReactNode; text: string; className: string; delay: string }) {
  return (
    <div className={`absolute hidden animate-float-slow items-center gap-1.5 rounded-full border border-line/10 bg-ink-900 px-3 py-1.5 text-xs font-semibold shadow-soft md:flex ${className}`} style={{ animationDelay: delay }}>
      <span className="text-accent">{icon}</span> {text}
    </div>
  );
}

export const LandingPage = observer(function LandingPage() {
  const { auth } = useStores();
  const signedIn = auth.ready && auth.isSignedIn;
  const primary = signedIn ? { to: '/app', label: 'Open your studio' } : { to: '/login', label: 'Start creating' };

  return (
    <div className="min-h-full overflow-x-hidden bg-ink-950 text-ink-100">
      <header className="sticky top-0 z-30 border-b border-line/[0.06] bg-ink-950/75 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3.5">
          <Link to="/" aria-label={`${BRAND.name} home`}>
            <Logo size="sm" animated />
          </Link>
          <nav className="hidden gap-6 text-sm text-ink-300 md:flex" aria-label="Sections">
            <a href="#how" className="hover:text-ink-100">How it works</a>
            <a href="#features" className="hover:text-ink-100">Features</a>
            <a href="#ways" className="hover:text-ink-100">Two ways to work</a>
            <a href="#faq" className="hover:text-ink-100">FAQ</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {!signedIn && (
              <Link to="/login" className="rounded-xl px-3 py-2 text-sm font-medium text-ink-300 hover:text-ink-100">
                Sign in
              </Link>
            )}
            <Link to={primary.to} className="rounded-xl bg-mint-600 px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-mint-700">
              {signedIn ? 'Open studio' : 'Get started'}
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="dot-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_50%_30%,black,transparent_75%)]" />
        <div className="orb -right-24 top-0 h-96 w-96 bg-mint-400/40" />
        <div className="orb -left-24 top-72 h-80 w-80 bg-violet-500/30" style={{ animationDelay: '-7s' }} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-5 pb-24 pt-14 md:grid-cols-[1.15fr_1fr] md:pt-24">
          <div>
            <span className="inline-flex animate-rise items-center gap-2 rounded-full border border-mint-500/30 bg-mint-400/10 px-3 py-1 text-xs font-semibold text-accent">
              <Sparkles className="h-3.5 w-3.5" /> AI studio for explainer reels
            </span>
            <h1 className="mt-6 animate-rise font-display text-5xl font-bold leading-[1.05] tracking-tight [animation-delay:80ms] md:text-6xl">
              Turn any question into a <span className="text-gradient">cinematic</span> Instagram reel.
            </h1>
            <p className="mt-5 h-8 animate-rise text-xl font-medium text-ink-300 [animation-delay:160ms]">
              Today: <Typewriter className="text-accent" phrases={['how UPI Soundbox speaks', 'how a vaccine trains your body', 'where my train is, offline', 'why 5G needs so many towers']} />
            </p>
            <p className="mt-5 max-w-xl animate-rise text-lg text-ink-400 [animation-delay:240ms]">
              {BRAND.name} researches the topic, writes the script, builds animated 3D scenes that match what you are explaining, and gives you a voice script,
              timed captions and a ready-to-post 9:16 video.
            </p>
            <div className="mt-9 flex animate-rise flex-wrap items-center gap-3 [animation-delay:320ms]">
              <Link to={primary.to} className="group inline-flex items-center gap-2 rounded-xl bg-mint-600 px-6 py-3.5 text-base font-semibold text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-mint-700">
                {primary.label} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </Link>
              <a href="#how" className="inline-flex items-center gap-2 rounded-xl border border-line/15 bg-ink-900 px-6 py-3.5 text-base font-semibold transition hover:-translate-y-0.5 hover:bg-ink-800">
                <Play className="h-4 w-4" /> See how it works
              </a>
            </div>
            <ul className="mt-9 flex animate-rise flex-wrap gap-x-6 gap-y-2 text-sm text-ink-400 [animation-delay:400ms]">
              {['Sources on every fact', 'Hindi · Hinglish · English', 'No API key needed', '1080 × 1920 MP4'].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-accent" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <PhoneMock />
        </div>
      </section>

      <section aria-label="Topic ideas" className="overflow-hidden border-y border-line/[0.06] bg-ink-900 py-4">
        <div className="flex w-max animate-marquee gap-3 hover:[animation-play-state:paused]">
          {[...TOPICS, ...TOPICS].map((t, i) => (
            <span key={i} className="whitespace-nowrap rounded-full border border-line/10 bg-ink-950 px-4 py-1.5 text-sm text-ink-300">
              <span className="mr-2 text-accent">●</span>
              {t}
            </span>
          ))}
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 text-center md:grid-cols-4">
          {[
            { n: 7, label: 'steps, each one yours to approve' },
            { n: 16, label: 'ready 3D objects, plus any icon you like', suffix: '+' },
            { n: 3, label: 'languages for voice and captions' },
            { n: 0, label: 'API keys needed in copy-paste mode' },
          ].map((s, i) => (
            <Reveal key={s.label} delay={i * 90}>
              <div className="font-display text-5xl font-bold tracking-tight text-gradient">
                <CountUp to={s.n} />
                {s.suffix}
              </div>
              <div className="mx-auto mt-2 max-w-[11rem] text-sm text-ink-400">{s.label}</div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="how" className="border-y border-line/[0.06] bg-ink-900 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">How it works</p>
            <h2 className="mt-3 max-w-2xl font-display text-4xl font-bold tracking-tight">From topic to finished reel in seven steps, with you in control.</h2>
          </Reveal>
          <ol className="relative mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, text, sample }, i) => (
              <Reveal as="li" key={title} delay={(i % 4) * 90} className="group relative rounded-2xl border border-line/[0.07] bg-ink-950 p-5 transition duration-300 hover:-translate-y-1 hover:border-mint-500/40 hover:shadow-[0_20px_44px_-22px_rgba(13,148,136,0.5)]">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-mint-400/25 to-violet-500/25 text-accent transition group-hover:scale-110 group-hover:rotate-[-6deg]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-display text-3xl font-bold text-line/[0.14]">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-ink-400">{text}</p>
                <div className="mt-4 rounded-lg bg-line/[0.05] px-3 py-2 font-mono text-[11px] text-ink-300">{sample}</div>
              </Reveal>
            ))}
            <Reveal as="li" delay={270} className="flex flex-col items-start justify-center rounded-2xl bg-gradient-to-br from-mint-600 to-violet-600 p-6 text-white">
              <Wand2 className="h-7 w-7" />
              <p className="mt-3 font-display text-xl font-bold">All of it in one place.</p>
              <Link to={primary.to} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline">
                {primary.label} <ArrowRight className="h-4 w-4" />
              </Link>
            </Reveal>
          </ol>
        </div>
      </section>

      <section id="features" className="py-20">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">Why {BRAND.name}</p>
            <h2 className="mt-3 max-w-2xl font-display text-4xl font-bold tracking-tight">Looks like a production team made it.</h2>
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, tone, title, text }, i) => (
              <Reveal key={title} delay={(i % 3) * 90} className="card card-hover p-6">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${tone} text-white shadow-soft`}>
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-400">{text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="ways" className="border-y border-line/[0.06] bg-ink-900 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">Two ways to work</p>
            <h2 className="mt-3 max-w-2xl font-display text-4xl font-bold tracking-tight">Use your Claude subscription, or one-click with keys.</h2>
            <p className="mt-3 max-w-2xl text-ink-400">Switch any time in Settings. Every screen shows only the way you picked.</p>
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <Reveal className="card card-hover p-7">
              <ClipboardCopy className="h-7 w-7 text-accent" />
              <h3 className="mt-4 font-display text-xl font-bold">Copy and paste</h3>
              <p className="mt-1 text-sm text-ink-400">No key, nothing to set up.</p>
              <ol className="mt-5 space-y-3 text-sm">
                {['Copy the ready-made prompt for research, the script or a translation.', 'Run it in claude.ai with your own subscription.', 'Paste the answer back. It is checked and saved.'].map((t, i) => (
                  <li key={t} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mint-400/15 text-xs font-bold text-accent">{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ol>
            </Reveal>
            <Reveal delay={120} className="card card-hover p-7">
              <KeyRound className="h-7 w-7 text-violet-600" />
              <h3 className="mt-4 font-display text-xl font-bold">API keys</h3>
              <p className="mt-1 text-sm text-ink-400">One click, for whoever runs the studio.</p>
              <ol className="mt-5 space-y-3 text-sm">
                {['Claude researches the topic with web search and writes the script.', 'Translate the narration into Hindi or English.', 'ElevenLabs can speak every scene, with captions timed to the words.'].map((t, i) => (
                  <li key={t} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-xs font-bold text-violet-600">{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="faq" className="py-20">
        <div className="mx-auto max-w-3xl px-5">
          <Reveal>
            <h2 className="font-display text-4xl font-bold tracking-tight">Questions</h2>
          </Reveal>
          <div className="mt-8 divide-y divide-line/[0.08]">
            {FAQ.map(({ q, a }, i) => (
              <Reveal key={q} delay={i * 50}>
                <details className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                    {q}
                    <span className="text-xl text-ink-400 transition duration-300 group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-ink-400">{a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-20">
        <div className="mx-auto max-w-4xl px-5">
          <Reveal className="relative overflow-hidden rounded-3xl bg-ink-100 px-8 py-16 text-center text-ink-950">
            <div className="orb -right-10 -top-10 h-72 w-72 bg-mint-400/60" />
            <div className="orb -bottom-16 -left-10 h-72 w-72 bg-violet-500/50" style={{ animationDelay: '-7s' }} />
            <div className="relative">
              <LogoMark animated className="mx-auto h-16 w-16" />
              <h2 className="mt-6 font-display text-4xl font-bold tracking-tight">Your next reel starts with a question.</h2>
              <p className="mx-auto mt-3 max-w-md text-sm opacity-70">Sign in with an emailed code. No password.</p>
              <Link to={primary.to} className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-mint-400 px-6 py-3.5 font-semibold text-ink-100 transition hover:-translate-y-0.5 hover:bg-mint-300">
                {primary.label} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </Link>
            </div>
          </Reveal>
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
