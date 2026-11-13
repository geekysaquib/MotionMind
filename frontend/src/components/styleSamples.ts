import type { StyleId } from '@motionmind/shared';

// Short looping previews of each style, drawn with CSS animation only (no scripts, no network). They are a hint of the
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

const whiteboard = base(
  '#fbfaf5',
  `.t{position:absolute;left:28px;top:50px;font:700 34px 'Segoe Print','Comic Sans MS',cursive;color:#1f2937;animation:fade 7s infinite}
@keyframes fade{0%{opacity:0;transform:translateY(8px)}8%,90%{opacity:1;transform:none}100%{opacity:0}}
.s{fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-width:5;stroke-dasharray:600;stroke-dashoffset:600;animation:wr 7s infinite}
.a{stroke:#2563eb}.b{stroke:#dc2626;animation-delay:.8s}.c{stroke:#16a34a;animation-delay:1.6s}.d{stroke:#1f2937;animation-delay:2.4s}
@keyframes wr{0%{stroke-dashoffset:600}25%,88%{stroke-dashoffset:0}100%{stroke-dashoffset:-600}}
.n{position:absolute;font:600 22px 'Segoe Print','Comic Sans MS',cursive;animation:fade 7s infinite}`,
  `<div class="t">How UPI pays</div>
<svg width="360" height="640" style="position:absolute;inset:0"><rect class="s a" x="30" y="150" width="120" height="90" rx="14"/><rect class="s b" x="210" y="150" width="120" height="90" rx="14"/><path class="s d" d="M152 195 H208 M196 183 L208 195 L196 207"/><rect class="s c" x="120" y="380" width="120" height="90" rx="14"/><path class="s d" d="M270 245 C 270 320 200 330 190 376 M180 362 L190 376 L204 364"/></svg>
<div class="n" style="left:58px;top:178px;color:#2563eb;animation-delay:.6s">Phone</div><div class="n" style="left:240px;top:178px;color:#dc2626;animation-delay:1.4s">Bank</div><div class="n" style="left:146px;top:408px;color:#16a34a;animation-delay:2.2s">NPCI</div>`,
);

const darkKeynote = base(
  '#07080c',
  `.glow{position:absolute;left:-60px;top:140px;width:480px;height:420px;background:radial-gradient(closest-side,rgba(124,58,237,.55),transparent);animation:br 5s infinite alternate ease-in-out}
@keyframes br{from{opacity:.5;transform:scale(.9)}to{opacity:1;transform:scale(1.1)}}
.big{position:absolute;left:0;right:0;top:200px;text-align:center;font-size:150px;font-weight:900;letter-spacing:-.05em;color:#fff;animation:pp 6s infinite}
@keyframes pp{0%{opacity:0;transform:scale(.7);filter:blur(12px)}14%,86%{opacity:1;transform:scale(1);filter:none}100%{opacity:0;transform:scale(1.08)}}
.sub{position:absolute;left:0;right:0;top:390px;text-align:center;color:#9aa3b8;font-size:20px;animation:pp 6s .5s infinite}
.bars{position:absolute;left:50px;right:50px;bottom:90px;display:flex;gap:14px;align-items:flex-end;height:120px}
.bars i{flex:1;background:linear-gradient(#a78bfa,#6366f1);border-radius:8px 8px 0 0;transform-origin:bottom;animation:gr 6s infinite}
@keyframes gr{0%,10%{transform:scaleY(0)}30%,86%{transform:scaleY(1)}100%{transform:scaleY(0)}}`,
  `<div class="glow"></div><div class="big">10×</div><div class="sub">faster than a bank transfer</div>
<div class="bars"><i style="height:30%;animation-delay:.1s"></i><i style="height:45%;animation-delay:.2s"></i><i style="height:60%;animation-delay:.3s"></i><i style="height:80%;animation-delay:.4s"></i><i style="height:100%;animation-delay:.5s"></i></div>`,
);

