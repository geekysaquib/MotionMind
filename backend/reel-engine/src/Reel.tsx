import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, Loop, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { DEFAULT_CAPTION_STYLE, reelTiming, type ReelSpec, type TimedBeat } from './script';
import { sceneSounds } from './styles/composer';
import { SFX_VOLUME, sfxUrls, type SfxKind } from './sfx';
import { kitFor } from './styles';
import { logoUrlsOf, useLogosLoaded, zonesFor, type SceneProps } from './styles/common';

/** One reel, driven entirely by its spec and drawn in its style. Used by the MP4 export and the in-app preview player. */
export const Reel: React.FC<ReelSpec> = (spec) => {
  useLogosLoaded(useMemo(() => logoUrlsOf(spec), [spec]));
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { timed, storyFrames, endFrames, totalFrames, closing } = useMemo(() => reelTiming(spec), [spec]);
  const kit = kitFor(spec.style);
  const captions = spec.captions ?? DEFAULT_CAPTION_STYLE;
  const zones = zonesFor(spec.platform, captions);
  const clampFrame = Math.min(frame, storyFrames - 1);
  const index = Math.max(0, timed.findIndex((b) => clampFrame >= b.start && clampFrame < b.start + b.frames));
  const props: SceneProps = { frame, fps, spec, timed, beat: timed[index]!, index, storyFrames, zones, captions };

  return (
    <AbsoluteFill style={{ background: kit.palette.bg, overflow: 'hidden' }}>
      <kit.Stage {...props} />
      {frame < storyFrames && <kit.Captions {...props} />}
      {/* The voice: one clip per scene, each playing its part of the recording at the scene's speed. */}
      {timed.map((b, i) =>
        b.audio ? (
          <Sequence key={`vo${b.id}${i}`} from={b.audio.from} durationInFrames={Math.max(1, b.audio.frames)}>
            <Audio
              src={b.audio.source === 'track' ? spec.voiceTrack!.url : spec.audioUrls?.[i] || staticFile(`voice/beat_${i}.mp3`)}
              trimBefore={Math.round(b.audio.srcStartSec * fps)}
              playbackRate={b.audio.rate}
              preservePitch
            />
          </Sequence>
        ) : null,
      )}
      {spec.soundDesign !== false && <SoundDesign timed={timed} storyFrames={storyFrames} />}
      {spec.sfx?.map((c, i) => {
        const from = Math.round(c.at * fps);
        if (from >= totalFrames) return null;
        return (
          <Sequence key={`sfx${i}`} from={from} durationInFrames={Math.max(1, Math.min(Math.ceil(c.durationSec * fps), totalFrames - from))}>
            <Audio src={c.url} volume={c.volume} />
          </Sequence>
        );
      })}
      {spec.music && <Music url={spec.music.url} durationSec={spec.music.durationSec} volume={spec.music.volume} totalFrames={totalFrames} />}
      {closing && spec.voiceTrack && (
        <Sequence from={storyFrames} durationInFrames={Math.max(1, endFrames)}>
          <Audio src={spec.voiceTrack.url} trimBefore={Math.round(closing.srcStartSec * fps)} playbackRate={closing.rate} preservePitch />
        </Sequence>
      )}
      <Sequence from={storyFrames}>
        <EndCardWrapper spec={spec} />
      </Sequence>
    </AbsoluteFill>
  );
};

/** The built-in sound design: a whoosh into every scene, and the pops, ticks and thuds of the pieces Claude placed. */
const SoundDesign: React.FC<{ timed: TimedBeat[]; storyFrames: number }> = ({ timed, storyFrames }) => {
  const cues = useMemo(() => {
    const out: { frame: number; kind: SfxKind }[] = [];
    timed.forEach((b, i) => {
      if (i > 0) out.push({ frame: Math.max(0, b.start - 4), kind: 'whoosh' });
      if (b.visual) out.push(...sceneSounds(b.visual, b));
    });
    out.push({ frame: storyFrames - 2, kind: 'whoosh' });
    // Never two of the same sound on one frame.
    const seen = new Set<string>();
    return out.filter((c) => {
      const key = `${c.kind}:${c.frame}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [timed, storyFrames]);
  const urls = sfxUrls();
  return (
    <>
      {cues.map((c, i) => (
        <Sequence key={`sd${i}`} from={c.frame} durationInFrames={c.kind === 'whoosh' ? 15 : 10}>
          <Audio src={urls[c.kind]} volume={SFX_VOLUME[c.kind]} />
        </Sequence>
      ))}
    </>
  );
};

/** Background music under the whole reel: fades in and out, and loops if the track is shorter than the reel. */
const Music: React.FC<{ url: string; durationSec: number; volume: number; totalFrames: number }> = ({ url, durationSec, volume, totalFrames }) => {
  const { fps } = useVideoConfig();
  const musicFrames = Math.max(1, Math.round(durationSec * fps));
  const fade = (f: number) =>
    volume *
    interpolate(f, [0, fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) *
    interpolate(f, [totalFrames - Math.round(1.5 * fps), totalFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <Sequence from={0} durationInFrames={totalFrames}>
      {musicFrames < totalFrames ? (
        <Loop durationInFrames={musicFrames}>
          <Audio src={url} volume={volume} />
        </Loop>
      ) : (
        <Audio src={url} volume={fade} />
      )}
    </Sequence>
  );
};

const EndCardWrapper: React.FC<{ spec: ReelSpec }> = ({ spec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const Kit = kitFor(spec.style);
  return <Kit.EndCard frame={frame} fps={fps} brand={spec.brand} platform={spec.platform} />;
};
