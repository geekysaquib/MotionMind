import { reelTimeline, styleOf, type Platform, type Profile, type Project } from '@motionmind/shared';

// The end card is the same on every reel, so Motion Mind draws it itself instead of asking Claude to improvise one:
// the handle, one line inviting people to follow, and the follow or subscribe buttons with a "tap". It is added to
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

/** The one line under the handle, in the reel's language. */
function invite(language: EndCardOptions['language'], platforms: Platform[]): string {
  const yt = platforms.length === 1 && platforms[0] === 'youtube';
  if (language === 'en') return yt ? 'Subscribe for more explainers like this' : 'Follow for more explainers like this';
  if (language === 'hi') return yt ? 'ऐसे और वीडियो के लिए सब्सक्राइब करें' : 'ऐसे और वीडियो के लिए फ़ॉलो करें';
  return yt ? 'Aise aur explainers ke liye subscribe karo' : 'Aise aur explainers ke liye follow karo';
}

/** Only an image data URL is ever put into the page. */
export const safeLogo = (u: string | undefined) => (u && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(u) ? u : null);
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const safeColor = (c: string) => (/^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#8B5CF6');
const r1 = (n: number) => Math.round(n * 100) / 100;

const IG_GLYPH = '<svg viewBox="0 0 48 48" width="64" height="64" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round"><rect x="6" y="6" width="36" height="36" rx="11"/><circle cx="24" cy="24" r="8.5"/><circle cx="34.5" cy="13.5" r="1.8" fill="#fff" stroke="none"/></svg>';
const YT_GLYPH = '<svg viewBox="0 0 48 48" width="68" height="68"><rect x="3" y="10" width="42" height="28" rx="9" fill="#fff"/><path d="M20 17.5v13l11.5-6.5z" fill="#FF0033"/></svg>';
const BELL = '<svg viewBox="0 0 24 24" width="46" height="46" fill="#fff"><path d="M12 22a2.4 2.4 0 0 0 2.4-2.4h-4.8A2.4 2.4 0 0 0 12 22zm7-6.2V11a7 7 0 0 0-5.4-6.8V3.5a1.6 1.6 0 0 0-3.2 0v.7A7 7 0 0 0 5 11v4.8l-1.8 1.8v.9h17.6v-.9z"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

/** The end-card section and the script that adds its animation to Claude's timeline. */
export function endCardParts(o: EndCardOptions): { section: string; script: string; head: string } {
  const E = r1(o.storyEnd);
  const D = r1(Math.max(1, o.duration - o.storyEnd));
  const accent = safeColor(o.accent);
  const logo = safeLogo(o.logo);
  const handle = escapeHtml(o.handle);
  // The handle is one line, 900 px wide at most: smaller type for a long handle.
  const size = Math.max(54, Math.min(120, Math.floor(900 / Math.max(6, o.handle.length * 0.6))));
  const both = o.platforms.length > 1;
  const buttons = o.platforms.map((p, i) => {
    const top = both ? 1000 + i * 190 : 1060;
    const ig = p === 'instagram';
    const bg = ig ? 'linear-gradient(100deg,#F58529 0%,#DD2A7B 45%,#8134AF 75%,#515BD4 100%)' : '#FF0033';
    const idle = ig ? 'Follow' : 'Subscribe';
    const done = ig ? 'Following' : 'Subscribed';
    return `<div class="mm-btn" id="mm-btn-${i}" style="top:${top}px"><div class="mm-btn-bg" style="background:${bg}"></div><div class="mm-btn-done"></div>
<div class="mm-btn-idle"><span class="mm-ic">${ig ? IG_GLYPH : YT_GLYPH}</span><span class="mm-lbl">${idle}</span>${ig ? '' : `<span class="mm-bell" id="mm-bell-${i}">${BELL}</span>`}</div>
<div class="mm-btn-state"><span class="mm-ic">${CHECK}</span><span class="mm-lbl">${done}</span></div><div class="mm-ripple" id="mm-rip-${i}"></div></div>`;
  });

  const head = '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=Plus+Jakarta+Sans:wght@500;700&display=block" rel="stylesheet">'
    + `<style>
.mm-end{position:absolute;left:0;top:0;width:1080px;height:1920px;overflow:hidden;background:#07080f;font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#fff}
.mm-end *{box-sizing:border-box;margin:0}
.mm-glow{position:absolute;left:-160px;top:380px;width:1400px;height:1100px;background:radial-gradient(closest-side,${accent}66,transparent 72%);opacity:0}
.mm-glow2{position:absolute;left:-300px;top:1200px;width:1000px;height:900px;background:radial-gradient(closest-side,#6366f155,transparent 70%);opacity:0}
.mm-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);background-size:90px 90px;-webkit-mask-image:radial-gradient(60% 45% at 50% 50%,#000,transparent);mask-image:radial-gradient(60% 45% at 50% 50%,#000,transparent);opacity:0}
.mm-dot{position:absolute;width:10px;height:10px;border-radius:50%;background:${accent};opacity:0}
.mm-logo{position:absolute;left:410px;top:340px;width:260px;height:260px;border-radius:50%;overflow:hidden;background:#12141f;border:7px solid ${accent};box-shadow:0 0 0 14px ${accent}33,0 30px 80px -20px ${accent}aa;opacity:0}
.mm-logo img{display:block;width:100%;height:100%;object-fit:cover}
.mm-handle{position:absolute;left:90px;top:640px;width:900px;height:150px;text-align:center;white-space:nowrap;font-family:'Bricolage Grotesque','Plus Jakarta Sans',system-ui,sans-serif;font-weight:800;font-size:${size}px;line-height:150px;letter-spacing:-0.02em;color:#fff;opacity:0}
.mm-line{position:absolute;left:360px;top:808px;width:360px;height:8px;border-radius:4px;background:linear-gradient(90deg,transparent,${accent},transparent);opacity:0;transform-origin:50% 50%}
.mm-invite{position:absolute;left:90px;top:860px;width:900px;height:70px;text-align:center;white-space:nowrap;font-weight:500;font-size:44px;line-height:70px;color:rgba(255,255,255,.72);opacity:0}
.mm-btn{position:absolute;left:160px;width:760px;height:150px;border-radius:75px;opacity:0;box-shadow:0 26px 60px -22px rgba(0,0,0,.7)}
.mm-btn-bg{position:absolute;inset:0;border-radius:75px;box-shadow:inset 0 3px 0 rgba(255,255,255,.35),inset 0 -6px 14px rgba(0,0,0,.18)}
.mm-btn-done{position:absolute;inset:0;border-radius:75px;background:rgba(8,10,18,.5);box-shadow:inset 0 0 0 3px rgba(255,255,255,.22);opacity:0}
.mm-btn-idle,.mm-btn-state{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:26px;font-weight:700;font-size:56px;white-space:nowrap}
.mm-btn-state{opacity:0}
.mm-ic{display:flex;align-items:center}.mm-bell{display:flex;margin-left:8px;transform-origin:50% 12%}
.mm-ripple{position:absolute;left:380px;top:75px;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;background:rgba(255,255,255,.55);opacity:0}
.mm-conf{position:absolute;width:16px;height:16px;border-radius:4px;opacity:0}
</style>`;

  const dots = Array.from({ length: 14 }, (_, i) => `<div class="mm-dot" data-i="${i}"></div>`).join('');
  const conf = Array.from({ length: 28 }, (_, i) => `<div class="mm-conf" data-i="${i}"></div>`).join('');
  const section = `<section class="clip mm-end" data-start="${E}" data-duration="${D}" data-track-index="9" style="position:absolute;left:0;top:0;width:1080px;height:1920px;z-index:2147483000">
<div class="mm-glow"></div><div class="mm-glow2"></div><div class="mm-grid"></div>${dots}
${logo ? `<div class="mm-logo"><img alt="" src="${logo}"></div>` : ''}<div class="mm-handle">${handle}</div><div class="mm-line"></div><div class="mm-invite">${escapeHtml(invite(o.language, o.platforms))}</div>
${buttons.join('\n')}${conf}
</section>`;

  const n = o.platforms.length;
  const script = `<script>(function(){
var main=window.__timelines&&window.__timelines["main"];if(!main||!window.gsap)return;
var E=${E},q=gsap.utils.selector(document.querySelector(".mm-end"));
function rnd(s){return function(){s=(s*16807)%2147483647;return (s-1)/2147483646;};}
var r=rnd(20261112),n=${n},colors=["${accent}","#ffffff","#a78bfa","#fbbf24","#34d399"];
var tl=gsap.timeline({paused:false});
tl.fromTo(q(".mm-glow"),{opacity:0,scale:.85},{opacity:1,scale:1,duration:1.2,ease:"power2.out"},0);
tl.fromTo(q(".mm-glow2"),{opacity:0},{opacity:1,duration:1.2,ease:"power2.out"},0.1);
tl.fromTo(q(".mm-grid"),{opacity:0},{opacity:1,duration:1,ease:"power1.out"},0.1);
q(".mm-dot").forEach(function(el,i){var x=70+r()*940,y=300+r()*1300,dy=-(60+r()*90);gsap.set(el,{left:x,top:y});tl.fromTo(el,{opacity:0,y:0},{opacity:.35+r()*.4,y:dy,duration:2.8,ease:"sine.out"},0.1+r()*.6);});
tl.fromTo(q(".mm-logo"),{opacity:0,scale:.55},{opacity:1,scale:1,duration:.65,ease:"back.out(1.7)"},0.15);
tl.fromTo(q(".mm-handle"),{opacity:0,y:24},{opacity:1,y:0,duration:.6,ease:"power3.out"},0.3);
tl.fromTo(q(".mm-line"),{opacity:0,scaleX:0},{opacity:1,scaleX:1,duration:.7,ease:"power3.out"},0.55);
tl.fromTo(q(".mm-invite"),{opacity:0,y:20},{opacity:1,y:0,duration:.55,ease:"power3.out"},0.8);
for(var i=0;i<n;i++){(function(i){
 var b=q("#mm-btn-"+i),rip=q("#mm-rip-"+i),idle=q("#mm-btn-"+i+" .mm-btn-idle"),st=q("#mm-btn-"+i+" .mm-btn-state"),dn=q("#mm-btn-"+i+" .mm-btn-done"),bell=q("#mm-bell-"+i);
 var t0=1.1+i*.15,tap=1.7+i*.35;
 tl.fromTo(b,{opacity:0,y:70,scale:.94},{opacity:1,y:0,scale:1,duration:.6,ease:"back.out(1.4)"},t0);
 tl.fromTo(rip,{opacity:.7,scale:.2},{opacity:0,scale:2.6,duration:.55,ease:"power2.out"},tap);
 tl.fromTo(b,{scale:1},{scale:.95,duration:.12,ease:"power2.in",immediateRender:false},tap);
 tl.to(b,{scale:1,duration:.4,ease:"back.out(2.2)"},tap+.12);
 tl.fromTo(dn,{opacity:0},{opacity:1,duration:.25,ease:"none"},tap+.1);
 tl.fromTo(idle,{opacity:1},{opacity:0,duration:.2,ease:"none",immediateRender:false},tap+.08);
 tl.fromTo(st,{opacity:0},{opacity:1,duration:.25,ease:"none"},tap+.18);
 if(bell.length){tl.fromTo(bell,{rotation:0},{rotation:18,duration:.09,yoyo:true,repeat:3,ease:"sine.inOut"},tap-.38);}
})(i);}
var cx=540,cy=${both ? 1075 : 1135};
q(".mm-conf").forEach(function(el,i){var a=-Math.PI/2+(r()-.5)*2.6,v=260+r()*520,x=Math.cos(a)*v,y=Math.sin(a)*v;
 gsap.set(el,{left:cx-8,top:cy-8,background:colors[i%colors.length],rotation:r()*360});
 tl.fromTo(el,{opacity:1,x:0,y:0,scale:1},{opacity:0,x:x,y:y+260,rotation:"+="+(180+r()*360),scale:.6,duration:.8,ease:"power2.out"},(n>1?2.1:1.9)+r()*.08);});
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
