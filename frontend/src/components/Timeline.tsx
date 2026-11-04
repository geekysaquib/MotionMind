import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { clampClosingAt, MIN_SCENE_SEC, moveCut, sceneBounds, PEAKS_PER_SEC } from '@motionmind/shared';
import { cn } from '../lib/cn';

interface Props {
  peaks: number[];
  durationSec: number;
  /** Where each scene after the first starts, in seconds. */
  cuts: number[];
  onChange: (cuts: number[]) => void;
  /** Scene being edited: highlighted on the waveform. */
  selected?: number;
  onSelect?: (scene: number) => void;
  /** Playhead position in seconds, if the preview reports one. */
  playheadSec?: number;
  /** Where the "follow us" line starts, when the recording ends with one. The last scene ends there. */
  closingAt?: number | null;
  onClosingChange?: (t: number) => void;
}

const H = 104;
/** Each scene is a clip in its own colour, like tracks in a video editor. */
const CLIP = ['#E8734A', '#0D9488', '#7C3AED', '#0EA5E9'];

/** The recording as a waveform, with one draggable break per scene. Arrow keys nudge a focused break by 0.05 s. */
export function Timeline({ peaks, durationSec, cuts, onChange, selected, onSelect, playheadSec, closingAt, onClosingChange }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | 'closing' | null>(null);
  const sceneEnd = closingAt ?? durationSec;
  const bounds = sceneBounds(cuts, sceneEnd);
  const pct = (t: number) => `${(t / durationSec) * 100}%`;

  const timeAt = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    return Math.min(durationSec, Math.max(0, ((clientX - r.left) / Math.max(1, r.width)) * durationSec));
  };

  const down = (k: number | 'closing') => (e: PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag(k);
  };
  const move = (e: PointerEvent) => {
    if (drag === null) return;
    if (drag === 'closing') onClosingChange?.(clampClosingAt(timeAt(e.clientX), cuts, durationSec));
    else onChange(moveCut(cuts, drag, timeAt(e.clientX), sceneEnd, MIN_SCENE_SEC));
  };
  const key = (k: number) => (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.25 : 0.05;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      onChange(moveCut(cuts, k, cuts[k]! + (e.key === 'ArrowLeft' ? -step : step), sceneEnd, MIN_SCENE_SEC));
    }
  };
  const closingKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.25 : 0.05;
    if (closingAt != null && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      onClosingChange?.(clampClosingAt(closingAt + (e.key === 'ArrowLeft' ? -step : step), cuts, durationSec));
    }
  };

  const bars = peaks.length ? peaks : [];
  const w = Math.max(1, bars.length);

  return (
    <div ref={box} className="relative select-none touch-none" style={{ height: H }} onPointerMove={move} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${w} 100`} preserveAspectRatio="none" aria-hidden>
        {bounds.map((b, i) => {
          const x = b.start * PEAKS_PER_SEC;
          const w = Math.max(0, (b.end - b.start) * PEAKS_PER_SEC);
          const c = CLIP[i % CLIP.length]!;
          return (
            <g key={i}>
              <rect x={x} width={w} y={0} height={100} fill={c} fillOpacity={i === selected ? 0.2 : 0.09} />
              <rect x={x} width={w} y={0} height={5} fill={c} fillOpacity={i === selected ? 1 : 0.75} />
            </g>
          );
        })}
        {bars.map((p, i) => {
          const h = Math.max(2, p);
          return <rect key={i} x={i + 0.15} width={0.7} y={50 - h / 2} height={h} className="fill-ink-300/60" />;
        })}
      </svg>
      {bounds.map((b, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect?.(i)}
          className={cn('absolute top-1.5 h-5 truncate px-1.5 text-left text-[10px] font-semibold', i === selected ? 'text-ink-100' : 'text-ink-300')}
          style={{ left: pct(b.start), width: pct(b.end - b.start) }}
          aria-label={`Scene ${i + 1}, ${(b.end - b.start).toFixed(1)} seconds`}
        >
          {i + 1}
        </button>
      ))}
      {cuts.map((c, k) => (
        <div
          key={k}
          role="slider"
          tabIndex={0}
          aria-label={`Break between scene ${k + 1} and ${k + 2}`}
          aria-valuemin={0}
          aria-valuemax={durationSec}
          aria-valuenow={Number(c.toFixed(2))}
          aria-valuetext={`${c.toFixed(2)} seconds`}
          onPointerDown={down(k)}
          onKeyDown={key(k)}
          className="absolute top-0 bottom-0 -ml-2 w-4 cursor-ew-resize focus:outline-none group"
          style={{ left: pct(c) }}
        >
          <div className={cn('mx-auto h-full w-0.5 bg-coral group-focus:w-1', drag === k && 'w-1')} />
        </div>
      ))}
      {closingAt != null && (
        <>
          <div className="pointer-events-none absolute bottom-0 top-0 bg-violet-500/10" style={{ left: pct(closingAt), right: 0 }} aria-hidden />
          <span className="pointer-events-none absolute bottom-1 truncate px-1.5 text-[10px] font-semibold text-violet-600" style={{ left: pct(closingAt) }}>
            Follow line
          </span>
          <div
            role="slider"
            tabIndex={0}
            aria-label="Start of the follow line"
            aria-valuemin={0}
            aria-valuemax={durationSec}
            aria-valuenow={Number(closingAt.toFixed(2))}
            aria-valuetext={`${closingAt.toFixed(2)} seconds`}
            onPointerDown={down('closing')}
            onKeyDown={closingKey}
            className="group absolute bottom-0 top-0 -ml-2 w-4 cursor-ew-resize focus:outline-none"
            style={{ left: pct(closingAt) }}
          >
            <div className={cn('mx-auto h-full w-0.5 bg-violet-600 group-focus:w-1', drag === 'closing' && 'w-1')} />
          </div>
        </>
      )}
      {playheadSec !== undefined && <div className="pointer-events-none absolute top-0 bottom-0 w-px bg-ink-100" style={{ left: pct(Math.min(playheadSec, durationSec)) }} />}
    </div>
  );
}
