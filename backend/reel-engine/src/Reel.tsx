import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, Loop, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { DEFAULT_CAPTION_STYLE, reelTiming, type Brand, type CameraKey, type ReelSpec, type TimedBeat, type TrainShot, type WorldEvent } from './script';
import { World, phonePos, type WorldProps } from './World';
import { Backdrop } from './Backdrop';
import { CardsScene } from './CardsScene';
import { IsoWorld, isoCamera, layoutProps } from './IsoWorld';
import { withScenes } from './autoScene';
import { Header, InfoCard, Captions, EndCard } from './Ui';
import { Camera, clamp01, easeInOutCubic, lerp } from './iso';

const FX: Exclude<WorldEvent, 'none'>[] = ['rings', 'towerIds', 'pins', 'gpsLog', 'stationGlow', 'errorBand'];
const RAMP = 12;
const STILL: CameraKey = { follow: true, x: 0, y: 0, z: 1, zoom: 40 };

/** Named train-world shots (taken from the sample reel) for scripts that don't give raw coordinates. */
const TRAIN_SHOT_KEYS: Record<TrainShot, CameraKey> = {
  phone: { follow: true, x: 0, y: 0, z: 1, zoom: 56 },
  tower: { follow: true, x: -1, y: -1.5, z: 2, zoom: 32 },
  map: { x: 30, y: 0, z: 0, zoom: 17 },
  crowd: { x: 34, y: 0, z: 1, zoom: 24 },
  station: { x: 45, y: 1, z: 1, zoom: 30 },
  accuracy: { x: 28, y: 0, z: 0, zoom: 20 },
  wide: { x: 30, y: 0, z: 0, zoom: 14 },
};
const keyOf = (b: TimedBeat): CameraKey => b.camera ?? (b.shot ? TRAIN_SHOT_KEYS[b.shot] : STILL);

function resolveKey(k: CameraKey, frame: number, fps: number) {
  const x = k.follow ? phonePos(frame / fps).x + k.x : k.x;
  return { x, y: k.y, z: k.z, zoom: k.zoom };
}

function cameraAt(timed: TimedBeat[], storyFrames: number, frame: number, fps: number): Camera {
  const f = Math.min(frame, storyFrames - 1);
  const i = Math.max(0, timed.findIndex((b) => f >= b.start && f < b.start + b.frames));
  const beat = timed[i]!;
  const cur = resolveKey(keyOf(beat), f, fps);
  const prev = i > 0 ? resolveKey(keyOf(timed[i - 1]!), f, fps) : cur;
  const t = easeInOutCubic(clamp01((f - beat.start) / 36));
  const drift = 1 + 0.035 * clamp01((f - beat.start) / beat.frames);
  const endPull = frame >= storyFrames ? 1 - 0.08 * clamp01((frame - storyFrames) / 60) : 1;
  return {
    target: { x: lerp(prev.x, cur.x, t), y: lerp(prev.y, cur.y, t), z: lerp(prev.z, cur.z, t) },
    zoom: lerp(prev.zoom, cur.zoom, t) * drift * endPull,
    cx: 540,
    cy: 1180,
  };
}

function fxAt(timed: TimedBeat[], frame: number): WorldProps['fx'] {
  const out = {} as WorldProps['fx'];
  const has = (b: TimedBeat, name: WorldEvent) => b.events?.includes(name) ?? false;
  for (const name of FX) {
    let v = 0;
    // merge consecutive beats that share the effect into one range
    let i = 0;
    while (i < timed.length) {
      if (!has(timed[i]!, name)) {
        i++;
        continue;
      }
      const s = timed[i]!.start;
      let j = i;
      while (j + 1 < timed.length && has(timed[j + 1]!, name)) j++;
      const e = timed[j]!.start + timed[j]!.frames;
      const up = clamp01((frame - s) / RAMP);
      const down = clamp01((e + RAMP - frame) / RAMP);
      v = Math.max(v, Math.min(up, down));
      i = j + 1;
    }
    out[name] = v;
  }
  return out;
}

