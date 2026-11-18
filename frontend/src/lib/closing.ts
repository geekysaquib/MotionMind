import { normalizePlatforms, type Platform } from '@motionmind/shared';

/** Who the viewer is told to follow: the channel name, else the handle, else the studio name. */
export function followName(profile: { channelName: string | null; handle: string | null } | null | undefined, fallback: string): string {
  return profile?.channelName?.trim() || (profile?.handle ? `@${profile.handle}` : '') || fallback;
}

/** The last thing the voice says: a follow message with the brand or handle, in the language of the script. */
export function closingLine(language: 'en' | 'hi' | 'hinglish', name: string, platforms: Platform[] = ['instagram']): string {
  const list = normalizePlatforms(platforms);
  const both = list.length > 1;
  const youtube = list[0] === 'youtube';
  if (language === 'en') return both ? `Follow ${name} on Instagram and subscribe on YouTube for more explainers like this.` : youtube ? `Subscribe to ${name} for more explainers like this.` : `Follow ${name} for more explainers like this.`;
  if (language === 'hi') return both ? `ऐसे और वीडियो के लिए ${name} को इंस्टाग्राम पर फ़ॉलो करें और यूट्यूब पर सब्सक्राइब करें।` : youtube ? `ऐसे और वीडियो के लिए ${name} को सब्सक्राइब करें।` : `ऐसे और वीडियो के लिए ${name} को फ़ॉलो करें।`;
  return both ? `Aise aur videos ke liye ${name} ko Instagram par follow karo aur YouTube par subscribe karo.` : youtube ? `Aise aur videos ke liye ${name} ko subscribe karo.` : `Aise aur videos ke liye ${name} ko follow karo.`;
}
