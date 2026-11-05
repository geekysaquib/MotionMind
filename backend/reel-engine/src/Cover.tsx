import React, { useMemo } from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { reelTiming, type ReelSpec, type Tone } from './script';
import { C, World } from './World';
import { Backdrop } from './Backdrop';
import { IsoWorld, frameScene, layoutProps, themeFade } from './IsoWorld';
import { DiagramWorld } from './DiagramWorld';
import { withScenes } from './autoScene';
import { cameraAt, fxAt, logoUrlsOf, pinProgressAt, useLogosLoaded } from './Reel';
import { Highlight } from './Ui';
import { fitHeadline, worldRegion, type CoverProps } from './coverLayout';

/** A reel plus the settings of its cover. This is the input of the "Cover" composition, a single still image. */
export type CoverSpec = ReelSpec & { cover: CoverProps };

const TONE: Record<Tone, string> = { red: C.red, teal: C.teal, purple: C.purple, blue: C.blue, amber: C.amber };
const MONO = 'JetBrains Mono';
const DISPLAY = 'Space Grotesk';

function Kicker({ text, color, s, panel, center }: { text: string; color: string; s: number; panel: string; center?: boolean }) {
  if (!text.trim()) return null;
  return (
    <div style={{ display: 'flex', justifyContent: center ? 'center' : 'flex-start' }}>
      <span
        style={{
          fontFamily: MONO,
          fontWeight: 700,
          fontSize: 30 * s,
          letterSpacing: 6 * s,
          textTransform: 'uppercase',
          color,
          background: panel,
          border: `${3 * s}px solid ${color}`,
          borderRadius: 999,
          padding: `${10 * s}px ${26 * s}px`,
        }}
      >
        {text}
      </span>
    </div>
  );
}

