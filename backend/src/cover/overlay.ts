// The words on the cover: the reel's title set large over the chosen frame, with the handle. Added to the animation
// only for the cover picture (the saved animation and the video are not changed).

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const safeColor = (c: string) => (/^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#8B5CF6');

/** *starred* words take the accent colour. */
function headlineHtml(text: string): string {
  return escapeHtml(text).replace(/\*([^*]+)\*/g, '<span class="mm-cv-hi">$1</span>').replace(/\*/g, '');
}

/** Big for a short title, smaller for a long one, so it always fits in four lines at most. */
export function coverFontSize(text: string): number {
  const n = text.replace(/\*/g, '').length;
  return n <= 14 ? 150 : n <= 24 ? 128 : n <= 38 ? 108 : n <= 54 ? 92 : 78;
}

export function withCoverText(html: string, o: { headline: string; handle: string; accent: string; platform?: 'instagram' | 'youtube' }): string {
  // Instagram crops the cover to the middle of the frame on the profile grid, so the words sit in the middle band.
  // YouTube Shorts shows the whole frame but lays its own title and buttons over the bottom, so the words sit high.
  const yt = o.platform === 'youtube';
  const accent = safeColor(o.accent);
  const size = coverFontSize(o.headline);
  // The headline sits in the middle band (y 760 to 1420), which survives the square and 4:5 crops of the profile grid.
  const block = `<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@800&family=Plus+Jakarta+Sans:wght@700&display=block" rel="stylesheet">
<style>
.mm-cv{position:absolute;left:0;top:0;width:1080px;height:1920px;z-index:2147483600;pointer-events:none;font-family:'Bricolage Grotesque','Plus Jakarta Sans',system-ui,sans-serif}
.mm-cv-shade{position:absolute;inset:0;background:${yt ? 'linear-gradient(180deg,rgb(5,6,12) 0%,rgb(5,6,12) 34%,rgba(5,6,12,.92) 44%,rgba(5,6,12,.25) 62%,rgba(5,6,12,.1) 80%,rgba(5,6,12,.45) 100%)' : 'linear-gradient(180deg,rgba(5,6,12,.35) 0%,rgba(5,6,12,.15) 28%,rgba(5,6,12,.9) 52%,rgba(5,6,12,.985) 62%,rgb(5,6,12) 70%,rgb(5,6,12) 100%)'}}
.mm-cv-box{position:absolute;left:70px;top:${yt ? 300 : 760}px;width:940px;height:${yt ? 560 : 660}px;display:flex;flex-direction:column;justify-content:${yt ? 'flex-start' : 'flex-end'};gap:34px}
.mm-cv-bar{width:150px;height:14px;border-radius:7px;background:${accent}}
.mm-cv-h{margin:0;color:#fff;font-weight:800;font-size:${size}px;line-height:1.04;letter-spacing:-0.03em;overflow-wrap:break-word;text-shadow:0 6px 30px rgba(0,0,0,.6)}
.mm-cv-hi{color:${accent}}
.mm-cv-handle{position:absolute;left:70px;top:${yt ? 170 : 1470}px;height:84px;padding:0 34px;border-radius:42px;display:flex;align-items:center;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.28);color:#fff;font:700 40px 'Plus Jakarta Sans',system-ui,sans-serif;white-space:nowrap}
</style>
<div class="mm-cv"><div class="mm-cv-shade"></div><div class="mm-cv-box"><div class="mm-cv-bar"></div><h1 class="mm-cv-h">${headlineHtml(o.headline)}</h1></div><div class="mm-cv-handle">${escapeHtml(o.handle)}</div></div>`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${block}</body>`) : html + block;
}
