import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo, LogoMark } from '../components/Logo';
import { FloatingIcons } from '../components/FloatingIcons';
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
              <Logo animated />
            </Link>
            <h1 className="mt-10 font-display text-3xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-ink-400">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 text-sm text-ink-400">{footer}</div>}
          </div>
        </div>
        <div className="relative hidden overflow-hidden bg-ink-900 lg:block">
          <div className="relative flex h-full flex-col items-center justify-center p-12 text-center">
            <FloatingIcons tone="text-ink-100/[0.16]" />
            <LogoMark animated className="relative h-40 w-40 animate-float" />
            <h2 className="mt-10 max-w-md font-display text-4xl font-bold leading-tight tracking-tight">
              Turn any topic into a <span className="text-accent">cinematic</span> explainer reel.
            </h2>
            <p className="mt-4 max-w-sm text-sm text-ink-400">{BRAND.tagline}: research, script, storyboard, motion graphics, voice and captions in one studio.</p>
            <ul className="relative mt-8 flex max-w-md flex-wrap justify-center gap-2" aria-label="Steps">
              {['Topic', 'Research', 'Script', 'Storyboard', 'Style', 'Voice', 'Export'].map((t, i) => (
                <li key={t} className="animate-pop rounded-full border border-line/10 bg-ink-950/60 px-3 py-1 text-xs font-medium text-ink-300 backdrop-blur" style={{ animationDelay: `${0.5 + i * 0.12}s` }}>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
