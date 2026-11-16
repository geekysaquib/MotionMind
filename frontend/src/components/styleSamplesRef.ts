// Looping previews for the styles written from Saquib's reference reels (2026-11-16). CSS animation only (no scripts,
// no network), each a 360 x 640 page that the player scales to fit. They hint at the look and motion; Claude designs
// the real reel for the topic.

const base = (bg: string, css: string, body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}html,body{width:360px;height:640px;overflow:hidden;background:${bg};font-family:'Segoe UI',system-ui,sans-serif}
.mono{font-family:Consolas,'Courier New',monospace}
${css}
@media (prefers-reduced-motion:reduce){*{animation-play-state:paused!important}}
</style></head><body>${body}</body></html>`;

// A blinking, talking cartoon host (flat, black outline), shared by the two "Host Desk" styles.
const host = (o: { skin: string; hair: string; shirt: string; beard: boolean; headset: boolean }) => `
<svg class="host" width="200" height="210" viewBox="0 0 200 210" style="position:absolute;left:150px;bottom:-6px">
  <g class="body"><path d="M30 210 C30 150 60 135 100 135 C140 135 170 150 170 210 Z" fill="${o.shirt}" stroke="#111" stroke-width="4"/></g>
  <g class="arm"><path d="M40 205 C30 175 22 150 30 128" fill="none" stroke="${o.shirt}" stroke-width="20" stroke-linecap="round"/><circle cx="30" cy="122" r="13" fill="${o.skin}" stroke="#111" stroke-width="4"/></g>
  <ellipse cx="100" cy="88" rx="44" ry="48" fill="${o.skin}" stroke="#111" stroke-width="4"/>
  ${o.beard ? '<path d="M58 92 C60 140 140 140 142 92 C130 112 70 112 58 92 Z" fill="#1A1A1A"/>' : ''}
  <path d="M54 76 C52 30 148 30 146 76 C136 54 66 54 54 76 Z" fill="${o.hair}" stroke="#111" stroke-width="3"/>
  ${o.beard ? '<path d="M60 52 L66 30 L76 46 L86 24 L96 44 L108 22 L116 44 L128 28 L132 50 L144 44" fill="#1A1A1A"/>' : ''}
  <g class="eyes"><circle cx="84" cy="86" r="7" fill="#fff" stroke="#111" stroke-width="2"/><circle cx="116" cy="86" r="7" fill="#fff" stroke="#111" stroke-width="2"/><circle cx="85" cy="87" r="3.4" fill="#111"/><circle cx="117" cy="87" r="3.4" fill="#111"/></g>
  <ellipse class="mouth" cx="100" cy="112" rx="9" ry="5" fill="#7A2B2B" stroke="#111" stroke-width="2"/>
  ${o.headset ? '<path d="M54 84 C50 40 150 40 146 84" fill="none" stroke="#222" stroke-width="7"/><rect x="44" y="76" width="16" height="26" rx="7" fill="#333"/><rect x="140" y="76" width="16" height="26" rx="7" fill="#333"/><path d="M52 100 C56 118 70 120 80 118" fill="none" stroke="#222" stroke-width="4"/><circle cx="82" cy="118" r="4.5" fill="#E5483B"/>' : ''}
