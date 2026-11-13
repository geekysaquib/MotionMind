import { z } from 'zod';
import type { Platform, PlatformPost, ReelScript } from '@motionmind/shared';

// Captions and hashtags for posting the reel, written for ONE platform at a time (Instagram Reels and YouTube Shorts
// want different things): a prompt for claude.ai (with web search, so the hashtags are the ones in use now) and a
// reader for its answer.

const LANG = { en: 'English', hi: 'Hindi (Devanagari)', hinglish: 'Hinglish (Hindi in the Latin alphabet, the way people text)' } as const;

export interface PostBrief {
  script: Pick<ReelScript, 'title' | 'beats'>;
  topic: string | null;
  platform: Platform;
  language: keyof typeof LANG;
  handle: string;
}

/** How many hashtags each platform gets. */
export const HASHTAG_LIMIT: Record<Platform, number> = { instagram: 12, youtube: 5 };

const COVERS = (b: PostBrief) => `4. THREE COVER LINES in ${LANG[b.language]} (put them in "covers"): the few words printed huge on the cover picture, which decide whether someone taps. Each is 3 to 6 words and at most 34 characters, a hook and not a summary: an open question, a surprising number from the reel, or a bold claim the reel proves. Put *stars* around the one or two words that should be highlighted (for example "Tatkal *10 baje* kyun girta hai?"). No hashtags, no emoji, no full stop, nothing the reel does not deliver.`;

const INSTAGRAM = (b: PostBrief) => `# What to write (for Instagram Reels)
1. THREE different captions in ${LANG[b.language]}, each a different angle (a curiosity hook, a surprising fact from the reel, a question to the viewer). Each caption:
   - opens with a first line of at most 90 characters that makes someone stop scrolling (only this line shows before "more");
   - then 2 to 4 short lines that add something the video does not already say word for word, using only facts from the reel above (do not invent numbers);
   - ends with one line asking for a follow, a save or a share (follow ${b.handle});
   - reads like a person wrote it: no "In this video", no hashtags inside the caption, at most 2 emoji, line breaks between lines.
2. HASHTAGS for Instagram: 8 to 12, strongest first. Instagram itself advises 3 to 5 focused hashtags, so the FIRST FIVE must be the best ones and work on their own: 2 specific to this topic, 2 for the niche (explainers, tech or knowledge in India) and 1 broad. If you can search the web, search now for the hashtags Indian creators are using this month for this topic on Instagram Reels and prefer those; if you cannot search, use ones you know are widely used. Only real, commonly used hashtags: no invented or very long ones, no spaces, no banned or spammy tags (like #followforfollow, #reelsinstagram spam lists).
3. Leave "title" as an empty string (Instagram has no title).
${COVERS(b)}`;

const YOUTUBE = (b: PostBrief) => `# What to write (for YouTube Shorts)
1. A TITLE in ${LANG[b.language]}: at most 60 characters so it is not cut off, the main search keyword in the first 4 words, a reason to watch, no clickbait the video does not deliver, no hashtags in it.
2. THREE different descriptions in ${LANG[b.language]} (put them in "captions"), each 2 to 4 short lines: the first line repeats the main keyword in a natural sentence (YouTube search reads it), then what the viewer will learn, using only facts from the reel above, then one line asking to subscribe to ${b.handle}. No "In this video", at most 1 emoji, line breaks between lines.
3. HASHTAGS for YouTube: exactly 3 to 5. The first must be #Shorts. The rest are the main topic keywords people search for (YouTube shows the first three above the title, and ignores all of them if there are too many). If you can search the web, check which hashtags current YouTube Shorts on this topic in India use, and prefer those. No spaces, no invented tags.
${COVERS(b)}`;

export function postPrompt(b: PostBrief): string {
  const yt = b.platform === 'youtube';
  return `You write ${yt ? 'titles, descriptions' : 'captions'} and pick hashtags for short explainer videos made for an Indian audience. Write the post for the reel below, which goes on ${yt ? 'YouTube Shorts' : 'Instagram Reels'} from the account ${b.handle}.

# The reel
Title: ${b.script.title}
Topic: ${b.topic ?? b.script.title}
What the voice says, scene by scene:
${b.script.beats.map((x, i) => `${i + 1}. ${x.narration}`).join('\n')}

${yt ? YOUTUBE(b) : INSTAGRAM(b)}

# Answer format
Answer with ONLY this JSON, in one code block, nothing else:
{"title": "...", "captions": ["...", "...", "..."], "hashtags": ["#...", "#..."], "covers": ["...", "...", "..."]}
Use \\n for line breaks inside a caption.`;
}

export class PostError extends Error {}

const schema = z.object({
  captions: z.array(z.string().trim().min(1).max(2200)).min(1).max(6),
  hashtags: z.array(z.string().trim().min(1).max(80)).min(1).max(60),
  title: z.string().trim().max(200).optional(),
  covers: z.array(z.string().trim().max(200)).max(8).optional(),
});

/** Reads Claude's answer for one platform: the JSON object, with or without a code fence or words around it. */
export function parsePost(text: string, platform: Platform, now = new Date()): PlatformPost {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  let raw: unknown;
  try {
    raw = JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text);
  } catch {
    throw new PostError("That doesn't look like the captions and hashtags. Paste Claude's whole answer, from { to }.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new PostError('The answer is missing the captions or the hashtags. Ask Claude to answer in the JSON format from the prompt.');
  const seen = new Set<string>();
  const hashtags: string[] = [];
  const add = (h: string) => {
    // One tag each, no spaces or punctuation, always with its #.
    const tag = `#${h.replace(/^#+/, '').replace(/[^\p{L}\p{N}\p{M}_]/gu, '')}`;
    const key = tag.toLowerCase();
    if (tag.length < 3 || tag.length > 50 || seen.has(key)) return;
    seen.add(key);
    hashtags.push(tag);
  };
  // A Short is found as one through #Shorts, so it is always there, first.
  if (platform === 'youtube') add('#Shorts');
  parsed.data.hashtags.forEach(add);
  if (!hashtags.length) throw new PostError('None of the hashtags could be used. Ask Claude for them again.');
  const title = platform === 'youtube' ? parsed.data.title?.replace(/#\S+/g, '').trim().slice(0, 100) : '';
  if (platform === 'youtube' && !title) throw new PostError('The answer has no title for YouTube Shorts. Copy the prompt with YouTube Shorts selected and ask Claude again.');
  const covers = (parsed.data.covers ?? []).map((c) => c.replace(/[#\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 70)).filter(Boolean).slice(0, 4);
  return { captions: parsed.data.captions, hashtags: hashtags.slice(0, HASHTAG_LIMIT[platform]), ...(title ? { title } : {}), ...(covers.length ? { covers } : {}), createdAt: now.toISOString() };
}
