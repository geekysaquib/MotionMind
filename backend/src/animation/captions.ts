import type { ReelTimeline } from '@motionmind/shared';

// Captions are the same job on every reel and must be exact, so Motion Mind draws them itself (Saquib, 2026-11-18:
// Claude's captions had uneven or missing spaces and drifted). Like the end card, they are added to Claude's
// animation whenever it is played, exported or checked; the saved file stays as Claude wrote it. Claude is told to
// leave the caption band empty and to mark the file, so older animations with their own captions are left alone.

export const NO_CAPTIONS_MARKER = 'motionmind:no-captions';
export const hasNoCaptionsMarker = (html: string) => html.includes(NO_CAPTIONS_MARKER);

/** The band captions sit in. Claude keeps it free of text. */
export const CAPTION_BAND = { top: 1390, height: 230 } as const;

export interface CaptionWord {
  w: string;
  start: number;
  end: number;
  key: boolean;
}

export interface CaptionChunk {
  words: CaptionWord[];
  start: number;
  end: number;
  /** Font size that keeps the chunk on one line, 940 px wide at most. */
  size: number;
}

const MAX_CHARS = 26;
const MAX_WORDS = 5;

const clean = (w: string) => w.replace(/[“”"*_]/g, '');
const endsSentence = (w: string) => /[.?!।…]$/.test(w);

const lineChars = (ws: CaptionWord[]) => ws.reduce((n, x) => n + x.w.length, 0) + Math.max(0, ws.length - 1);

/**
 * Short chunks that read in one glance. A sentence (or the end of a scene) always closes a chunk; a sentence too long
 * for one line is split into even parts, so there is never a lonely last word.
 */
export function captionChunks(t: ReelTimeline, keywords: string[][] = []): CaptionChunk[] {
  const chunks: CaptionChunk[] = [];
  const push = (ws: CaptionWord[]) => ws.length && chunks.push({ words: ws, start: ws[0]!.start, end: ws[ws.length - 1]!.end, size: 0 });
  for (const scene of t.scenes) {
    const keys = new Set((keywords[scene.index] ?? []).flatMap((k) => k.toLowerCase().split(/\s+/)).map((k) => k.replace(/[^\p{L}\p{N}]/gu, '')));
    let sentence: CaptionWord[] = [];
    const flush = () => {
      const n = Math.max(1, Math.ceil(lineChars(sentence) / MAX_CHARS), Math.ceil(sentence.length / MAX_WORDS));
      const per = Math.ceil(sentence.length / n);
      for (let i = 0; i < sentence.length; i += per) push(sentence.slice(i, i + per));
      sentence = [];
    };
    for (const w of scene.words) {
      const text = clean(w.w);
      if (!text) continue;
      sentence.push({ w: text, start: w.start, end: w.end, key: keys.has(text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')) });
      if (endsSentence(text)) flush();
    }
    flush();
  }
  // Each chunk stays up until the next one starts (or a short beat after its last word), never past the story.
  return chunks.map((c, i) => {
    const next = chunks[i + 1];
    const end = Math.min(t.storyEnd, next && next.start - c.end < 0.6 ? next.start : c.end + 0.35);
    const chars = c.words.reduce((n, x) => n + x.w.length, 0) + c.words.length - 1;
    return { ...c, end: Math.max(end, c.start + 0.2), size: Math.max(44, Math.min(68, Math.floor(940 / Math.max(10, chars * 0.58)))) };
  });
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const safeColor = (c: string) => (/^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#8B5CF6');
const r2 = (n: number) => Math.round(n * 100) / 100;

/** The caption layer and the script that adds its timing to Claude's timeline. */
export function captionParts(chunks: CaptionChunk[], accent: string, storyEnd: number): { head: string; section: string; script: string } {
  const a = safeColor(accent);
  const head = '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@800&family=Noto+Sans+Devanagari:wght@700&display=block" rel="stylesheet">'
    + `<style>
.mm-cap{position:absolute;left:0;top:0;width:1080px;height:1920px;pointer-events:none}
.mm-chunk{position:absolute;left:70px;top:${CAPTION_BAND.top}px;width:940px;height:${CAPTION_BAND.height}px;display:flex;align-items:center;justify-content:center;opacity:0}
.mm-line{display:inline-block;max-width:940px;padding:14px 28px;border-radius:22px;background:rgba(6,8,14,.72);box-shadow:0 18px 40px -18px rgba(0,0,0,.7);white-space:nowrap;font-family:'Plus Jakarta Sans','Noto Sans Devanagari',system-ui,sans-serif;font-weight:800;line-height:1.25;letter-spacing:0;word-spacing:0;font-kerning:normal;text-rendering:geometricPrecision;-webkit-font-smoothing:antialiased;color:rgba(255,255,255,.42)}
.mm-w{display:inline}
</style>`;
  // Words are separated by real spaces in normal text flow, so the browser spaces them evenly.
  const section = `<section class="clip mm-cap" data-start="0" data-duration="${r2(storyEnd)}" data-track-index="8" style="z-index:2147482000">${chunks
    .map((c, i) => `<div class="mm-chunk" id="mmc${i}"><span class="mm-line" style="font-size:${c.size}px">${c.words.map((w, j) => `<span class="mm-w${w.key ? ' k' : ''}" id="mmw${i}_${j}">${escapeHtml(w.w)}</span>`).join(' ')}</span></div>`)
    .join('')}</section>`;
  const timing = chunks.map((c) => [r2(c.start), r2(c.end), c.words.map((w) => [r2(w.start), w.key ? 1 : 0])]);
  const script = `<script>(function(){
var main=window.__timelines&&window.__timelines["main"];if(!main||!window.gsap)return;
var C=${JSON.stringify(timing)},A="${a}";
C.forEach(function(c,i){var el=document.getElementById("mmc"+i);if(!el)return;
main.set(el,{opacity:1},c[0]);main.set(el,{opacity:0},c[1]);
c[2].forEach(function(s,j){var w=document.getElementById("mmw"+i+"_"+j);if(w){main.set(w,{color:s[1]?A:"#ffffff"},s[0]);}});});
})();</script>`;
  return { head, section, script };
}

/** Claude's animation with Motion Mind's captions (only when Claude left them to us). */
export function withCaptions(html: string, t: ReelTimeline, keywords: string[][], accent: string): string {
  if (!hasNoCaptionsMarker(html)) return html;
  const root = /<div\b[^>]*\bdata-composition-id\s*=\s*["']main["'][^>]*>/i;
  if (!root.test(html)) return html;
  const { head, section, script } = captionParts(captionChunks(t, keywords), accent, t.storyEnd);
  let out = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${head}</head>`) : html.replace(/<body[^>]*>/i, (m) => `${head}${m}`);
  out = out.replace(root, (m) => `${m}\n${section}`);
  return /<\/body>/i.test(out) ? out.replace(/<\/body>/i, `${script}</body>`) : out + script;
}