</svg>`;

const hostCss = `.host .eyes{animation:blink 3.4s infinite;transform-origin:100px 86px}
@keyframes blink{0%,46%,50%,100%{transform:scaleY(1)}48%{transform:scaleY(.1)}}
.host .mouth{animation:talk .32s infinite alternate;transform-origin:100px 112px}
@keyframes talk{from{transform:scaleY(.4)}to{transform:scaleY(1.2)}}
.host .arm{animation:wave 2.4s infinite;transform-origin:44px 200px}
@keyframes wave{0%,100%{transform:rotate(0)}20%{transform:rotate(-14deg)}40%{transform:rotate(6deg)}60%{transform:rotate(-10deg)}}`;

const spotlightNoir = base(
  '#06070C',
  `.bg{position:absolute;inset:0;background:radial-gradient(60% 40% at 50% 34%,#262b62 0%,transparent 70%),linear-gradient(#0b0e1a,#06070c)}
.cone{position:absolute;left:90px;top:-20px;width:180px;height:330px;background:linear-gradient(rgba(170,178,255,.28),rgba(170,178,255,0));clip-path:polygon(40% 0,60% 0,100% 100%,0 100%);filter:blur(6px);animation:lamp 6s infinite}
@keyframes lamp{0%,8%{opacity:0}18%,92%{opacity:1}100%{opacity:0}}
.top{position:absolute;left:14px;right:14px;top:16px;display:flex;justify-content:space-between;font-size:8px;color:#8c93b0;letter-spacing:.1em}
.top b{color:#c9ccff}.pillr{border:1px solid #3a3f6a;border-radius:10px;padding:2px 7px}
.tag{position:absolute;left:0;right:0;top:46px;text-align:center}
.tag span{background:#7c6bff;color:#fff;font-size:9px;font-weight:700;letter-spacing:.12em;padding:4px 9px;border-radius:9px;display:inline-block;animation:pop 6s infinite}
.chip{position:absolute;left:120px;top:150px;width:120px;height:120px;border-radius:10px;background:linear-gradient(145deg,#2c2f3d,#14151c);box-shadow:0 0 0 7px #2a2618,0 0 0 9px #b8902e,0 30px 40px -10px #000;animation:rise 6s infinite}
.chip:before{content:'';position:absolute;inset:-18px;background:repeating-linear-gradient(90deg,#d8a93a 0 3px,transparent 3px 8px) top/100% 8px no-repeat,repeating-linear-gradient(90deg,#d8a93a 0 3px,transparent 3px 8px) bottom/100% 8px no-repeat;z-index:-1}
.die{position:absolute;inset:26px;border-radius:6px;background:linear-gradient(135deg,#3a3f6b,#1d2040);box-shadow:inset 0 0 18px rgba(139,124,255,.7)}
@keyframes rise{0%,10%{opacity:0;transform:translateY(40px)}24%,92%{opacity:1;transform:none}100%{opacity:0}}
.floor{position:absolute;left:95px;top:292px;width:170px;height:22px;border-radius:50%;background:radial-gradient(rgba(0,0,0,.8),transparent 70%)}
.num{position:absolute;left:0;right:0;top:330px;text-align:center;color:#fff;font-weight:900;font-size:58px;letter-spacing:-.02em;animation:pop 6s infinite;animation-delay:.4s}
.lbl{position:absolute;left:0;right:0;top:412px;text-align:center;color:#8b7cff;font-size:9px;letter-spacing:.14em;animation:pop 6s infinite;animation-delay:.6s}
@keyframes pop{0%,26%{opacity:0;transform:scale(.85)}34%,92%{opacity:1;transform:none}100%{opacity:0}}
.cap{position:absolute;left:0;right:0;top:470px;text-align:center;color:rgba(255,255,255,.45);font-weight:700;font-size:18px}
.cap i{font-style:normal;animation:lit 6s infinite}.cap i:nth-child(2){animation-delay:.6s}.cap i:nth-child(3){animation-delay:1.2s}
@keyframes lit{0%,30%{color:rgba(255,255,255,.45)}38%,92%{color:#fff}}
.cap i.k{animation-name:litv}@keyframes litv{0%,30%{color:rgba(255,255,255,.45)}38%,92%{color:#8b7cff}}
.h{position:absolute;left:0;right:0;bottom:56px;text-align:center;color:#8c93b0;font-size:9px}.h b{color:#2bd47d}`,
  `<div class="bg"></div><div class="cone"></div>
<div class="top mono"><span><b>▣ AI.EXE</b> · EP 30</span><span class="pillr">● AI CHIP KA RAAZ</span></div>
<div class="tag mono"><span>AI KI TRAINING</span></div>
<div class="chip"><div class="die"></div></div><div class="floor"></div>
<div class="num">16,000+</div><div class="lbl mono">H100 CHIPS · EK SAATH</div>
<div class="cap"><i class="k">hazaaron</i> <i>cores,</i> <i>non-stop.</i></div>
<div class="h mono"><b>●</b> @yourhandle</div>`,
);

const night3d = base(
  '#141631',
  `.sky{position:absolute;inset:0;background:linear-gradient(#1b1e3a 0%,#2b2d55 46%,#3a3560 54%,#121427 56%,#0c0e1d 100%)}
.star{position:absolute;width:2px;height:2px;background:#fff;border-radius:50%;opacity:.7;animation:tw 2.4s infinite alternate}
@keyframes tw{to{opacity:.15}}
.bar{position:absolute;left:0;top:0;height:3px;background:#ff8a3d;animation:prog 8s linear infinite}@keyframes prog{from{width:0}to{width:360px}}
.top{position:absolute;left:12px;right:12px;top:12px;display:flex;justify-content:space-between;font-size:7px;color:#a4a8cc;letter-spacing:.1em}
.cap{position:absolute;left:0;right:0;top:58px;text-align:center;color:#fff;font-weight:900;font-size:30px;line-height:1.08;text-shadow:0 3px 10px rgba(0,0,0,.6)}
.cap span{display:inline-block;animation:w 8s infinite}.cap .y{color:#ffd23f}
.cap span:nth-child(2){animation-delay:.25s}.cap span:nth-child(4){animation-delay:.5s}.cap span:nth-child(5){animation-delay:.75s}
@keyframes w{0%,4%{opacity:0;transform:scale(.8)}10%,90%{opacity:1;transform:none}100%{opacity:0}}
.palm{position:absolute;bottom:278px;width:4px;height:60px;background:#0b0d1a}
.palm:after{content:'';position:absolute;left:-18px;top:-10px;width:40px;height:20px;border-radius:50%;border-top:6px solid #0b0d1a}
svg.world{position:absolute;left:0;top:350px}
.train{position:absolute;top:404px;left:0;width:520px;height:42px;animation:roll 8s linear infinite}
@keyframes roll{from{transform:translateX(-420px) skewY(-8deg)}to{transform:translateX(330px) skewY(-8deg)}}
.coach{position:absolute;top:0;height:40px;width:120px;border-radius:6px;background:linear-gradient(#d9dbe6 0 18%,#b8bccc 18% 82%,#7a3040 82%);box-shadow:0 0 12px rgba(255,210,122,.25)}
.coach i{position:absolute;top:12px;width:12px;height:12px;border-radius:2px;background:#ffd27a;box-shadow:0 0 8px #ffd27a}
.card{position:absolute;left:46px;top:500px;width:268px;height:74px;border-radius:14px;background:rgba(21,24,51,.88);border:1px solid rgba(255,255,255,.15);box-shadow:0 0 18px rgba(255,210,63,.18);padding:10px 14px;animation:up 8s infinite}
.card .t{font-size:7px;color:#ffd23f;letter-spacing:.12em}.card .n{font-size:30px;font-weight:900;color:#ffd23f;margin-top:4px}.card .s{font-size:7px;color:#a4a8cc;letter-spacing:.1em}
@keyframes up{0%,30%{opacity:0;transform:translateY(24px)}40%,90%{opacity:1;transform:none}100%{opacity:0}}`,
  `<div class="sky"></div>
${Array.from({ length: 14 }, (_, i) => `<div class="star" style="left:${(i * 53) % 350}px;top:${20 + ((i * 37) % 150)}px;animation-delay:${(i % 5) * 0.4}s"></div>`).join('')}
<div class="bar"></div><div class="top mono"><span>EP 17 · TECH</span><span>● @yourhandle</span></div>
<div class="cap"><span>Raaz</span> <span>hai</span><br><span>ek</span> <span class="y">pipe!</span></div>
<div class="palm" style="left:40px"></div><div class="palm" style="left:300px;height:80px"></div>
<svg class="world" width="360" height="290"><polygon points="0,90 360,20 360,290 0,290" fill="#151829"/><line x1="0" y1="118" x2="360" y2="58" stroke="#5a5e80" stroke-width="3"/><line x1="0" y1="138" x2="360" y2="76" stroke="#5a5e80" stroke-width="3"/>${Array.from({ length: 12 }, (_, i) => `<line x1="${i * 32}" y1="${120 - i * 5.4}" x2="${i * 32 + 6}" y2="${138 - i * 5.4}" stroke="#2e3150" stroke-width="5"/>`).join('')}</svg>
<div class="train">${[0, 1, 2, 3].map((c) => `<div class="coach" style="left:${c * 128}px">${[0, 1, 2, 3, 4, 5].map((w) => `<i style="left:${8 + w * 18}px"></i>`).join('')}</div>`).join('')}</div>
<div class="card mono"><div class="t">● NORTH CENTRAL RAILWAY · 6 MAHINE</div><div class="n">7,000+</div><div class="s">CHAIN PULLING CASE</div></div>`,
);

const systemTerminal = base(
  '#07090C',
  `.haze{position:absolute;left:-60px;top:120px;width:480px;height:360px;background:radial-gradient(closest-side,rgba(61,220,132,.22),transparent);animation:hz 9s infinite}
@keyframes hz{0%,40%{filter:hue-rotate(0)}50%,90%{filter:hue-rotate(-90deg)}}
.hd{position:absolute;left:14px;right:14px;top:16px;display:flex;justify-content:space-between;font-size:8px;color:#e8eaee;letter-spacing:.14em}.hd span:last-child{color:#7d8590}
.seg{position:absolute;left:14px;right:14px;top:32px;display:flex;gap:3px}.seg i{flex:1;height:2px;background:#2a2e36}.seg i:nth-child(-n+5){background:#e8eaee}
.sec{position:absolute;left:14px;top:44px;font-size:7px;color:#e8eaee;border:1px solid #2a2e36;border-radius:8px;padding:2px 6px}.sec b{color:#3ddc84}
.chips{position:absolute;left:14px;top:66px;display:flex;gap:5px}
.chips div{width:58px;height:26px;border-radius:5px;border:1.5px dashed #2a2e36;font-size:6px;color:#7d8590;padding:4px;letter-spacing:.06em}
.chips div{animation:on 9s infinite}.chips div:nth-child(1){--c:#5aa9ff}.chips div:nth-child(2){--c:#ff5a5f;animation-delay:.8s}.chips div:nth-child(3){--c:#3ddc84;animation-delay:1.6s}.chips div:nth-child(4){--c:#ffb020;animation-delay:2.4s}
@keyframes on{0%,6%{border:1.5px dashed #2a2e36;box-shadow:none;color:#7d8590}12%,92%{border:1.5px solid var(--c);box-shadow:0 0 10px var(--c);color:#e8eaee}}
.mach{position:absolute;left:110px;top:150px;width:140px;height:110px;border-radius:10px;background:#0e1116;border:2px solid #ffb020;box-shadow:0 0 20px rgba(255,176,32,.35);overflow:hidden}
.mach .st{height:20px;background:repeating-linear-gradient(-45deg,#ffb020 0 8px,#111 8px 16px);text-align:center;font-size:9px;font-weight:900;color:#111;line-height:20px}
.mach .st span{background:#ffb020;padding:0 4px}
.paper{position:absolute;left:18px;top:168px;width:74px;height:90px;background:#f2ede3;transform:rotate(-4deg);border-radius:3px;padding:7px;font-size:5px;color:#555}
.paper b{background:#ffb020;color:#111;padding:0 2px}
.tok{position:absolute;top:186px;height:22px;padding:0 6px;border-radius:5px;color:#fff;font-size:10px;line-height:22px;font-weight:700;animation:fly 9s infinite}
@keyframes fly{0%,30%{opacity:0;transform:translateX(-70px) scale(.6)}40%,90%{opacity:1;transform:none}100%{opacity:0}}
.seven{position:absolute;left:110px;top:296px;width:140px;height:62px;border-radius:8px;background:#000;border:1px solid #2a2e36;text-align:center;color:#ff3b3b;font-size:44px;font-weight:700;letter-spacing:.08em;text-shadow:0 0 12px #ff3b3b;line-height:62px}
.seven span{display:inline-block;animation:tick 9s steps(1) infinite}
@keyframes tick{0%{content:'000'}}
.cap{position:absolute;left:0;right:0;top:470px;text-align:center;font-size:17px;font-weight:600;color:#4b515c}.cap b{color:#fff}`,
  `<div class="haze"></div>
<div class="hd mono"><span>ALGO REELS</span><span>SYSTEM DESIGN · 20</span></div><div class="seg">${'<i></i>'.repeat(12)}</div>
<div class="sec mono"><b>●</b> SOLUTION · TOKENS</div>
<div class="chips mono"><div>VOCABULARY</div><div>OOV</div><div>TOKENS</div><div>TOKEN ID</div></div>
<div class="paper">Dear Sir/Madam, I am writing for <b>leave</b> application for 2 days...</div>
<div class="mach mono"><div class="st"><span>TOKENIZER</span></div></div>
<div class="tok mono" style="left:270px;background:#2e9e5b;animation-delay:0s">leave</div>
<div class="tok mono" style="left:270px;top:216px;background:#3a6fd8;animation-delay:.3s">le</div>
<div class="tok mono" style="left:304px;top:216px;background:#7c5cd6;animation-delay:.5s">ev</div>
<div class="seven mono"><span>092</span></div>
<div class="cap"><b>92 tokens</b> kaise bane.</div>`,
);

const hostDark = base(
  '#191412',
  `.bg{position:absolute;inset:0;background:radial-gradient(70% 45% at 50% 32%,#3a2d27,transparent 70%),linear-gradient(#2a211d,#191412)}
.ch{position:absolute;left:18px;right:18px;top:16px;display:flex;justify-content:space-between;font-size:7px;color:#8e837c;letter-spacing:.08em}.ch b{color:#e5483b;font-weight:400}
.hl{position:absolute;left:18px;top:42px;width:320px;color:#f3ede7;font-size:22px;font-weight:600;line-height:1.2}
.hl i{font-family:Georgia,'Times New Roman',serif;color:#e5483b}
.hl span{opacity:0;animation:in 7s infinite}.hl span:nth-child(2){animation-delay:.3s}.hl span:nth-child(3){animation-delay:.6s}
@keyframes in{0%,4%{opacity:0}10%,92%{opacity:1}100%{opacity:0}}
.news{position:absolute;left:28px;top:118px;width:300px;background:#fff;border-radius:7px;padding:10px 12px;box-shadow:0 12px 30px rgba(0,0,0,.4);animation:drop 7s infinite}
.news .s{font-size:6px;color:#666;display:flex;justify-content:space-between;letter-spacing:.06em}.news .s b{color:#e5483b}
.news .t{font-size:11px;font-weight:700;color:#1b1b1b;margin-top:5px;line-height:1.3}
.news mark{background:linear-gradient(90deg,#f8b4b4 50%,transparent 50%) 100% 0/200% 100%;animation:sweep 7s infinite;color:inherit}
@keyframes sweep{0%,24%{background-position:100% 0}32%,100%{background-position:0 0}}
@keyframes drop{0%,10%{opacity:0;transform:translateY(-20px) rotate(4deg)}18%,92%{opacity:1;transform:none}100%{opacity:0}}
.stat{position:absolute;left:28px;top:210px;width:300px;height:70px;background:#1b1715;border:1px solid #3a302b;border-radius:8px;display:flex;align-items:center;gap:14px;padding:0 14px;animation:drop 7s infinite;animation-delay:.8s}
.stat b{color:#e5483b;font-size:44px;font-weight:900}.stat span{color:#f3ede7;font-size:14px;font-weight:600}.stat small{display:block;color:#8e837c;font-size:6px;letter-spacing:.1em}
${hostCss}`,
  `<div class="bg"></div>
<div class="ch mono"><span>// 01 — the shutdown</span><span>GROUNDED <b>3,944</b></span></div>
<div class="hl"><span>For</span> <span><i>four hours,</i></span> <span>nothing</span></div>
<div class="news"><div class="s mono"><span><b>●</b> ALJAZEERA.COM</span><span>13 NOV 2026</span></div><div class="t">US flights resume after <mark>FAA lifts hours-long</mark> nationwide ground stop</div></div>
<div class="stat"><b>440</b><span>cancelled<small class="mono">FLIGHTAWARE DATA</small></span></div>
${host({ skin: '#F2C9A5', hair: '#2B2420', shirt: '#E8DCCB', beard: false, headset: true })}`,
);

const hostLight = base(
  '#F7F6F3',
  `.ch{position:absolute;left:18px;top:16px;font-size:7px;color:#888;letter-spacing:.08em}
.hl{position:absolute;left:18px;top:38px;width:320px;color:#111;font-size:24px;font-weight:600;line-height:1.15}
.hl i{font-family:Georgia,'Times New Roman',serif;color:#e63b2e}
.hl span{opacity:0;animation:in 7s infinite}.hl span:nth-child(2){animation-delay:.25s}.hl span:nth-child(3){animation-delay:.5s}
@keyframes in{0%,4%{opacity:0}10%,92%{opacity:1}100%{opacity:0}}
.card{position:absolute;left:22px;top:122px;width:190px;padding:12px;background:#fff;border:4px solid #111;border-radius:12px;box-shadow:6px 6px 0 rgba(0,0,0,.85);animation:pop 7s infinite}
.card small{font-size:6px;color:#999;letter-spacing:.08em}.card b{display:block;font-size:22px;font-weight:900;line-height:1;margin-top:3px;color:#111}.card span{font-size:12px;font-weight:700;color:#111}
.ans{position:absolute;left:22px;top:224px;width:150px;height:44px;background:#fff;border:3px solid #111;border-radius:8px;box-shadow:4px 4px 0 rgba(0,0,0,.85);padding:6px;font-family:Georgia,serif;font-style:italic;font-size:10px;color:#999;animation:pop 7s infinite;animation-delay:.5s}
.ans:after{content:'|';color:#111;animation:cur .8s steps(1) infinite}@keyframes cur{50%{opacity:0}}
.q{position:absolute;left:236px;top:120px;font-size:90px;font-weight:900;color:#e63b2e;text-shadow:5px 5px 0 #111;font-family:Georgia,serif;animation:pop 7s infinite;animation-delay:.9s}
.lbl{position:absolute;left:228px;top:244px;background:#e63b2e;color:#fff;font-size:9px;font-weight:800;padding:4px 8px;border-radius:6px;border:2px solid #111;transform:rotate(-4deg);animation:pop 7s infinite;animation-delay:1.2s}
@keyframes pop{0%,10%{opacity:0;transform:scale(0) rotate(-6deg)}16%{opacity:1;transform:scale(1.1)}20%,92%{opacity:1;transform:none}100%{opacity:0}}
${hostCss}`,
  `<div class="ch mono">// 01 — the question</div>
<div class="hl"><span>which</span> <span><i>database</i></span> <span>for this app?</span></div>
<div class="card"><small class="mono">// THE QUESTION</small><b>Which DB</b><span>for this app?</span></div>
<div class="ans">your answer...</div>
<div class="q">?</div><div class="lbl">INTERVIEW · Q1</div>
${host({ skin: '#F0C7A4', hair: '#1A1A1A', shirt: '#BDE5C8', beard: true, headset: false })}`,
);

// Pixel art: crisp rects on a 6 px grid.
const px = (x: number, y: number, w: number, h: number, c: string) => `<rect x="${x * 6}" y="${y * 6}" width="${w * 6}" height="${h * 6}" fill="${c}"/>`;
const pixelDuo = base(
  '#1B2240',
  `svg{position:absolute;left:0;top:0;shape-rendering:crispEdges}
.top{position:absolute;left:12px;right:12px;top:12px;display:flex;justify-content:space-between;font-size:8px;color:#d0d4e8;letter-spacing:.12em}
.top b{background:#d7ff3a;color:#111;padding:0 3px}
.panel{position:absolute;left:24px;top:40px;width:312px;height:120px;background:#121726;border:3px solid #2c3550;border-radius:6px;padding:10px 12px;animation:snap 8s steps(2) infinite}
.panel .st{display:inline-block;background:#d7ff3a;color:#111;font-size:9px;font-weight:900;padding:2px 6px}
.panel .nm{font-size:30px;font-weight:900;color:#fff;font-family:Impact,'Arial Narrow',sans-serif;letter-spacing:.02em;margin-top:6px;white-space:nowrap;overflow:hidden;width:0;animation:type 8s steps(12) infinite}
.panel .bd span{display:inline-block;border:1.5px solid #2bd47d;color:#2bd47d;font-size:7px;padding:1px 5px;border-radius:7px;margin-right:4px}
@keyframes type{0%,10%{width:0}30%,92%{width:210px}100%{width:0}}
@keyframes snap{0%,4%{opacity:0;transform:scale(.9)}8%,94%{opacity:1;transform:none}100%{opacity:0}}
.aura{position:absolute;left:200px;top:236px;width:130px;height:130px;border-radius:50%;background:radial-gradient(rgba(43,212,125,.55),transparent 68%);animation:aura 2.6s infinite alternate}
@keyframes aura{to{transform:scale(1.15);opacity:.6}}
.face{animation:face 3s steps(1) infinite}@keyframes face{0%,90%{opacity:1}92%,96%{opacity:0}}
.mouthA{animation:mo .5s steps(1) infinite}@keyframes mo{50%{opacity:0}}
.sub{position:absolute;left:20px;top:440px;width:320px;color:#f5f5f5;font-size:15px;font-weight:600;line-height:1.35}
.sub .who{font-size:7px;color:#9fa6c4;letter-spacing:.1em;margin-bottom:4px}.sub .who b{color:#4fd1ff}
.sub i{font-style:normal;color:#4fd1ff}
.star{animation:tw 1.8s steps(1) infinite}@keyframes tw{50%{opacity:.2}}`,
  `<svg width="360" height="640">
  ${px(0, 0, 60, 70, '#1B2240')}
  ${px(6, 28, 48, 24, '#0E1A3A')}${px(6, 28, 48, 1, '#3A4670')}${px(6, 51, 48, 1, '#3A4670')}
  ${px(44, 31, 4, 4, '#FFF4C2')}
  <g class="star">${px(12, 32, 1, 1, '#fff')}${px(30, 30, 1, 1, '#fff')}${px(38, 36, 1, 1, '#fff')}</g>
  ${[8, 13, 18, 23, 28, 33, 38, 43, 48].map((x, i) => px(x, 44 - (i % 3) * 3, 4, 8 + (i % 3) * 3, '#151d38')).join('')}
  ${[9, 19, 29, 39, 49].map((x) => px(x, 46, 1, 1, '#FFD27A')).join('')}
  ${px(0, 66, 60, 8, '#4A2E22')}${px(0, 66, 60, 1, '#6B4330')}
</svg>
<div class="aura"></div>
<svg width="360" height="640">
  ${px(6, 50, 14, 16, '#B8352F')}${px(8, 40, 10, 11, '#8D5A3B')}${px(8, 39, 10, 3, '#1A1A1A')}${px(8, 47, 10, 4, '#1A1A1A')}
  ${px(10, 44, 2, 2, '#fff')}${px(14, 44, 2, 2, '#fff')}${px(11, 45, 1, 1, '#111')}${px(15, 45, 1, 1, '#111')}
  <g class="mouthA">${px(12, 48, 2, 1, '#E8E8E8')}</g>
  ${px(22, 61, 8, 4, '#3AA0E0')}
  ${px(34, 42, 18, 16, '#E8EAF2')}${px(35, 43, 16, 12, '#0B1020')}${px(33, 46, 1, 5, '#9AA2B8')}${px(52, 46, 1, 5, '#9AA2B8')}
  <g class="face">${px(38, 46, 2, 3, '#4FD1FF')}${px(46, 46, 2, 3, '#4FD1FF')}${px(40, 51, 6, 1, '#4FD1FF')}${px(39, 50, 1, 1, '#4FD1FF')}${px(46, 50, 1, 1, '#4FD1FF')}</g>
  ${px(38, 58, 10, 8, '#D8DBE6')}
</svg>
<div class="top mono"><span>■ FREE AI VOICE CLONE</span><span><b>1</b> 2 3</span></div>
<div class="panel"><span class="st mono">STEP 1 / 3</span><div class="nm">VoiceStudio</div><div class="bd mono"><span>OPEN SOURCE</span><span>AGPL-3.0</span><span>₹0</span></div></div>
<div class="sub"><div class="who mono"><b>■ CLAUDE</b> · excited</div>Step one, GitHub pe <i>VoiceStudio</i>. Open source, tumhare computer pe chalta hai.</div>`,
);

const deepBlue = base(
  '#08263A',
  `.bg{position:absolute;inset:0;background:radial-gradient(60% 40% at 50% 40%,rgba(76,125,255,.18),transparent 70%),linear-gradient(160deg,#0b1a3a,#08263a 60%,#0a2e35)}
.p{position:absolute;width:2px;height:2px;border-radius:50%;background:#fff;opacity:.3;animation:drift 9s linear infinite}
@keyframes drift{from{transform:translateY(0)}to{transform:translateY(-80px)}}
.hd{position:absolute;right:14px;top:14px;font-size:8px;color:#8ea2c9}
.t{position:absolute;left:0;right:0;top:50px;text-align:center;color:#f5f8ff;font-weight:900;font-size:30px}.t b{color:#4c7dff}
.glass{position:absolute;left:52px;top:150px;width:256px;height:86px;border-radius:16px;background:rgba(28,45,90,.55);border:1.5px solid rgba(120,160,255,.28);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 20px 40px -20px #000;display:flex;justify-content:center;align-items:center;gap:3px;overflow:hidden}
.col{height:56px;overflow:hidden;font-size:44px;font-weight:700;color:#4c7dff;text-shadow:0 0 14px rgba(76,125,255,.8);line-height:56px;width:28px;text-align:center}
.col div{animation:roll 6s infinite cubic-bezier(.3,1.4,.5,1)}
.gap{width:12px}
@keyframes roll{0%,40%{transform:translateY(0)}50%,95%{transform:translateY(-56px)}100%{transform:translateY(0)}}
.ring{position:absolute;left:150px;top:262px;width:60px;height:60px;border-radius:50%;background:conic-gradient(#4c7dff var(--a,360deg),#1e2b4f 0);animation:drain 6s linear infinite;display:flex;align-items:center;justify-content:center}
.ring:before{content:'';position:absolute;inset:6px;border-radius:50%;background:#0b1f3a}
.ring span{position:relative;color:#fff;font-size:13px;font-weight:700}
@property --a{syntax:'<angle>';inherits:false;initial-value:360deg}
@keyframes drain{from{--a:360deg}to{--a:0deg}}
.bars{position:absolute;left:110px;top:340px;display:flex;gap:4px}.bars i{width:18px;height:12px;border-radius:2px;background:#4c7dff}.bars i:nth-child(n+6){background:#1e2b4f}
.key{position:absolute;left:46px;top:262px;width:44px;height:20px;animation:float 3s ease-in-out infinite alternate}
@keyframes float{to{transform:translateY(-6px)}}
.sub{position:absolute;left:0;right:0;top:452px;text-align:center;font-size:15px;font-weight:600;color:#f5f8ff}
.sub span{position:relative;color:rgba(245,248,255,.45)}.sub span.on{color:#f5f8ff}
.sub span.on:after{content:'';position:absolute;left:0;right:0;bottom:-3px;height:2px;background:#2ee6c5;animation:ul 6s infinite}
@keyframes ul{0%,30%{transform:scaleX(0)}38%,100%{transform:scaleX(1)}}
.prog{position:absolute;left:96px;right:96px;top:480px;border-top:1.5px dashed #2ee6c5;opacity:.6}`,
  `<div class="bg"></div>${Array.from({ length: 22 }, (_, i) => `<div class="p" style="left:${(i * 47) % 356}px;top:${120 + ((i * 71) % 480)}px;animation-delay:-${i % 9}s"></div>`).join('')}
<div class="hd">@yourhandle</div>
<div class="t">One <b>mistake</b></div>
<div class="glass mono">${['8', '7', '2', ' ', '9', '2', '1'].map((d, i) => (d === ' ' ? '<div class="gap"></div>' : `<div class="col"><div style="animation-delay:${i * 0.05}s">${d}<br>${'3091240'[i]}</div></div>`)).join('')}</div>
<svg class="key" viewBox="0 0 44 20"><circle cx="9" cy="10" r="8" fill="#F5B83D"/><circle cx="9" cy="10" r="3" fill="#0b1f3a"/><rect x="15" y="8" width="26" height="4" fill="#F5B83D"/><rect x="34" y="12" width="3" height="5" fill="#F5B83D"/><rect x="28" y="12" width="3" height="4" fill="#F5B83D"/></svg>
<div class="ring"><span>30s</span></div>
<div class="bars">${'<i></i>'.repeat(8)}</div>
<div class="sub"><span class="on">New</span> <span class="on">every</span> <span>30 seconds</span></div><div class="prog"></div>`,
);

export const REF_STYLE_SAMPLES = {
  'spotlight-noir': spotlightNoir,
  'night-3d': night3d,
  'system-terminal': systemTerminal,
  'host-dark': hostDark,
  'host-light': hostLight,
  'pixel-duo': pixelDuo,
  'deep-blue': deepBlue,
} as const;
