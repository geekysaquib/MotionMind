import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';

/**
 * Plays Claude's HyperFrames composition in the browser: the HTML runs in a sandboxed frame (scripts only, no
 * access to the app), and this player seeks its GSAP timeline and shows each clip only during its time, the way
 * the renderer does. The voice clips play alongside.
 */

/** Seeks the composition inside the frame. Mirrors the HyperFrames runtime: clips are visible only in their time. */
const BRIDGE = `<script>(function(){
function seek(t){
  document.querySelectorAll('[data-start]').forEach(function(el){
    if(el.hasAttribute('data-composition-id')) return;
    var s=parseFloat(el.getAttribute('data-start'))||0, d=parseFloat(el.getAttribute('data-duration'));
    var on = t>=s && (isNaN(d) || t<s+d);
    el.style.visibility = on ? '' : 'hidden';
  });
  var tl=window.__timelines||{};
  Object.keys(tl).forEach(function(k){ try{ tl[k].seek(t,false); }catch(e){} });
}
window.addEventListener('message',function(e){ if(e.data && e.data.mm==='seek') seek(e.data.t); });
window.addEventListener('load',function(){ seek(0); parent.postMessage({mm:'ready'},'*'); });
})();</script>`;

/** The composition with GSAP served by this app and the seek bridge added. */
export function playableHtml(html: string, gsapUrl: string): string {
  const local = html.replace(/https:\/\/(?:cdn\.jsdelivr\.net\/npm|unpkg\.com|cdnjs\.cloudflare\.com\/ajax\/libs)\/gsap@?[^"'\s]*?\/(?:dist\/)?gsap(?:\.min)?\.js/g, gsapUrl);
  return /<\/body>/i.test(local) ? local.replace(/<\/body>/i, `${BRIDGE}</body>`) : local + BRIDGE;
}

export interface PlayerClip {
  url: string;
  at: number;
  from?: number;
}

export function HtmlReelPlayer({ html, duration, clips = [], gsapUrl }: { html: string; duration: number; clips?: PlayerClip[]; gsapUrl: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [scale, setScale] = useState(0.3);
  const audios = useRef<HTMLAudioElement[]>([]);
  const started = useRef<{ wall: number; t: number } | null>(null);
  const doc = useMemo(() => playableHtml(html, gsapUrl), [html, gsapUrl]);

  // The 1080x1920 page is scaled down to the width of the player.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 1080));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    audios.current = clips.map((c) => {
      const a = new Audio(c.url);
      a.preload = 'auto';
      return a;
    });
    return () => audios.current.forEach((a) => a.pause());
  }, [clips]);

  const seek = (time: number) => frame.current?.contentWindow?.postMessage({ mm: 'seek', t: time }, '*');

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    started.current = { wall: performance.now(), t };
    clips.forEach((c, i) => {
      const a = audios.current[i];
      if (!a) return;
      const into = t - c.at;
      if (into < -0.05) return;
      a.currentTime = (c.from ?? 0) + Math.max(0, into);
      void a.play().catch(() => undefined);
    });
    const tick = () => {
      const now = started.current!.t + (performance.now() - started.current!.wall) / 1000;
      if (now >= duration) {
        setPlaying(false);
        setT(duration);
        seek(duration);
        return;
      }
      clips.forEach((c, i) => {
        const a = audios.current[i];
        if (!a || now < c.at) return;
        const want = (c.from ?? 0) + (now - c.at);
        if (a.paused) {
          if (now < c.at + 0.3 || a.ended === false) {
            a.currentTime = want;
            void a.play().catch(() => undefined);
          }
        } else if (Math.abs(a.currentTime - want) > 0.12) {
          // The sound started late or the page stuttered: the picture follows the sound, so bring the sound back to the picture.
          a.currentTime = want;
        }
      });
      setT(now);
      seek(now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      audios.current.forEach((a) => a.pause());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  return (
    <div className="overflow-hidden rounded-2xl border border-line/10 bg-ink-900 shadow-soft">
      <div ref={box} className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: '9 / 16' }}>
        <iframe
          ref={frame}
          title="Reel animation"
          // Scripts run, but the frame gets no access to the app, its storage or its cookies.
          sandbox="allow-scripts"
          srcDoc={doc}
          onLoad={() => seek(t)}
          style={{ width: 1080, height: 1920, border: 0, transform: `scale(${scale})`, transformOrigin: '0 0', position: 'absolute', left: 0, top: 0 }}
        />
      </div>
      <div className="flex items-center gap-3 px-3 py-2">
        <button type="button" aria-label={playing ? 'Pause' : 'Play'} className="rounded-full p-1.5 text-ink-100 hover:bg-line/[0.08]" onClick={() => (t >= duration ? (setT(0), seek(0), setPlaying(true)) : setPlaying((p) => !p))}>
          {playing ? <Pause className="h-4 w-4" /> : t >= duration ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <input
          aria-label="Position"
          type="range"
          min={0}
          max={duration}
          step={0.01}
          value={t}
          className="flex-1 accent-current"
          onChange={(e) => {
            const v = Number(e.target.value);
            setPlaying(false);
            setT(v);
            seek(v);
          }}
        />
        <span className="w-20 text-right font-mono text-xs text-ink-400">
          {t.toFixed(1)} / {duration.toFixed(1)}s
        </span>
      </div>
    </div>
  );
}
