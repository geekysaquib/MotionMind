import React, { useMemo } from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { DEFAULT_CAPTION_STYLE, reelTiming, type ReelSpec } from './script';
import { kitFor } from './styles';
import { logoUrlsOf, parts, useLogosLoaded, zonesFor } from './styles/common';
import { fitHeadline, type CoverProps } from './coverLayout';

/** A reel plus the settings of its cover. This is the input of the "Cover" composition, a single still image. */
export type CoverSpec = ReelSpec & { cover: CoverProps };

/**
 * The cover (thumbnail) of a reel: one settled moment of a scene, drawn in the reel's style, with a big headline.
 * Three layouts (bold at the bottom, a card in the middle, a panel at the top) in three sizes.
 */
export const Cover: React.FC<CoverSpec> = (input) => {
  const { cover, ...spec } = input;
  const { width: W, height: H, fps } = useVideoConfig();
  useLogosLoaded(useMemo(() => logoUrlsOf(spec), [spec]));
  const { timed, storyFrames } = useMemo(() => reelTiming(spec), [spec]);
  const kit = kitFor(spec.style);
  const p = kit.palette;
  const idx = Math.min(timed.length - 1, Math.max(0, Math.round(cover.scene) || 0));
  const beat = timed[idx]!;
  // A moment late in the scene, once everything has drawn in.
  const frame = beat.start + Math.min(beat.frames - 1, Math.max(75, Math.round(beat.frames * 0.85)));
  const s = W / 1080;
  // The stage is drawn at reel size and scaled to the cover's width; shorter covers show its middle.
  const zones = zonesFor(spec.platform, DEFAULT_CAPTION_STYLE);
  const stageScale = W / 1080;
  const stageTop = (H - 1920 * stageScale) / 2 - (cover.style === 'split' ? -H * 0.12 : H * 0.08);

  const headline = (fontSize: number, align: 'left' | 'center') => (
    <div style={{ fontFamily: p.font, fontWeight: 900, fontSize, lineHeight: 1.04, letterSpacing: -fontSize * 0.02, color: p.ink, textAlign: align, marginTop: 22 * s }}>
      {parts(cover.headline).map((x, i) => (x.hi ? <span key={i} style={{ color: p.hiInk, background: p.hiBg, padding: p.hiBg === 'transparent' ? 0 : `0 ${10 * s}px` }}>{x.text}</span> : <span key={i}>{x.text}</span>))}
    </div>
  );
  const kicker = cover.kicker.trim() ? (
    <span style={{ fontFamily: p.font, fontWeight: 800, fontSize: 30 * s, letterSpacing: 6 * s, textTransform: 'uppercase', color: p.bg, background: p.accent, padding: `${10 * s}px ${24 * s}px`, borderRadius: 999 }}>{cover.kicker}</span>
  ) : null;
  const brand = cover.brand ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 * s, fontFamily: p.font }}>
      <div style={{ width: 64 * s, height: 64 * s, borderRadius: 999, background: p.accent, color: p.bg, fontWeight: 900, fontSize: 26 * s, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{spec.brand.initials}</div>
      <div style={{ color: p.ink, fontWeight: 800, fontSize: 30 * s }}>
        {spec.brand.name}
        <div style={{ fontWeight: 500, fontSize: 24 * s, opacity: 0.7 }}>{spec.brand.handle}</div>
      </div>
    </div>
  ) : null;

  let text: React.ReactNode;
  if (cover.style === 'bold') {
    const fit = fitHeadline(cover.headline, W - 140 * s, H * 0.3);
    text = (
      <>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: H * 0.5, background: `linear-gradient(to top, ${p.bg} 0%, ${p.bg} 58%, ${p.bg}00 100%)` }} />
        <div style={{ position: 'absolute', left: 70 * s, right: 70 * s, bottom: (cover.brand ? 160 : 90) * s }}>
          {kicker}
          {headline(fit.fontSize * s, 'left')}
        </div>
        {brand && <div style={{ position: 'absolute', left: 60 * s, bottom: 50 * s }}>{brand}</div>}
      </>
    );
  } else if (cover.style === 'center') {
    const fit = fitHeadline(cover.headline, W - 240 * s, H * 0.25);
    text = (
      <>
        <div style={{ position: 'absolute', left: 60 * s, right: 60 * s, top: H * 0.56, padding: `${44 * s}px ${56 * s}px`, background: p.panel, borderRadius: 50 * s, border: `${5 * s}px solid ${p.accent}`, boxShadow: '0 30px 80px rgba(0,0,0,0.3)', textAlign: 'center' }}>
          {kicker}
          {headline(fit.fontSize * s, 'center')}
        </div>
        {brand && <div style={{ position: 'absolute', left: 56 * s, top: 56 * s }}>{brand}</div>}
      </>
    );
  } else {
    const fit = fitHeadline(cover.headline, W - 140 * s, H * 0.4 - 230 * s);
    text = (
      <>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: H * 0.4, background: p.bg, borderBottom: `${16 * s}px solid ${p.accent}` }} />
        <div style={{ position: 'absolute', left: 70 * s, right: 70 * s, top: 76 * s }}>
          {kicker}
          {headline(fit.fontSize * s, 'left')}
        </div>
        {brand && <div style={{ position: 'absolute', left: 56 * s, bottom: 50 * s }}>{brand}</div>}
      </>
    );
  }

  return (
    <AbsoluteFill style={{ background: p.bg, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: stageTop, width: 1080, height: 1920, transform: `scale(${stageScale})`, transformOrigin: 'top left' }}>
        <kit.Stage frame={frame} fps={fps} spec={spec} timed={timed} beat={beat} index={idx} storyFrames={storyFrames} zones={zones} captions={DEFAULT_CAPTION_STYLE} bare />
      </div>
      {text}
    </AbsoluteFill>
  );
};
