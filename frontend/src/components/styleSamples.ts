import type { StyleId } from '@motionmind/shared';
import { REF_STYLE_SAMPLES } from './styleSamplesRef';

// Short looping previews of Motion Mind's own styles (the LemoLab styles show their sample film instead, styleFilms.ts), drawn with CSS animation only (no scripts, no network). They are a hint of the
// look and motion Claude is asked for, not the reel itself: the real animation is written for your topic.
// Each is a 360 x 640 page; the player scales it to fit.

const base = (bg: string, css: string, body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}html,body{width:360px;height:640px;overflow:hidden;background:${bg};font-family:'Segoe UI',system-ui,sans-serif}
.l{animation-iteration-count:infinite;animation-timing-function:cubic-bezier(.2,.8,.2,1);animation-fill-mode:both}
${css}
@media (prefers-reduced-motion:reduce){*{animation-play-state:paused!important}}
</style></head><body>${body}</body></html>`;

const liveMap = base(
  '#dfeaf5',
  `.grid{position:absolute;inset:0;background-image:linear-gradient(#c5d6e8 2px,transparent 2px),linear-gradient(90deg,#c5d6e8 2px,transparent 2px);background-size:60px 60px;animation:pan 8s linear infinite}
@keyframes pan{to{background-position:60px 60px}}
.park{position:absolute;border-radius:14px;background:#b9dfc3}
.route{stroke:#7c3aed;stroke-width:8;fill:none;stroke-linecap:round;stroke-dasharray:520;animation:draw 6s infinite}
@keyframes draw{0%{stroke-dashoffset:520}55%,90%{stroke-dashoffset:0}100%{stroke-dashoffset:-520}}
.pin{position:absolute;width:26px;height:26px;border-radius:50% 50% 50% 0;background:#ef4444;transform:rotate(-45deg);animation:pop 6s infinite}
@keyframes pop{0%,45%{opacity:0;transform:rotate(-45deg) scale(0)}55%{opacity:1;transform:rotate(-45deg) scale(1.25)}62%,92%{opacity:1;transform:rotate(-45deg) scale(1)}100%{opacity:0}}
.ping{position:absolute;width:40px;height:40px;border-radius:50%;border:3px solid #7c3aed;animation:ping 2s infinite}
@keyframes ping{from{transform:scale(.3);opacity:.9}to{transform:scale(2.6);opacity:0}}
.card{position:absolute;left:24px;right:24px;bottom:56px;background:#fff;border-radius:18px;padding:18px;box-shadow:0 16px 40px -16px rgba(30,40,80,.5);animation:up 6s infinite}
@keyframes up{0%,8%{transform:translateY(60px);opacity:0}18%,88%{transform:none;opacity:1}100%{transform:translateY(60px);opacity:0}}
.k{font-size:11px;letter-spacing:.14em;color:#7c3aed;font-weight:700}.h{font-size:24px;font-weight:800;color:#101828;line-height:1.15;margin-top:6px}`,
  `<div class="grid"></div><div class="park" style="left:200px;top:90px;width:120px;height:90px"></div><div class="park" style="left:20px;top:330px;width:90px;height:120px"></div>
<svg width="360" height="640" style="position:absolute;inset:0"><path class="route" d="M60 420 C 60 300 180 340 190 220 S 290 150 300 110"/></svg>
<div class="ping" style="left:40px;top:400px"></div><div class="pin" style="left:289px;top:92px"></div>
<div class="card"><div class="k">STEP 1 · CELL TOWERS</div><div class="h">Your phone always talks to the nearest tower</div></div>`,
);

export const STYLE_SAMPLE_HTML: Partial<Record<StyleId, string>> = {
  'live-map': liveMap,
  ...REF_STYLE_SAMPLES,
};
