import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Logo } from '../components/Logo';
import { DemoBanner } from '../components/DemoBanner';
import { BRAND } from '@motionmind/shared';

const POINTS = ['Research with sources on every fact', 'A script written for Indian viewers', 'Your voice, fitted to every scene and word', 'A ready-to-post 1080 × 1920 video'];

/** Sign-in and sign-up: the form on the left, a live reel on the right. */
export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-ink-950">
      <div className="aurora pointer-events-none absolute inset-0" aria-hidden />
      <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative z-10">
        <DemoBanner />
      </div>
      <div className="relative z-10 grid flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
          <Link to="/" aria-label="Motion Mind home" className="w-fit">
            <Logo animated />
          </Link>
          <div className="flex flex-1 items-center">
            <div className="mx-auto w-full max-w-md animate-fade-up">
              <div className="glass rounded-3xl p-7 shadow-soft sm:p-9">
                <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
                {subtitle && <p className="mt-2 text-sm leading-relaxed text-ink-400">{subtitle}</p>}
                <div className="mt-7">{children}</div>
              </div>
              {footer && <div className="mt-6 text-center text-sm text-ink-400">{footer}</div>}
              <p className="mt-6 text-center text-xs text-ink-400">No password. We email you a 6-digit code each time.</p>
            </div>
          </div>
        </div>

        <div className="relative hidden items-center justify-center overflow-hidden border-l border-line/[0.06] lg:flex">
          <div className="relative mx-auto flex max-w-xl flex-col items-center px-10 py-12 text-center">
            <div className="relative w-[230px]">
              <div className="absolute -inset-10 rounded-full bg-brand opacity-30 blur-3xl" aria-hidden />
              <div className="relative animate-float rounded-[2.4rem] border border-line/15 bg-ink-950 p-2 shadow-2xl">
                <video className="block aspect-[9/16] w-full rounded-[1.9rem] object-cover" src="/reel-preview.mp4" poster="/reel-poster.jpg" autoPlay muted loop playsInline aria-label="A reel made with Motion Mind" />
              </div>
            </div>
            <h2 className="mt-10 max-w-md font-display text-4xl font-bold leading-[1.1] tracking-tight">
              Turn any topic into a <span className="text-gradient">cinematic</span> explainer reel.
            </h2>
            <p className="mt-3 max-w-sm text-sm text-ink-400">{BRAND.tagline}</p>
            <ul className="mt-7 grid gap-2.5 text-left text-sm text-ink-300">
              {POINTS.map((t, i) => (
                <li key={t} className="flex items-center gap-2.5 animate-fade-up" style={{ animationDelay: `${0.3 + i * 0.1}s` }}>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