function pinProgressAt(timed: TimedBeat[], frame: number, fps: number): number {
  const first = timed.find((b) => b.events?.includes('pins'));
  if (!first) return 0;
  return clamp01((frame - first.start - 10) / (3.5 * fps));
}

/** One reel, driven entirely by its spec. Used by the CLI renderer and by the in-app preview player. */
export const Reel: React.FC<ReelSpec> = (input) => {
  // Every beat gets a 3D scene (or train shot), even when the script didn't describe one.
  const spec = useMemo(() => withScenes(input), [input]);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { timed, storyFrames, endFrames, totalFrames, closing } = useMemo(() => reelTiming(spec), [spec]);
  const placed = useMemo(() => layoutProps(timed, spec.layout), [timed, spec.layout]);
  const inStory = frame < storyFrames;
  const beat = timed.find((b) => frame >= b.start && frame < b.start + b.frames) ?? timed[timed.length - 1]!;
  const chapterStart = timed.find((b) => b.chapter === beat.chapter)?.start ?? 0;
  const progress = storyFrames ? Math.min(1, frame / storyFrames) : 0;

  return (
    <AbsoluteFill style={{ background: '#F6F2E9', overflow: 'hidden' }}>
      {spec.world === 'train' ? (
        <World frame={frame} fps={fps} cam={cameraAt(timed, storyFrames, frame, fps)} fx={fxAt(timed, frame)} pinProgress={pinProgressAt(timed, frame, fps)} />
      ) : spec.world === 'iso' ? (
        <IsoWorld frame={frame} fps={fps} cam={isoCamera(timed, placed, storyFrames, frame)} beat={beat} placed={placed} theme={spec.theme} />
      ) : (
        <Backdrop frame={frame} fps={fps} tone={beat.card.tone} chapter={beat.chapter} progress={progress} />
      )}
      <Header chapter={beat.chapter} frame={frame} fps={fps} chapterStart={chapterStart} steps={spec.steps} brand={spec.brand} dark={spec.world === 'iso' && spec.theme === 'night'} />
      {inStory && spec.world === 'cards' && <CardsScene key={`scene-${beat.id}`} beat={beat} frame={frame} fps={fps} />}
      {inStory && <InfoCard key={beat.id} card={beat.card} frame={frame} fps={fps} start={beat.start} compact={spec.world === 'cards'} />}
      {inStory && <Captions beat={beat} frame={frame} style={spec.captions ?? DEFAULT_CAPTION_STYLE} />}
      {/* The voice: one clip per scene, each playing its part of the recording at the scene's speed. */}
      {timed.map((b, i) =>
        b.audio ? (
          <Sequence key={`vo${b.id}`} from={b.audio.from} durationInFrames={Math.max(1, b.audio.frames)}>
            <Audio
              src={b.audio.source === 'track' ? spec.voiceTrack!.url : spec.audioUrls?.[i] || staticFile(`voice/beat_${i}.mp3`)}
              trimBefore={Math.round(b.audio.srcStartSec * fps)}
              playbackRate={b.audio.rate}
              preservePitch
            />
          </Sequence>
        ) : null,
      )}
      {spec.music && <Music url={spec.music.url} durationSec={spec.music.durationSec} volume={spec.music.volume} totalFrames={totalFrames} />}
      {closing && spec.voiceTrack && (
        <Sequence from={storyFrames} durationInFrames={Math.max(1, endFrames)}>
          <Audio src={spec.voiceTrack.url} trimBefore={Math.round(closing.srcStartSec * fps)} playbackRate={closing.rate} preservePitch />
        </Sequence>
      )}
      <Sequence from={storyFrames}>
        <EndCardWrapper brand={spec.brand} />
      </Sequence>
    </AbsoluteFill>
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
        // Looping restarts the frame count, so a looped track keeps a steady volume.
        <Loop durationInFrames={musicFrames}>
          <Audio src={url} volume={volume} />
        </Loop>
      ) : (
        <Audio src={url} volume={fade} />
      )}
    </Sequence>
  );
};

const EndCardWrapper: React.FC<{ brand: Brand }> = ({ brand }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <EndCard frame={frame} fps={fps} brand={brand} />;
};
