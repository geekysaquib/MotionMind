import { z } from 'zod';
import type { Platform, ReelPost, ReelScript } from '@motionmind/shared';

// Captions and hashtags for posting the reel: a prompt for claude.ai (with web search, so the hashtags are the ones in
// use now) and a reader for its answer.

const LANG = { en: 'English', hi: 'Hindi (Devanagari)', hinglish: 'Hinglish (Hindi in the Latin alphabet, the way people text)' } as const;

export interface PostBrief {
  script: Pick<ReelScript, 'title' | 'beats'>;
  topic: string | null;
  platforms: Platform[];
  language: keyof typeof LANG;
  handle: string;
}

export function postPrompt(b: PostBrief): string {
  const ig = b.platforms.includes('instagram');
  const yt = b.platforms.includes('youtube');
  const where = ig && yt ? 'Instagram Reels and YouTube Shorts' : yt ? 'YouTube Shorts' : 'Instagram Reels';
  return `You write captions and pick hashtags for short explainer videos made for an Indian audience. Write the post for the reel below, which goes on ${where} from the account ${b.handle}.

# The reel
Title: ${b.script.title}
Topic: ${b.topic ?? b.script.title}
What the voice says, scene by scene:
${b.script.beats.map((x, i) => `${i + 1}. ${x.narration}`).join('\n')}

# What to write
1. THREE different captions in ${LANG[b.language]}, each a different angle (a curiosity hook, a surprising fact from the reel, a question to the viewer). Each caption:
   - opens with a first line of at most 90 characters that makes someone stop scrolling (this line shows before "more");
   - then 2 to 4 short lines that add something the video does not already say word for word, using only facts from the reel above (do not invent numbers);
   - ends with one line asking for a follow, a save or a comment (${yt && !ig ? 'subscribe' : 'follow'} ${b.handle});
   - reads like a person wrote it: no "In this video", no hashtags inside the caption, at most 2 emoji, line breaks between lines.
2. HASHTAGS: 20 to 25, most relevant first, as a mix of about 5 broad ones with a big audience, about 10 specific to this topic, and about 5 for the niche (explainers, tech or knowledge in India). If you can search the web, search now for the hashtags people are using this month for this topic on ${ig ? 'Instagram' : 'YouTube Shorts'} in India and prefer those; if you cannot search, use the ones you know are widely used. Only real, commonly used hashtags: no invented or overly long ones, no spaces, no banned or spammy tags (like #followforfollow).
3. ${yt ? 'A TITLE for YouTube Shorts: at most 60 characters, the main keyword early, no clickbait that the video does not deliver.' : 'No title is needed (leave "title" as an empty string).'}

# Answer format
Answer with ONLY this JSON, in one code block, nothing else:
{"captions": ["...", "...", "..."], "hashtags": ["#...", "#..."], "title": "..."}
Use \\n for line breaks inside a caption.`;
}

export class PostError extends Error {}

const schema = z.object({
  captions: z.array(z.string().trim().min(1).max(2200)).min(1).max(6),
  hashtags: z.array(z.string().trim().min(1).max(80)).min(1).max(60),
  title: z.string().trim().max(100).optional(),
});

/** Reads Claude's answer: the JSON object, with or without a code fence or words around it. */
export function parsePost(text: string, now = new Date()): ReelPost {
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
  for (const h of parsed.data.hashtags) {
    // One tag each, no spaces or punctuation, always with its #.
    const tag = `#${h.replace(/^#+/, '').replace(/[^\p{L}\p{N}\p{M}_]/gu, '')}`;
    const key = tag.toLowerCase();
    if (tag.length < 3 || tag.length > 50 || seen.has(key)) continue;
    seen.add(key);
    hashtags.push(tag);
  }
  if (!hashtags.length) throw new PostError('None of the hashtags could be used. Ask Claude for them again.');
  const title = parsed.data.title?.slice(0, 100);
  return { captions: parsed.data.captions, hashtags: hashtags.slice(0, 30), ...(title ? { title } : {}), createdAt: now.toISOString() };
}
