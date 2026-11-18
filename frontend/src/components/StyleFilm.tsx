import { useEffect, useRef } from 'react';
import type { StyleId } from '@motionmind/shared';
import { STYLE_FILMS, styleFilmPoster, styleFilmUrl } from './styleFilms';

/**
 * A style's sample film, muted and looping. It loads nothing until the card is on screen, plays only while it is,
 * and stays on its still for people who ask for less motion.
 */
export function StyleFilm({ id, name, className }: { id: StyleId; name: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const film = STYLE_FILMS[id];
  useEffect(() => {
    const v = ref.current;
    if (!v || typeof IntersectionObserver === 'undefined') return;
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) void v.play().catch(() => undefined);
        else v.pause();
      },
      { threshold: 0.4 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);
  if (!film) return null;
  return (
    <video
      ref={ref}
      className={className}
      src={styleFilmUrl(film)}
      poster={styleFilmPoster(id)}
      muted
      loop
      playsInline
      preload="none"
      aria-label={`${name} style sample film`}
    />
  );
}
