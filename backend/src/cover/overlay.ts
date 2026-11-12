// The words on the cover: a short hook set very large over the chosen frame, with the key words on a highlighter block,
// a small badge above and the handle. Added to the animation only for the cover picture (the saved animation and the
// video are not changed).

const safeLogo = (u: string | undefined) => (u && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(u) ? u : null);
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const safeColor = (c: string) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#8B5CF6');

/** Dark text on a light accent, white on a dark one. */
function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#0a0b12' : '#ffffff';
}

/**
 * A headline with nothing starred gets its strongest words starred, so every cover has a highlight: the numbers
 * (with a unit that follows, like "10 baje"), or else the longest word.
 */
export function autoStar(text: string): string {
  if (text.includes('*')) return text;
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return text;
  const num = words.findIndex((w) => /\d/.test(w));
  if (num >= 0) {
    const end = num + 1 < words.length && !/[?!.,]$/.test(words[num]!) && words[num + 1]!.length <= 6 ? num + 1 : num;
    return [...words.slice(0, num), `*${words.slice(num, end + 1).join(' ')}*`, ...words.slice(end + 1)].join(' ');
  }
  let best = 0;
  words.forEach((w, i) => {
    if (w.replace(/[^\p{L}\p{N}]/gu, '').length > words[best]!.replace(/[^\p{L}\p{N}]/gu, '').length) best = i;
  });
  return words.map((w, i) => (i === best ? `*${w}*` : w)).join(' ');
}

/** *starred* words sit on a highlighter block in the accent colour. */
function headlineHtml(text: string): string {
  return escapeHtml(autoStar(text)).replace(/\*([^*]+)\*/g, '<span class="mm-cv-hi">$1</span>').replace(/\*/g, '');
}

/** Huge for a short hook, smaller for a long one, so it fits in four lines at most. */
export function coverFontSize(text: string): number {
  const n = text.replace(/\*/g, '').length;
  return n <= 12 ? 190 : n <= 20 ? 160 : n <= 30 ? 132 : n <= 44 ? 108 : n <= 58 ? 90 : 78;
}

export interface CoverTextOptions {
  headline: string;
  handle: string;
  accent: string;
  platform?: 'instagram' | 'youtube';
  /** The creator's logo (a data URL), shown in the handle pill. */
  logo?: string;
  /** The small badge above the headline, e.g. "EXPLAINED IN 60 SEC". Empty = no badge. */
  kicker?: string;
}

export function withCoverText(html: string, o: CoverTextOptions): string {
  // Instagram crops the cover to the middle of the frame on the profile grid, so the words sit in the middle band.
  // YouTube Shorts shows the whole frame but lays its own title and buttons over the bottom, so the words sit high.
  const yt = o.platform === 'youtube';
  const accent = safeColor(o.accent);
  const ink = inkOn(accent);
  const size = coverFontSize(o.headline);
  const kicker = (o.kicker ?? '').trim();
  const logo = safeLogo(o.logo);
  const shade = yt
    ? 'linear-gradient(180deg,rgb(5,6,12) 0%,rgba(5,6,12,.97) 36%,rgba(5,6,12,.8) 46%,rgba(5,6,12,.12) 62%,rgba(5,6,12,0) 78%,rgba(5,6,12,.5) 100%)'
    : 'linear-gradient(180deg,rgba(5,6,12,.5) 0%,rgba(5,6,12,0) 16%,rgba(5,6,12,.1) 30%,rgba(5,6,12,.86) 46%,rgba(5,6,12,.97) 56%,rgb(5,6,12) 70%,rgb(5,6,12) 100%)';
  const block = `<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Plus+Jakarta+Sans:wght@700;800&display=block" rel="stylesheet">
<style>
.mm-cv{position:absolute;left:0;top:0;width:1080px;height:1920px;z-index:2147483600;pointer-events:none;overflow:hidden;font-family:'Bricolage Grotesque','Plus Jakarta Sans',system-ui,sans-serif}
.mm-cv *{box-sizing:border-box}
.mm-cv-shade{position:absolute;inset:0;background:${shade}}
.mm-cv-glow{position:absolute;left:-260px;top:${yt ? -200 : 900}px;width:1100px;height:1100px;background:radial-gradient(closest-side,${accent}59,transparent 70%)}
.mm-cv-glow2{position:absolute;right:-320px;top:${yt ? 420 : 1250}px;width:900px;height:900px;background:radial-gradient(closest-side,${accent}33,transparent 70%)}
.mm-cv-frame{position:absolute;left:26px;top:26px;right:26px;bottom:26px;border:6px solid ${accent};border-radius:54px;box-shadow:0 0 60px ${accent}55,inset 0 0 60px ${accent}22}
.mm-cv-box{position:absolute;left:78px;top:${yt ? 250 : 700}px;width:924px;height:${yt ? 640 : 740}px;display:flex;flex-direction:column;justify-content:${yt ? 'flex-start' : 'flex-end'};align-items:flex-start;gap:38px}
.mm-cv-kick{display:inline-flex;align-items:center;gap:16px;height:76px;padding:0 30px;border-radius:38px;background:${accent};color:${ink};font:800 36px 'Plus Jakarta Sans',system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;box-shadow:0 14px 40px -10px ${accent}aa}
.mm-cv-play{width:0;height:0;border-left:22px solid ${ink};border-top:14px solid transparent;border-bottom:14px solid transparent}
.mm-cv-h{margin:0;color:#fff;font-weight:800;font-size:${size}px;line-height:1.08;letter-spacing:-0.035em;overflow-wrap:break-word;text-shadow:0 8px 0 rgba(0,0,0,.35),0 10px 44px rgba(0,0,0,.75)}
.mm-cv-hi{display:inline-block;padding:0 .14em .04em;margin:0 -.04em;border-radius:.12em;background:${accent};color:${ink};text-shadow:none;transform:rotate(-1.6deg);box-shadow:0 .08em 0 rgba(0,0,0,.35),0 18px 50px -12px ${accent}}
.mm-cv-handle img{width:64px;height:64px;border-radius:50%;object-fit:cover;margin:0 18px 0 -22px;border:3px solid ${accent}}
.mm-cv-handle{position:absolute;left:78px;top:${yt ? 130 : 1500}px;height:84px;padding:0 34px;border-radius:42px;display:flex;align-items:center;background:rgba(10,12,20,.62);border:2px solid rgba(255,255,255,.3);color:#fff;font:700 40px 'Plus Jakarta Sans',system-ui,sans-serif;white-space:nowrap}
</style>
<div class="mm-cv"><div class="mm-cv-shade"></div><div class="mm-cv-glow"></div><div class="mm-cv-glow2"></div><div class="mm-cv-frame"></div>
<div class="mm-cv-box">${kicker ? `<div class="mm-cv-kick"><span class="mm-cv-play"></span>${escapeHtml(kicker)}</div>` : ''}<h1 class="mm-cv-h">${headlineHtml(o.headline)}</h1></div><div class="mm-cv-handle">${logo ? `<img alt="" src="${logo}">` : ''}${escapeHtml(o.handle)}</div></div>`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${block}</body>`) : html + block;
}
