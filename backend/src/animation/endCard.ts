import { reelTimeline, styleOf, type Platform, type Profile, type Project } from '@motionmind/shared';

// The end card is the same on every reel, so Motion Mind draws it itself instead of asking Claude to improvise one:
// a quiet "Follow" (or "Subscribe") over the handle, with the creator's logo when there is one. It is added to
// Claude's animation whenever the animation is played, exported or checked (the saved file stays exactly as Claude wrote it).

/** Claude is asked to put this comment in the file when it has left the end card to Motion Mind. */
export const NO_END_CARD_MARKER = 'motionmind:no-end-card';

export const hasEndCardMarker = (html: string) => html.includes(NO_END_CARD_MARKER);

export interface EndCardOptions {
  storyEnd: number;
  duration: number;
  handle: string;
  platforms: Platform[];
  language: 'en' | 'hi' | 'hinglish';
  /** The style's accent colour. */
  accent: string;
  /** The creator's logo as a data URL (PNG, JPEG or WebP). Shown as a round avatar above the handle. */
  logo?: string;
}

/** The small word over the handle. Plain on purpose: it is a nudge, not a banner. */
function label(language: EndCardOptions['language'], platforms: Platform[]): string {
  const ig = platforms.includes('instagram');
  const yt = platforms.includes('youtube');
  if (language === 'hi') return ig && yt ? 'फ़ॉलो और सब्सक्राइब करें' : yt ? 'सब्सक्राइब करें' : 'फ़ॉलो करें';
  return ig && yt ? 'Follow & subscribe' : yt ? 'Subscribe' : 'Follow';
}

/** Only an image data URL is ever put into the page. */
export const safeLogo = (u: string | undefined) => (u && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(u) ? u : null);
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const safeColor = (c: string) => (/^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#8B5CF6');
const r1 = (n: number) => Math.round(n * 100) / 100;

/** The end-card section and the script that adds its animation to Claude's timeline. */
export function endCardParts(o: EndCardOptions): { section: string; script: string; head: string } {
  const E = r1(o.storyEnd);
  const D = r1(Math.max(1, o.duration - o.storyEnd));
  const accent = safeColor(o.accent);
  const logo = safeLogo(o.logo);
  const handle = escapeHtml(o.handle);
  // The handle is one line, 900 px wide at most: smaller type for a long handle.
  const size = Math.max(54, Math.min(112, Math.floor(900 / Math.max(6, o.handle.length * 0.6))));

  const head = '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@800&family=Plus+Jakarta+Sans:wght@500;700&display=block" rel="stylesheet">'
    + `<style>
.mm-end{position:absolute;left:0;top:0;width:1080px;height:1920px;overflow:hidden;background:#07080f;font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#fff}
.mm-end *{box-sizing:border-box;margin:0}
.mm-glow{position:absolute;left:-200px;top:520px;width:1480px;height:1000px;background:radial-gradient(closest-side,${accent}30,transparent 72%);opacity:0}
.mm-col{position:absolute;left:90px;top:560px;width:900px;height:800px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px}
.mm-logo{width:200px;height:200px;border-radius:50%;overflow:hidden;background:#12141f;border:4px solid rgba(255,255,255,.22);box-shadow:0 24px 60px -24px rgba(0,0,0,.8);margin-bottom:22px;opacity:0}
.mm-logo img{display:block;width:100%;height:100%;object-fit:cover}
.mm-label{height:60px;line-height:60px;white-space:nowrap;font-weight:500;font-size:44px;letter-spacing:.26em;text-transform:uppercase;color:rgba(255,255,255,.55);opacity:0}
.mm-handle{height:140px;line-height:140px;width:900px;text-align:center;white-space:nowrap;font-family:'Bricolage Grotesque','Plus Jakarta Sans',system-ui,sans-serif;font-weight:800;font-size:${size}px;letter-spacing:-0.02em;color:#fff;opacity:0}
.mm-line{width:96px;height:5px;border-radius:3px;background:${accent};opacity:0;transform-origin:50% 50%}
</style>`;

  const section = `<section class="clip mm-end" data-start="${E}" data-duration="${D}" data-track-index="9" style="position:absolute;left:0;top:0;width:1080px;height:1920px;z-index:2147483000">
<div class="mm-glow"></div>
<div class="mm-col">${logo ? `<div class="mm-logo"><img alt="" src="${logo}"></div>` : ''}<div class="mm-label">${escapeHtml(label(o.language, o.platforms))}</div><div class="mm-handle">${handle}</div><div class="mm-line"></div></div>
</section>`;

  const script = `<script>(function(){
var main=window.__timelines&&window.__timelines["main"];if(!main||!window.gsap)return;
var E=${E},q=gsap.utils.selector(document.querySelector(".mm-end"));
var tl=gsap.timeline({paused:false});
tl.fromTo(q(".mm-glow"),{opacity:0},{opacity:1,duration:1,ease:"power1.out"},0);
tl.fromTo(q(".mm-logo"),{opacity:0,y:18},{opacity:1,y:0,duration:.6,ease:"power2.out"},0.2);
tl.fromTo(q(".mm-label"),{opacity:0,y:14},{opacity:1,y:0,duration:.55,ease:"power2.out"},0.45);
tl.fromTo(q(".mm-handle"),{opacity:0,y:20},{opacity:1,y:0,duration:.6,ease:"power2.out"},0.65);
tl.fromTo(q(".mm-line"),{opacity:0,scaleX:0},{opacity:1,scaleX:1,duration:.5,ease:"power2.out"},1.0);
main.add(tl,E);
})();</script>`;
  return { section, script, head };
}

/** Claude's animation with the end card added (when Claude left it to us). The saved file is not changed. */
export function withEndCard(html: string, o: EndCardOptions): string {
  if (!hasEndCardMarker(html)) return html;
  const { section, script, head } = endCardParts(o);
  let out = html;
  out = /<\/head>/i.test(out) ? out.replace(/<\/head>/i, `${head}</head>`) : out.replace(/<body[^>]*>/i, (m) => `${head}${m}`);
  const root = /<div\b[^>]*\bdata-composition-id\s*=\s*["']main["'][^>]*>/i;
  if (!root.test(out)) return html;
  out = out.replace(root, (m) => `${m}\n${section}`);
  out = /<\/body>/i.test(out) ? out.replace(/<\/body>/i, `${script}</body>`) : out + script;
  return out;
}

/** The animation of a project as it is played, exported and checked: Claude's file plus Motion Mind's end card. */
export function finishedAnimation(project: Project, profile: Pick<Profile, 'handle' | 'language'> | null, logo?: string): string {
  const script = project.script!;
  const html = script.animation!.html;
  const t = reelTimeline(script, project.editor);
  return withEndCard(html, {
    storyEnd: t.storyEnd,
    duration: t.duration,
    handle: profile?.handle ? `@${profile.handle}` : '@motionmind',
    platforms: project.platforms.length ? project.platforms : ['instagram'],
    language: profile?.language ?? 'hinglish',
    accent: styleOf(script.style).swatch[1],
    logo,
  });
}
