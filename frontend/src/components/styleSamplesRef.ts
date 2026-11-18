// Looping previews for the styles written from Saquib's reference reels (2026-11-16). CSS animation only (no scripts,
// no network), each a 360 x 640 page that the player scales down to a card. Everything is drawn large, flat and
// hard-edged (crisp 1-2 px lines, heavy type, no blur) so it stays sharp at card size.

const base = (bg: string, css: string, body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}html,body{width:360px;height:640px;overflow:hidden;background:${bg};font-family:'Segoe UI',system-ui,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
.mono{font-family:Consolas,'Cascadia Mono','Courier New',monospace}
.in{animation:in 6s cubic-bezier(.2,.9,.2,1) infinite both}
@keyframes in{0%,6%{opacity:0;transform:translateY(18px)}14%,90%{opacity:1;transform:none}97%,100%{opacity:0}}
${css}
@media (prefers-reduced-motion:reduce){*{animation-play-state:paused!important}}
</style></head><body>${body}</body></html>`;

const spotlightNoir = base(
  '#05060B',
  `.bg{position:absolute;inset:0;background:radial-gradient(70% 34% at 50% 36%,#1d2150 0%,#0a0c18 62%,#05060b 100%)}
.cone{position:absolute;left:0;top:0;width:360px;height:420px;background:linear-gradient(180deg,rgba(190,196,255,.20),rgba(190,196,255,0) 92%);clip-path:polygon(44% 0,56% 0,82% 100%,18% 100%)}
.top{position:absolute;left:20px;right:20px;top:22px;display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:700;letter-spacing:.12em;color:#c9ccff}
.top span:last-child{color:#8b7cff;border:1.5px solid #8b7cff;border-radius:999px;padding:4px 10px;font-size:11px}
.tag{position:absolute;left:0;right:0;top:70px;text-align:center}
.tag span{display:inline-block;background:#8b7cff;color:#fff;font-size:13px;font-weight:800;letter-spacing:.14em;padding:7px 14px;border-radius:999px}
.chip{position:absolute;left:104px;top:128px;animation:chip 6s cubic-bezier(.2,.9,.2,1) infinite both}
@keyframes chip{0%,4%{opacity:0;transform:translateY(30px) scale(.94)}16%,90%{opacity:1;transform:none}97%,100%{opacity:0}}
.die{animation:glow 2s ease-in-out infinite alternate}@keyframes glow{from{opacity:.65}to{opacity:1}}
.num{position:absolute;left:0;right:0;top:344px;text-align:center;color:#fff;font-weight:900;font-size:76px;line-height:1;letter-spacing:-.03em;animation-delay:.35s}
.lbl{position:absolute;left:0;right:0;top:432px;text-align:center;color:#8b7cff;font-size:14px;font-weight:700;letter-spacing:.18em;animation-delay:.55s}
.cap{position:absolute;left:24px;right:24px;top:500px;text-align:center;font-weight:800;font-size:24px;white-space:nowrap;line-height:1.2;color:rgba(255,255,255,.32)}
.cap i{font-style:normal;animation:lit 6s infinite both}.cap i:nth-child(2){animation-delay:.5s}.cap i:nth-child(3){animation-delay:1s}
@keyframes lit{0%,24%{color:rgba(255,255,255,.32)}28%,92%{color:#fff}}
.cap i.k{animation-name:litv}@keyframes litv{0%,24%{color:rgba(255,255,255,.32)}28%,92%{color:#a99dff}}
.h{position:absolute;left:0;right:0;bottom:30px;text-align:center;color:#9aa0c0;font-size:12px;font-weight:700}.h b{color:#2bd47d}`,
  `<div class="bg"></div><div class="cone"></div>
<div class="top mono"><span>AI.EXE · EP 30</span><span>● LIVE</span></div>
<div class="tag in"><span class="mono">AI KI TRAINING</span></div>
<svg class="chip" width="152" height="152" viewBox="0 0 152 152">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34384a"/><stop offset="1" stop-color="#11131c"/></linearGradient>
  <linearGradient id="d" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6f63ff"/><stop offset="1" stop-color="#2a2580"/></linearGradient></defs>
  ${Array.from({ length: 9 }, (_, i) => `<rect x="${22 + i * 13}" y="0" width="6" height="16" fill="#d9a93b"/><rect x="${22 + i * 13}" y="136" width="6" height="16" fill="#d9a93b"/><rect x="0" y="${22 + i * 13}" width="16" height="6" fill="#d9a93b"/><rect x="136" y="${22 + i * 13}" width="16" height="6" fill="#d9a93b"/>`).join('')}
  <rect x="14" y="14" width="124" height="124" rx="10" fill="url(#g)" stroke="#d9a93b" stroke-width="2"/>
  <rect class="die" x="40" y="40" width="72" height="72" rx="5" fill="url(#d)"/>
  <path d="M40 64H112M40 88H112M64 40V112M88 40V112" stroke="#b9b2ff" stroke-opacity=".45" stroke-width="1.5"/>
  <path d="M20 20L60 20" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>
</svg>
<div class="num in">16,000+</div>
<div class="lbl mono in">H100 CHIPS · EK SAATH</div>
<div class="cap"><i class="k">Hazaaron</i> <i>cores,</i> <i>non-stop.</i></div>
<div class="h mono"><b>●</b> @yourhandle</div>`,
);

const systemTerminal = base(
  '#050608',
  `.grid{position:absolute;inset:0;background-image:linear-gradient(#11151b 1px,transparent 1px),linear-gradient(90deg,#11151b 1px,transparent 1px);background-size:24px 24px}
.hd{position:absolute;left:20px;right:20px;top:22px;display:flex;justify-content:space-between;font-size:12px;font-weight:700;letter-spacing:.14em;color:#e8eaee}.hd span:last-child{color:#7d8590}
.seg{position:absolute;left:20px;right:20px;top:44px;display:flex;gap:4px}.seg i{flex:1;height:3px;background:#22272f}.seg i:nth-child(-n+5){background:#e8eaee}
.chips{position:absolute;left:20px;right:20px;top:70px;display:grid;grid-template-columns:1fr 1fr;gap:8px}
.chips div{height:38px;border-radius:6px;border:1.5px solid #2a2f37;color:#59606b;font-size:12px;font-weight:700;letter-spacing:.08em;display:flex;align-items:center;padding:0 12px;gap:8px;animation:on 6s steps(1) infinite}
.chips div:before{content:'';width:8px;height:8px;border-radius:2px;background:currentColor}
.chips div:nth-child(1){--c:#5aa9ff}.chips div:nth-child(2){--c:#ff5a5f;animation-delay:.6s}.chips div:nth-child(3){--c:#3ddc84;animation-delay:1.2s}.chips div:nth-child(4){--c:#ffb020;animation-delay:1.8s}
@keyframes on{0%{border-color:#2a2f37;color:#59606b}12%,94%{border-color:var(--c);color:var(--c)}}
.box{position:absolute;left:20px;right:20px;top:176px;height:150px;border:2px solid #3ddc84;border-radius:10px;background:#07120c;padding:14px 16px}
.box .t{font-size:12px;font-weight:700;letter-spacing:.14em;color:#3ddc84}
.row{display:flex;gap:8px;margin-top:16px}
.tok{height:40px;padding:0 12px;border-radius:6px;color:#05060b;font-size:18px;font-weight:800;line-height:40px;animation:pop 6s infinite both}
.tok:nth-child(2){animation-delay:.25s}.tok:nth-child(3){animation-delay:.5s}.tok:nth-child(4){animation-delay:.75s}
@keyframes pop{0%,20%{opacity:0;transform:translateY(10px)}26%,92%{opacity:1;transform:none}98%,100%{opacity:0}}
.ids{display:flex;gap:8px;margin-top:10px;font-size:13px;color:#7d8590}
.seven{position:absolute;left:20px;right:20px;top:346px;height:96px;border:2px solid #ff3b3b;border-radius:10px;background:#120506;display:flex;align-items:center;justify-content:space-between;padding:0 18px}
.seven small{font-size:12px;font-weight:700;letter-spacing:.14em;color:#ff7a7a;line-height:1.5}
.seven b{font-size:58px;font-weight:700;color:#ff3b3b;letter-spacing:.06em}
.cap{position:absolute;left:20px;right:20px;top:480px;text-align:center;font-size:27px;font-weight:800;line-height:1.2;color:#3a3f48}
.cap b{color:#fff;animation:lit 6s infinite both}@keyframes lit{0%,40%{color:#3a3f48}46%,94%{color:#fff}}
.cap em{font-style:normal;color:#3ddc84}`,
  `<div class="grid"></div>
<div class="hd mono"><span>ALGO REELS</span><span>SYSTEM DESIGN · 20</span></div><div class="seg">${'<i></i>'.repeat(12)}</div>
<div class="chips mono"><div>VOCABULARY</div><div>OOV</div><div>TOKENS</div><div>TOKEN ID</div></div>
<div class="box mono"><div class="t">● TOKENIZER</div>
<div class="row"><span class="tok" style="background:#3ddc84">un</span><span class="tok" style="background:#5aa9ff">believ</span><span class="tok" style="background:#ffb020">able</span><span class="tok" style="background:#c084fc">!</span></div>
<div class="ids"><span>[ 403</span><span>· 18821</span><span>· 540</span><span>· 0 ]</span></div></div>
<div class="seven mono"><small>TOKENS<br>COUNTED</small><b>092</b></div>
<div class="cap"><b>Ek word,</b> <em>teen</em> <b>tokens.</b></div>`,
);

const deepBlue = base(
  '#071A30',
  `.bg{position:absolute;inset:0;background:linear-gradient(165deg,#0b1a3a 0%,#08243c 55%,#0a2e35 100%)}
.p{position:absolute;width:3px;height:3px;border-radius:50%;background:#9fb6ff;opacity:.35;animation:drift 8s linear infinite}
@keyframes drift{from{transform:translateY(0)}to{transform:translateY(-60px)}}
.hd{position:absolute;right:20px;top:22px;font-size:12px;font-weight:700;color:#8ea2c9}
.t{position:absolute;left:0;right:0;top:66px;text-align:center;color:#f5f8ff;font-weight:900;font-size:44px;letter-spacing:-.02em}.t b{color:#5b8cff}
.glass{position:absolute;left:28px;right:28px;top:164px;height:118px;border-radius:20px;background:rgba(30,52,104,.55);border:1.5px solid rgba(140,175,255,.45);box-shadow:inset 0 1.5px 0 rgba(255,255,255,.18);display:flex;justify-content:center;align-items:center;gap:2px}
.col{height:64px;overflow:hidden;width:34px;text-align:center;font-size:56px;font-weight:700;line-height:64px;color:#7aa2ff}
.col div{animation:roll 6s cubic-bezier(.5,0,.2,1) infinite}
.gap{width:16px}
@keyframes roll{0%,42%{transform:translateY(0)}52%,100%{transform:translateY(-64px)}}
.ring{position:absolute;left:130px;top:312px;width:100px;height:100px;border-radius:50%;background:conic-gradient(#5b8cff var(--a),#1c2b52 0);animation:drain 6s linear infinite;display:flex;align-items:center;justify-content:center}
.ring:before{content:'';position:absolute;inset:8px;border-radius:50%;background:#0a213a}
.ring span{position:relative;color:#fff;font-size:22px;font-weight:800}
@property --a{syntax:'<angle>';inherits:false;initial-value:360deg}
@keyframes drain{from{--a:360deg}to{--a:0deg}}
.lock{position:absolute;left:40px;top:330px}
.ok{position:absolute;right:40px;top:336px;width:56px;height:56px;border-radius:50%;border:2px solid #2bd47d;display:flex;align-items:center;justify-content:center;animation:okp 6s infinite both}
@keyframes okp{0%,52%{opacity:0;transform:scale(.6)}58%,92%{opacity:1;transform:none}98%,100%{opacity:0}}
.sub{position:absolute;left:20px;right:20px;top:470px;text-align:center;font-size:26px;font-weight:800;color:rgba(245,248,255,.38);line-height:1.25}
.sub span{position:relative;display:inline-block}
.sub span.on{color:#fff}
.sub span.on:after{content:'';position:absolute;left:0;right:0;bottom:-4px;height:4px;border-radius:2px;background:#2ee6c5;transform-origin:left;animation:ul 6s infinite both}
@keyframes ul{0%,20%{transform:scaleX(0)}30%,100%{transform:scaleX(1)}}
.prog{position:absolute;left:60px;right:60px;top:540px;height:3px;border-radius:2px;background:#1c2b52}.prog i{display:block;height:3px;border-radius:2px;background:#2ee6c5;animation:pr 6s linear infinite}
@keyframes pr{from{width:0}to{width:100%}}`,
  `<div class="bg"></div>${Array.from({ length: 18 }, (_, i) => `<div class="p" style="left:${(i * 47) % 350}px;top:${140 + ((i * 71) % 480)}px;animation-delay:-${i % 8}s"></div>`).join('')}
<div class="hd mono">@yourhandle</div>
<div class="t in">One <b>mistake</b></div>
<div class="glass mono">${['8', '7', '2', ' ', '9', '2', '1'].map((d, i) => (d === ' ' ? '<div class="gap"></div>' : `<div class="col"><div style="animation-delay:${i * 0.06}s">${d}<br>${'3091240'[i]}</div></div>`)).join('')}</div>
<svg class="lock" width="56" height="64" viewBox="0 0 56 64"><path d="M14 28V18a14 14 0 0 1 28 0v10" fill="none" stroke="#f5b83d" stroke-width="6"/><rect x="4" y="28" width="48" height="34" rx="8" fill="#f5b83d"/><circle cx="28" cy="43" r="5" fill="#0a213a"/><rect x="26" y="45" width="4" height="10" rx="2" fill="#0a213a"/></svg>
<div class="ring"><span>30s</span></div>
<div class="ok"><svg width="26" height="20" viewBox="0 0 26 20"><path d="M2 10l8 8L24 2" fill="none" stroke="#2bd47d" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
<div class="sub"><span class="on">New code</span> every 30s</div><div class="prog"><i></i></div>`,
);

export const REF_STYLE_SAMPLES = {
  'spotlight-noir': spotlightNoir,
  'system-terminal': systemTerminal,
  'deep-blue': deepBlue,
} as const;