function BrandChip({ brand, tone, dark, s, solid }: { brand: ReelSpec['brand']; tone: string; dark: boolean; s: number; solid?: boolean }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 18 * s,
        padding: `${12 * s}px ${28 * s}px ${12 * s}px ${14 * s}px`,
        borderRadius: 999,
        background: solid ? (dark ? 'rgba(16,20,42,0.86)' : 'rgba(255,255,255,0.92)') : 'transparent',
        boxShadow: solid ? '0 10px 30px rgba(31,36,48,0.18)' : undefined,
      }}
    >
      <div
        style={{
          width: 64 * s,
          height: 64 * s,
          borderRadius: 999,
          background: C.ink,
          color: '#fff',
          border: `${4 * s}px solid ${tone}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: DISPLAY,
          fontWeight: 700,
          fontSize: 26 * s,
        }}
      >
        {brand.initials}
      </div>
      <div>
        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 30 * s, letterSpacing: 4 * s, color: dark ? '#F1F3F9' : C.ink }}>{brand.name.toUpperCase()}</div>
        <div style={{ fontFamily: MONO, fontSize: 26 * s, color: dark ? '#A9B1C6' : '#6B7180', marginTop: 2 * s }}>{brand.handle}</div>
      </div>
    </div>
  );
}

/**
 * The cover (thumbnail) of a reel: one scene of its 3D world, framed to leave room for a big headline.
 * Three layouts (bold at the bottom, a card in the middle, a panel at the top) in three sizes.
 */
export const Cover: React.FC<CoverSpec> = (input) => {
  const { cover, ...rest } = input;
  const { width: W, height: H, fps } = useVideoConfig();
  const spec = useMemo(() => withScenes(rest as ReelSpec), [rest]);
  // The picture is taken only after the company logos have loaded.
  useLogosLoaded(useMemo(() => logoUrlsOf(spec), [spec]));
  const { timed, storyFrames } = useMemo(() => reelTiming(spec), [spec]);
  const placed = useMemo(() => layoutProps(timed, spec.layout), [timed, spec.layout]);
  const idx = Math.min(timed.length - 1, Math.max(0, Math.round(cover.scene) || 0));
  const beat = timed[idx]!;
  // A moment late in the scene: the objects have dropped in and the camera has settled.
  const frame = beat.start + Math.min(beat.frames - 1, Math.max(75, Math.round(beat.frames * 0.85)));
  const accent = TONE[cover.tone ?? beat.card.tone] ?? C.teal;
  const dark = spec.world === 'iso' && spec.theme === 'night';
  const panel = dark ? '#10142A' : spec.world === 'iso' ? themeFade(spec.theme) : C.bg;
  const ink = dark ? '#FFFFFF' : C.ink;
  const s = W / 1080;
  const region = worldRegion(cover.style, W, H);

  const world =
    spec.world === 'iso' && spec.look?.scene === 'diagram' ? (
      <DiagramWorld frame={frame} fps={fps} beat={beat} look={spec.look} region={{ l: region.left, r: region.right, t: region.top, b: region.bottom }} logoBase={spec.logoBase} />
    ) : spec.world === 'iso' ? (
      <IsoWorld frame={frame} fps={fps} cam={frameScene(beat.scene, placed, region)} beat={beat} placed={placed} theme={spec.theme} fade={false} logoBase={spec.logoBase} linkStyle={spec.look?.links} />
    ) : spec.world === 'train' ? (
      <World frame={frame} fps={fps} cam={cameraAt(timed, storyFrames, frame, fps)} fx={fxAt(timed, frame)} pinProgress={pinProgressAt(timed, frame, fps)} />
    ) : (
      <Backdrop frame={frame} fps={fps} tone={beat.card.tone} chapter={beat.chapter} progress={0.5} />
    );

  const headline = (fontSize: number, align: 'left' | 'center') => (
    <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize, lineHeight: 1.04, letterSpacing: -fontSize * 0.02, color: ink, textAlign: align, marginTop: 26 * s }}>
      <Highlight text={cover.headline} tone={accent} />
    </div>
  );

  let text: React.ReactNode;
  if (cover.style === 'bold') {
    const fit = fitHeadline(cover.headline, W - 140 * s, H * 0.3);
    text = (
      <>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: H * 0.52, background: `linear-gradient(to top, ${panel} 0%, ${panel} 56%, ${panel}00 100%)` }} />
        <div style={{ position: 'absolute', left: 70 * s, right: 70 * s, bottom: (cover.brand ? 150 : 90) * s }}>
          <Kicker text={cover.kicker} color={accent} s={s} panel={panel} />
          {headline(fit.fontSize * s, 'left')}
        </div>
        {cover.brand && (
          <div style={{ position: 'absolute', left: 56 * s, bottom: 50 * s }}>
            <BrandChip brand={spec.brand} tone={accent} dark={dark} s={s} />
          </div>
        )}
      </>
    );
  } else if (cover.style === 'center') {
    const fit = fitHeadline(cover.headline, W - 120 * s - 120 * s, H * 0.25);
    text = (
      <>
        <div
          style={{
            position: 'absolute',
            left: 60 * s,
            right: 60 * s,
            top: H * 0.585,
            padding: `${46 * s}px ${56 * s}px ${50 * s}px`,
            background: dark ? '#1B2140' : '#FFFFFF',
            borderRadius: 56 * s,
            border: `${5 * s}px solid ${accent}`,
            boxShadow: '0 30px 80px rgba(31,36,48,0.28)',
          }}
        >
          <Kicker text={cover.kicker} color={accent} s={s} panel={dark ? '#1B2140' : '#FFFFFF'} center />
          {headline(fit.fontSize * s, 'center')}
        </div>
        {cover.brand && (
          <div style={{ position: 'absolute', left: 56 * s, top: 56 * s }}>
            <BrandChip brand={spec.brand} tone={accent} dark={dark} s={s} solid />
          </div>
        )}
      </>
    );
  } else {
    const fit = fitHeadline(cover.headline, W - 140 * s, H * 0.4 - 230 * s);
    text = (
      <>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: H * 0.4, background: panel, borderBottom: `${16 * s}px solid ${accent}`, boxShadow: '0 20px 60px rgba(31,36,48,0.22)' }} />
        <div style={{ position: 'absolute', left: 70 * s, right: 70 * s, top: 76 * s }}>
          <Kicker text={cover.kicker} color={accent} s={s} panel={panel} />
          {headline(fit.fontSize * s, 'left')}
        </div>
        {cover.brand && (
          <div style={{ position: 'absolute', left: 56 * s, bottom: 50 * s }}>
            <BrandChip brand={spec.brand} tone={accent} dark={dark} s={s} solid />
          </div>
        )}
      </>
    );
  }

  return (
    <AbsoluteFill style={{ background: panel, overflow: 'hidden' }}>
      {world}
      {text}
    </AbsoluteFill>
  );
};
