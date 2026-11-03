import { BRAND, type ReelScript } from '@motionmind/shared';
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

/** A project's reel script as the engine renders it: the 'cards' world, branded for the channel. */
export function specFromScript(script: ReelScript, brand: Brand = FALLBACK_BRAND): ReelSpec {
  return { title: script.title, world: 'cards', steps: script.steps, brand, beats: script.beats };
}
