import { useEffect, useRef, useState } from 'react';
import type { StyleId } from '@motionmind/shared';
import { STYLE_SAMPLE_HTML } from './styleSamples';

/** A short looping preview of a reel style, in a phone-shaped frame. It plays on its own and stops for people who ask for less motion. */
export function StyleSample({ id, name, className }: { id: StyleId; name: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 360));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className={className} style={{ aspectRatio: '9 / 16', position: 'relative', overflow: 'hidden' }}>
      <iframe
        title={`${name} style preview`}
        // Only CSS animation runs in here; no scripts.
        sandbox=""
        srcDoc={STYLE_SAMPLE_HTML[id]}
        tabIndex={-1}
        aria-hidden
        loading="lazy"
        style={{ width: 360, height: 640, border: 0, transform: `scale(${scale})`, transformOrigin: '0 0', position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
      />
    </div>
  );
}
