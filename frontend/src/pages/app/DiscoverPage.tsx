import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Banknote, Brain, Cpu, Info, Smartphone, TrainFront, type LucideIcon } from 'lucide-react';
import { PageHeader } from '../../layout/AppShell';
import { Reveal } from '../../components/motion';
import { cn } from '../../lib/cn';

interface Idea {
  topic: string;
  hook: string;
  seconds: number;
}

const CATEGORIES: { id: string; label: string; icon: LucideIcon; tone: string; ideas: Idea[] }[] = [
  {
    id: 'money',
    label: 'Payments & money',
    icon: Banknote,
    tone: 'bg-emerald-500/10 text-emerald-600',
    ideas: [
      { topic: 'How does a UPI Soundbox know the money arrived?', hook: 'The shop speaker says “₹50 received” in about two seconds. Who told it?', seconds: 60 },
      { topic: 'What happens in the two seconds after you scan a UPI QR code?', hook: 'Your money crosses two banks and a switch before you lift your thumb.', seconds: 60 },
      { topic: 'How does a bank keep your money safe when the server is attacked?', hook: 'Why a stolen password alone is not enough to empty an account.', seconds: 45 },
      { topic: 'What happens when you tap your card to pay?', hook: 'A card that never touches the machine still proves it is really yours.', seconds: 45 },
    ],
  },
  {
    id: 'phones',
    label: 'Phones & networks',
    icon: Smartphone,
    tone: 'bg-sky-500/10 text-sky-600',
    ideas: [
      { topic: 'Why does 5G need so many towers?', hook: 'Faster signals travel less far, so the towers have to come closer.', seconds: 45 },
      { topic: 'How does GPS find you without using the internet?', hook: 'Satellites only broadcast the time. Your phone does the rest.', seconds: 60 },
      { topic: 'Why does your phone get hot while charging?', hook: 'Where the lost energy goes, and why fast charging makes more of it.', seconds: 30 },
      { topic: 'How does WhatsApp deliver a message when your phone is off?', hook: 'The message waits on a server, and the two blue ticks tell a story.', seconds: 45 },
    ],
  },
  {
    id: 'science',
    label: 'Health & science',
    icon: Brain,
    tone: 'bg-rose-500/10 text-rose-600',
    ideas: [
      { topic: 'How does a vaccine train your body to fight a virus?', hook: 'A harmless copy teaches your immune system what the enemy looks like.', seconds: 60 },
      { topic: 'Why do we get a fever when we are sick?', hook: 'Your body turns up its own heat on purpose. Here is why.', seconds: 45 },
      { topic: 'How does a pacemaker keep a heart on beat?', hook: 'A tiny device listens to your heart and steps in only when needed.', seconds: 45 },
      { topic: 'How do antibiotics kill bacteria but not you?', hook: 'They attack parts that bacteria have and your cells do not.', seconds: 45 },
    ],
  },
  {
    id: 'transport',
    label: 'Travel & transport',
    icon: TrainFront,
    tone: 'bg-amber-500/10 text-amber-600',
    ideas: [
      { topic: 'How does the Where is my Train app work without GPS or internet?', hook: 'It listens to mobile towers along the track and matches them to a map.', seconds: 60 },
      { topic: 'How does Google Maps predict traffic?', hook: 'Millions of phones quietly report how fast they are moving.', seconds: 60 },
      { topic: 'How does a metro train stop exactly at the platform door?', hook: 'The train brakes itself, to the centimetre, with no driver steering.', seconds: 45 },
      { topic: 'How does FASTag charge you without stopping the car?', hook: 'A sticker the size of a coin talks to a reader at highway speed.', seconds: 45 },
    ],
  },
  {
    id: 'tech',
    label: 'AI & everyday tech',
    icon: Cpu,
    tone: 'bg-violet-500/10 text-violet-600',
    ideas: [
      { topic: 'How does Netflix stream without buffering?', hook: 'The film is stored near you, in pieces, long before you press play.', seconds: 60 },
      { topic: 'How does a chatbot decide the next word to say?', hook: 'It does one thing, over and over: guess what comes next.', seconds: 60 },
      { topic: 'How does face unlock know it is you and not a photo?', hook: 'Your phone maps depth, not just a picture of your face.', seconds: 45 },
      { topic: 'How does a QR code store a whole web address in a square?', hook: 'Three big squares, a pattern of dots, and clever error correction.', seconds: 45 },
    ],
  },
];

/** Starter ideas by category. Each one opens the new-reel form with the topic filled in. */
export function DiscoverPage() {
  const [active, setActive] = useState(CATEGORIES[0]!.id);
  const cat = CATEGORIES.find((c) => c.id === active)!;
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <PageHeader title="Discover topics" subtitle="Starter ideas that work as short explainers. Pick one and the new-reel form opens with it filled in." />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Topic categories">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={active === c.id}
            onClick={() => setActive(c.id)}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition',
              active === c.id ? 'border-mint-500/50 bg-mint-500/10 text-accent' : 'border-line/[0.12] bg-ink-900 text-ink-300 hover:bg-ink-800',
            )}
          >
            <c.icon className="h-4 w-4" /> {c.label}
          </button>
        ))}
      </div>

      <div key={cat.id} className="grid gap-4 md:grid-cols-2">
        {cat.ideas.map((idea, i) => (
          <Reveal key={idea.topic} delay={i * 70}>
            <Link to={`/app?new=1&topic=${encodeURIComponent(idea.topic)}`} className="card card-hover group flex h-full flex-col p-5">
              <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', cat.tone)}>
                <cat.icon className="h-4 w-4" />
              </span>
              <h2 className="mt-4 font-display text-lg font-bold leading-snug">{idea.topic}</h2>
              <p className="mt-2 flex-1 text-sm text-ink-400">{idea.hook}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-ink-400">
                <span>About {idea.seconds} seconds</span>
                <span className="inline-flex items-center gap-1 font-semibold text-accent">
                  Make this reel <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>

      <p className="flex items-start gap-2 rounded-lg bg-ink-700/60 p-3 text-xs text-ink-400">
        <Info className="mt-0.5 h-4 w-4 shrink-0" /> These are ideas we picked, not live trends. Searching for what is trending now is not built yet.
      </p>
    </div>
  );
}
