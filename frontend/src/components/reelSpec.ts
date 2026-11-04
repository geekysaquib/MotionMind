import { BRAND, reelWorld, type ReelScript, type ReelVoice } from '@motionmind/shared';
// Types only: the engine itself loads lazily with the preview player.
import type { Brand, ReelSpec } from '@motionmind/reel-engine';

const FALLBACK_BRAND: Brand = { name: BRAND.name, initials: 'MM', handle: '@motionmind', tagline: '' };

/** The user's channel as the reel's brand (header badge, handle and end card). */
export function brandFor(profile: { channelName: string | null; handle: string | null } | null): Brand {
  if (!profile) return FALLBACK_BRAND;
  const name = profile.channelName?.trim() || FALLBACK_BRAND.name;
  const initials =
    name
      .split(/\s+/)
      .map((w) => w[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase() || FALLBACK_BRAND.initials;
  return { name, initials, handle: profile.handle ? `@${profile.handle}` : FALLBACK_BRAND.handle, tagline: '' };
}

/** Every reel is 3D: the world Claude picked, or the train world for train topics and the scene kit otherwise. */
export function worldFor(script: ReelScript): ReelSpec['world'] {
  return reelWorld(script);
}

/** A project's reel script as the engine renders it, branded for the channel. */
export function specFromScript(script: ReelScript, brand: Brand = FALLBACK_BRAND, audio?: { voice: ReelVoice; urls: string[] }): ReelSpec {
  const spec: ReelSpec = { title: script.title, world: worldFor(script), steps: script.steps, brand, beats: script.beats };
  // Voiceover only when it matches the script line for line; otherwise timing would drift.
  if (audio && audio.voice.beats.length === script.beats.length && audio.urls.every(Boolean)) {
    spec.voice = audio.voice.beats;
    spec.audioUrls = audio.urls;
  }
  return spec;
}
