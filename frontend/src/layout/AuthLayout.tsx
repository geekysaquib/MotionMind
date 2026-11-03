import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo, LogoMark } from '../components/Logo';
import { DemoBanner } from '../components/DemoBanner';
import { BRAND } from '@motionmind/shared';

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <DemoBanner />
      <div className="grid flex-1 lg:grid-cols-2">
        <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
          <div className="mx-auto w-full max-w-sm animate-fade-up">
            <Link to="/" aria-label="Motion Mind home">
              <Logo />
            </Link>
            <h1 className="mt-10 font-display text-3xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-ink-400">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 text-sm text-ink-400">{footer}</div>}
          </div>
        </div>
        <div className="relative hidden overflow-hidden bg-ink-900 lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(600px_400px_at_70%_30%,rgba(94,234,212,0.18),transparent),radial-gradient(500px_400px_at_20%_80%,rgba(139,92,246,0.2),transparent)]" />
          <div className="relative flex h-full flex-col items-center justify-center p-12 text-center">
            <LogoMark className="h-40 w-40 drop-shadow-[0_20px_60px_rgba(45,212,191,0.35)]" />
            <h2 className="mt-10 max-w-md font-display text-4xl font-bold leading-tight tracking-tight">
              Turn any topic into a <span className="text-accent">cinematic</span> explainer reel.
            </h2>
            <p className="mt-4 max-w-sm text-sm text-ink-400">{BRAND.tagline}: research, script, storyboard, motion graphics, voice and captions in one studio.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