const transitMap = base(
  '#f4f1ea',
  `.ln{fill:none;stroke-width:14;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:700;animation:dr 7s infinite}
@keyframes dr{0%{stroke-dashoffset:700}35%,90%{stroke-dashoffset:0}100%{stroke-dashoffset:-700}}
.st{fill:#fff;stroke:#111827;stroke-width:5;animation:po 7s infinite;transform-box:fill-box;transform-origin:center}
@keyframes po{0%,30%{transform:scale(0)}40%{transform:scale(1.3)}46%,90%{transform:scale(1)}100%{transform:scale(0)}}
.tr{position:absolute;width:26px;height:26px;border-radius:50%;background:#111827;box-shadow:0 0 0 6px rgba(17,24,39,.15);offset-path:path('M50 520 L50 340 L180 340 L180 200 L310 200 L310 90');offset-rotate:0deg;animation:mv 7s infinite linear}
@keyframes mv{0%,35%{offset-distance:0%;opacity:0}40%{opacity:1}90%{offset-distance:100%;opacity:1}100%{offset-distance:100%;opacity:0}}
.lb{position:absolute;font-weight:700;font-size:15px;color:#111827;background:#fff;border-radius:6px;padding:3px 8px;animation:po 7s infinite}`,
  `<svg width="360" height="640" style="position:absolute;inset:0"><path class="ln" stroke="#e11d48" d="M50 520 L50 340 L180 340 L180 200 L310 200 L310 90"/><path class="ln" stroke="#2563eb" style="animation-delay:.5s" d="M50 150 L130 150 L180 200 L180 340 L260 420 L310 420"/>
<circle class="st" cx="50" cy="520" r="13"/><circle class="st" cx="180" cy="340" r="13" style="animation-delay:.2s"/><circle class="st" cx="180" cy="200" r="13" style="animation-delay:.4s"/><circle class="st" cx="310" cy="90" r="13" style="animation-delay:.6s"/></svg>
<div class="tr"></div><div class="lb" style="left:70px;top:505px">Booking</div><div class="lb" style="left:196px;top:326px;animation-delay:.2s">Queue</div><div class="lb" style="left:196px;top:186px;animation-delay:.4s">Payment</div><div class="lb" style="left:216px;top:76px;animation-delay:.6s">Seat</div>`,
);

const newsroom = base(
  '#0b1220',
  `.bg{position:absolute;inset:0;background:linear-gradient(160deg,#1e3a8a,#0b1220 70%);}
.live{position:absolute;left:20px;top:28px;background:#dc2626;color:#fff;font-weight:800;font-size:14px;letter-spacing:.12em;padding:6px 12px;border-radius:4px;animation:bl 1.4s infinite}
@keyframes bl{50%{opacity:.55}}
.l3{position:absolute;left:0;right:0;bottom:120px;animation:sl 7s infinite}
@keyframes sl{0%,6%{transform:translateX(-100%)}16%,88%{transform:none}100%{transform:translateX(-100%)}}
.l3 .t{background:#dc2626;color:#fff;font-weight:800;font-size:13px;letter-spacing:.1em;padding:6px 20px;width:max-content}
.l3 .h{background:#fff;color:#0b1220;font-weight:800;font-size:25px;line-height:1.15;padding:14px 20px}
.tk{position:absolute;left:0;right:0;bottom:0;height:46px;background:#111827;overflow:hidden;white-space:nowrap;color:#e5e7eb;font-size:15px;line-height:46px}
.tk span{display:inline-block;padding-left:100%;animation:tk 9s linear infinite}
@keyframes tk{to{transform:translateX(-100%)}}
.q{position:absolute;left:28px;right:28px;top:150px;color:#fff;font-size:70px;font-weight:900;line-height:1;animation:pp 7s infinite}
@keyframes pp{0%{opacity:0;transform:translateY(20px)}14%,86%{opacity:1;transform:none}100%{opacity:0}}`,
  `<div class="bg"></div><div class="live">LIVE</div><div class="q">₹ 1.2 lakh crore</div>
<div class="l3"><div class="t">EXPLAINED</div><div class="h">How UPI moved a month of money in one day</div></div>
<div class="tk"><span>UPI crosses record volume · NPCI says systems stable · Banks add more capacity · </span></div>`,
);

export const STYLE_SAMPLE_HTML: Record<StyleId, string> = {
  'live-map': liveMap,
  whiteboard,
  'dark-keynote': darkKeynote,
  'transit-map': transitMap,
  newsroom,
};
