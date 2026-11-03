import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { TIMED, STORY_FRAMES, HAS_VOICE, type CameraKey, type WorldEvent } from './script';
import { World, phonePos, type WorldProps } from './World';
import { Header, InfoCard, Captions, EndCard } from './Ui';
import { Camera, clamp01, easeInOutCubic, lerp } from './iso';

const FX: Exclude<WorldEvent, 'none'>[] = ['rings', 'towerIds', 'pins', 'gpsLog', 'stationGlow', 'errorBand'];
const RAMP = 12;

function resolveKey(k: CameraKey, frame: number, fps: number) {
  const x = k.follow ? phonePos(frame / fps).x + k.x : k.x;
  return { x, y: k.y, z: k.z, zoom: k.zoom };
}

function cameraAt(frame: number, fps: number): Camera {
  const f = Math.min(frame, STORY_FRAMES - 1);
  const i = Math.max(0, TIMED.findIndex((b) => f >= b.start && f < b.start + b.frames));
  const beat = TIMED[i];
  const cur = resolveKey(beat.camera, f, fps);
  const prev = i > 0 ? resolveKey(TIMED[i - 1].camera, f, fps) : cur;
  const t = easeInOutCubic(clamp01((f - beat.start) / 36));
  const drift = 1 + 0.035 * clamp01((f - beat.start) / beat.frames);
  const endPull = frame >= STORY_FRAMES ? 1 - 0.08 * clamp01((frame - STORY_FRAMES) / 60) : 1;
  return {
    target: { x: lerp(prev.x, cur.x, t), y: lerp(prev.y, cur.y, t), z: lerp(prev.z, cur.z, t) },
    zoom: lerp(prev.zoom, cur.zoom, t) * drift * endPull,
    cx: 540,
    cy: 1180,
  };
}

function fxAt(frame: number): WorldProps['fx'] {
  const out = {} as WorldProps['fx'];
  for (const name of FX) {
    let v = 0;
    // merge consecutive beats that share the effect into one range
    let i = 0;
    while (i < TIMED.length) {
      if (!TIMED[i].events.includes(name)) {
        i++;
        continue;
      }
      const s = TIMED[i].start;
      let j = i;
      while (j + 1 < TIMED.length && TIMED[j + 1].events.includes(name)) j++;
      const e = TIMED[j].start + TIMED[j].frames;
      const up = clamp01((frame - s) / RAMP);
      const down = clamp01((e + RAMP - frame) / RAMP);
      v = Math.max(v, Math.min(up, down));
      i = j + 1;
    }
    out[name] = v;
  }
  return out;
}

function pinProgressAt(frame: number, fps: number): number {
  const first = TIMED.find((b) => b.events.includes('pins'));
  if (!first) return 0;
  return clamp01((frame - first.start - 10) / (3.5 * fps));
}

export const Reel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cam = cameraAt(frame, fps);
  const inStory = frame < STORY_FRAMES;
  const beat = TIMED.find((b) => frame >= b.start && frame < b.start + b.frames) ?? TIMED[TIMED.length - 1];
  const chapterStart = TIMED.find((b) => b.chapter === beat.chapter)?.start ?? 0;

  return (
    <AbsoluteFill style={{ background: '#F6F2E9', overflow: 'hidden' }}>
      <World frame={frame} fps={fps} cam={cam} fx={fxAt(frame)} pinProgress={pinProgressAt(frame, fps)} />
      <Header chapter={beat.chapter} frame={frame} fps={fps} chapterStart={chapterStart} />
      {inStory && <InfoCard key={beat.id} card={beat.card} frame={frame} fps={fps} start={beat.start} />}
      {inStory && <Captions beat={beat} frame={frame} />}
      {HAS_VOICE &&
        TIMED.map((b, i) => (
          <Sequence key={`vo${b.id}`} from={b.start + Math.round(0.2 * fps)}>
            <Audio src={staticFile(`voice/beat_${i}.mp3`)} />
          </Sequence>
        ))}
      <Sequence from={STORY_FRAMES}>
        <EndCardWrapper />
      </Sequence>
    </AbsoluteFill>
  );
};

const EndCardWrapper: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <EndCard frame={frame} fps={fps} />;
};
