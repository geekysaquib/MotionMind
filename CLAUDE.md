# Motion Mind: context for Claude

Motion Mind is an AI studio that turns a topic into a researched, animated Instagram explainer reel (1080x1920). The flow per project: topic, research, style, script, storyboard, voice, animate, final. **Phase 1 is built:** email-code accounts, handles, onboarding, dashboard, project library, a route for every stage, Claude and ElevenLabs connectors on server keys. Every stage is built: Research, Style, Script, Storyboard, Voice, Animate, Reel editor and Export, each using the server's keys, plus a claude.ai copy-paste route for Research and Script for people with only a Claude subscription.

Owner: Saquib. Read this file first, then `HANDOFF.md` (what's done, what's next) and the README for setup steps.

## Decisions that are already made (don't undo without asking)

- **The app runs locally.** Saquib runs it on his own machine: the API on :8787 and the web app on :5173 (`npm run dev`). There is no deployment: Netlify was dropped on 2026-11-05 and its files were removed. MP4 export renders on the same machine (HyperFrames needs Chrome and minutes of CPU). If hosting comes back, start from the git history before that date.
- **No Supabase Auth.** Sign-in is a 6-digit code emailed over SMTP (Gmail with an app password). Our API issues HS256 session tokens signed with `AUTH_SECRET`. A first sign-in creates the account.
- **Supabase is the database only.** The project is **motion-mind** (`dxmtfsmdfncrrwwcxpzj`, Mumbai). Never use OrbitDev. The browser never talks to Supabase. Every table has RLS on with no policies and no grants for `anon`/`authenticated`. Only the API, with the service_role key, reads or writes.
- **One `package.json` and one `.env`, both at the repo root.** There are no npm workspaces, and every command runs from the root.
- Changes to the live Supabase database (migrations) need Saquib's explicit OK first.

## Layout

```
MotionMind/
├── frontend/                 React 18 + Vite + Tailwind + MobX + React Router
│   ├── src/
│   │   ├── main.tsx          picks services (api or memory), creates RootStore
│   │   ├── App.tsx           all routes
│   │   ├── config.ts         VITE_* settings
│   │   ├── services/         talking to the outside world
│   │   │   ├── http.ts       apiRequest(): the one fetch wrapper, throws ServiceError
│   │   │   ├── api.ts        real mode: auth, profiles, projects via the API
│   │   │   ├── claudeHttp.ts Claude, research, script, storyboard, connectors, voice and export calls
│   │   │   ├── memory.ts     demo mode: data in localStorage, code is always 123456
│   │   │   └── types.ts      service interfaces + ServiceError
│   │   ├── stores/           MobX: RootStore owns Auth/Profile/Project/Toast stores
│   │   ├── pages/            auth/ (Login, Onboarding) and app/ (dashboard, library, project stages, settings)
│   │   ├── layout/           AppShell, AuthLayout, guards (RequireAuth, RequireOnboarded, GuestOnly)
│   │   ├── components/       ui/ (Button, Card, Field, Alert, Badge, Select, Spinner), Logo, Toasts, ErrorBoundary
│   │   ├── lib/              logger (UI logs), cn, format (errorText, timeAgo), theme
│   │   └── test-utils.tsx    makeStore() + renderWithStore() for page tests
│   └── vite.config.ts        alias for @motionmind/shared, envDir = repo root, /api proxy to :8787
├── backend/
│   ├── src/
│   │   ├── server.ts         local entry: loadEnv, then listen on PORT
│   │   ├── bootstrap.ts      env -> dependencies (Supabase or memory, SMTP or console mailer)
│   │   ├── app.ts            buildApp(deps): CORS, /health, public /api/auth/*, signed-in /api/*
│   │   ├── env.ts            zod-validated env (empty values count as unset)
│   │   ├── http.ts           firstIssue(): zod error -> message for the UI
│   │   ├── auth/             routes (request-code, verify-code), otp, session tokens, mailer, verifiers
│   │   ├── account/          routes: /profile, /handles/:h/available, /projects CRUD
│   │   ├── ai/               Copy-paste prompts and importers for Research, Script, Style (no API key): routes.ts, reelPrompt.ts, animationPrompt.ts, rulebooks/
│   │   ├── voice/            ElevenLabs voiceover per beat; AudioStore (Supabase Storage bucket `voice` or memory)
│   │   ├── animation/        Animate step: claude.ai prompt with timings + rulebook, import Claude's HyperFrames HTML
│   │   ├── export/           MP4 render: HyperFrames CLI + FFmpeg (local server only) + /api/renders download
│   ├── footage/          Edit raw footage: FootageStore (folders on disk), FFmpeg/whisper.cpp runner, ASS captions, routes
│   │   ├── logs/             POST /api/client-logs: browser warnings/errors into the server log
│   │   ├── data/             DataRepository: users, login codes, profiles, projects (Memory + Supabase)
│   │   └── app.test.ts       API tests via app.inject() (each folder also has its own *.test.ts)
├── shared/src/               used by both sides: brand, handle rules, project types/STAGES
├── supabase/
│   ├── migrations/           20261103000000_init.sql = the whole schema (reset on 2026-11-03); add new files after it
│   └── test/                 run.sh: applies migrations to a throwaway Postgres (Linux only)
├── scripts/                  setup.mjs (creates .env + secrets), dev.mjs (runs API + web together)
├── brand/                    logo files
├── package.json              every dependency and command
├── tsconfig.base.json        shared TS options + paths alias @motionmind/shared -> shared/src
├── jest.config.js            Jest projects: frontend (jsdom), backend (node), shared (node); TS via SWC, ESM
└── test/                     Jest support: jsdom env with fetch/crypto, cookie shim, quiet app logs
```

## How a request flows

Browser, then `services/api.ts`, then `apiRequest()`, then `/api/...` (same origin; Vite proxies it to the API on :8787). Then Fastify `buildApp`. For signed-in routes, the `onRequest` hook verifies the bearer token and sets `req.userId`. Then the route handler validates with zod, calls a repository, and the Supabase service-role client does the query.

Every route only ever reads or writes rows for `req.userId`. Repositories take `userId`/`ownerId` as the first argument. Keep it that way.

## Claude and the reel engine

- **Claude runs only in claude.ai, by copy and paste** (Saquib, 2026-11-10: copy-paste only; the API-key mode, ElevenLabs, the free Edge voice, Settings → Connectors and the AI-mode switch were removed that day and are in git history). The server has no Anthropic or ElevenLabs key and no SDK. Every stage that needs Claude gives a prompt to copy and takes the answer pasted back.
- Scripts are made **by copy and paste through claude.ai** (Saquib, 2026-11-09: every reel by copy paste): `GET /projects/:id/script/prompt?style=` gives the prompt with the JSON schema and `POST /projects/:id/script/import {text, style}` validates and saves the pasted answer (`ai/reelPrompt.ts`, `PasteScriptPanel.tsx`). The prompt is written for an **Indian audience** (natural Hinglish/Hindi/English, Indian examples, ₹, lakh/crore, a 2-second hook, one idea per beat, facts only from approved research, a self-check before answering). `POST /projects/:id/script` (Write with Claude, server key) still exists for key mode.
- Research: `GET /projects/:id/research/prompt` + `POST .../research/import` for claude.ai. Saved as `projects.research` (`ResearchReport`: summary, facts with status + source indexes, sources). `POST .../research/approve` sets `approvedAt`; only approved research is passed into the script prompt.
- Storyboard: `PUT /projects/:id/script` saves the user's scene edits (sets `editedAt`).
- **Claude writes every reel; Motion Mind has no reel engine** (Saquib, 2026-11-09: "no hardcoded engine", "every reel by copy paste"; the Remotion engine, its style kits and scene composer were removed that day and are in git history). Flow: Topic, Research, **Style**, Script, Storyboard, Voice, **Animate**, Reel editor, Export. The **style** (`script.style`, `STYLE_IDS`/`STYLES` in `shared/src/styles.ts`: `live-map`, `whiteboard`, `dark-keynote`, `transit-map`, `newsroom`) only picks the **rulebook** Claude animates with: `backend/src/ai/rulebooks/<id>.md` (four from LemoLab's lemo-opuscar, MIT, `LICENSE-lemo-opuscar.txt`; their engine sections removed; Live Map is ours). It is picked before the script (kept in the browser by `lib/pickedStyle.ts` until a script exists, `PUT /projects/:id/style` after). The **Animate** step (`AnimateStagePage.tsx`, routes in `backend/src/animation/routes.ts`): `GET /projects/:id/animation/prompt` builds the claude.ai prompt (`ai/animationPrompt.ts`: the script, the exact start/end of every scene and every word from `reelTimeline()` in `shared/src/animation.ts`, short forms, brand logo URLs on this API, the full rulebook, a premium quality bar, and the HyperFrames contract: one HTML file, `#root[data-composition-id=main]`, `section.clip[data-start][data-duration]` per scene, one paused GSAP timeline in `window.__timelines["main"]`, deterministic, GSAP from jsdelivr only). The user pastes Claude's answer; `POST .../animation/import` runs `extractAnimation` (finds the HTML in the answer, checks the contract, allows scripts only from jsdelivr/cdnjs/unpkg and links only to Google Fonts, refuses fetch/storage) and saves `script.animation` (`ReelAnimation`: html, style, timingKey, writtenAt; no migration). `GET .../animation` returns it with the timeline and `stale` when the voice changed since (`timingKey`). The browser plays it in a sandboxed iframe (`HtmlReelPlayer.tsx`, `sandbox=allow-scripts`, a small bridge seeks the timeline and shows each clip only in its time, like the HyperFrames runtime; GSAP served locally from `/api/static/gsap.min.js`), with the voice clips (`AnimationPreview.tsx`, used on Script, Storyboard, Voice and Reel editor too).
- **Voice is only the user's own recording** (Saquib, 2026-11-10). They upload one file (`POST /projects/:id/audio/voice`, raw body, magic-byte sniffed in `editor/audioFormat.ts`, max 40 MB / 5 min). **Auto-fit** (`POST /projects/:id/voice/fit`, `editor/routes.ts` + `shared/src/alignScript.ts`): whisper.cpp hears the words (`footage.tools.transcribe`; clipped to where the waveform is loud by `clipToLoud`, because whisper's times bleed into pauses) or, without it, `runsFromPeaks` finds speech from the loudness. First choice: `alignBySentences` (`shared/src/alignScript.ts`): text-to-speech pauses after every sentence and a scene always ends at a sentence end, so sentences are matched to the pauses in order (by length, allowing a closing line after the script). If the recording has too few pauses, or when whisper heard the words, `sceneStartsFromWords` (`shared/src/alignWords.ts`) matches them to the script's words in order (`matchWords`, tolerant of misspellings and of Devanagari) and starts each scene where its first word is spoken, so text-to-speech with no pauses between scenes still fits; `placeWords` then lays the words over the speech. Without that, `alignScript` picks the scene breaks in the pauses (dynamic programming against each scene's share of the speech) and lays every script word over the speech (`placeWords`). Saved in `projects.editor.upload` as `cuts`, `wordTimes`, `fitKey` (`narrationKey` of the narration, to spot a stale fit), `fit` and `speech`. The browser re-places the words when the user drags a break (`placeWords` on `speech`) and saves with PUT /editor. `attachVoice` in `frontend/src/lib/editorActions.ts` uploads, saves, then fits.
- Voice page (`VoiceStagePage.tsx`; the old Reel editor page is gone and `/editor` redirects to `/voice`): what to record (`NarrationScript`, with the closing line from `lib/closing.ts`), upload + fit status + `Timeline` (drag breaks, trim, closing line marker) + optional looping music. `ReelEditor = { upload, music }` in `shared/src/editor.ts` (`normalizeEditor` drops the old pace, caption, sfx and voiceSource fields). `reelTimeline(script, editor)` takes scene times from the breaks and word times from `wordTimes` when `fitKey` matches (source `recording`), else estimates (source `estimate`). Export lays the trimmed recording under the video, plus the looping music.
- Export: `POST /projects/:id/export` needs `script.animation`. `export/hyperframes.ts` (the video kit's pipeline): writes the composition into `renders/hf-<job>/` with a local GSAP (`localizeGsap`), runs the **HyperFrames CLI** (`hyperframes render --quality delivery --fps 30`, dependency `hyperframes@0.9.17`, headless Chrome), downloads the audio clips (`htmlRenderFor` in `export/routes.ts`: voice clips at their scene times, or the trimmed recording, plus music), and FFmpeg (`muxArgs`: adelay per clip, amix, loudnorm -14 LUFS, video copied, faststart) writes `renders/<job>.mp4`, served at `/api/renders/<uuid>.mp4`. A background job polled by `GET .../export` (status bundling, rendering, finishing, done). `HyperFramesRenderer` in `export/renderer.ts`; without a renderer (tests) the routes answer 501. A one-minute reel takes a few minutes on this PC.
- **Deleting a project deletes its files** (Saquib, 2026-11-11): `DELETE /projects/:id` (`account/routes.ts`) removes the row, then `audio.removeFolder(<userId>/<projectId>)` (everything in the `voice` bucket under that folder) and `renderer.removeProject` (finished MP4s and covers on this machine). Cover images are tracked by project (`Renderer.still(html, at, projectId)`). Any new place that stores a project's files must be cleaned there too. Raw-footage edits are not tied to projects.
- **Every copy-paste prompt takes the creator's own instructions** (`ClaudeAiPanel` note box → `?note=` on the research, script, animation and trending prompt routes → `ai/promptNote.ts` appends them as "EXTRA INSTRUCTIONS FROM THE CREATOR"). The Voice page's **Language** menu (`NarrationScript.tsx`, `lib/translate.ts`) makes a translate prompt for any language, takes the pasted answer, and can replace the narration with it. The Style page shows a looping CSS-only preview per style (`components/styleSamples.ts`, `StyleSample.tsx`, sandboxed iframe, no scripts).
- Short forms and brands: the script carries `glossary` ({short, full}) and `brands` ({name, domain}) (inside the script JSON; the script prompt makes Claude list every abbreviation and company). The Animate prompt passes them on, with each logo as `<api>/api/logo/<domain>?name=` (`backend/src/logo/routes.ts`: Google/DuckDuckGo favicon services only, a monogram tile when none has it). Storyboard has `TermsEditor`.
- Platforms: a project makes reels for Instagram Reels, YouTube Shorts or both (`projects.platforms`, `Platform`/`PLATFORMS`/`normalizePlatforms` in `shared/src/projects.ts`; default both; migration `20261105000100_project_platforms.sql`, needed only to save a single platform). The Animate prompt's end card says follow, subscribe or both. Export runs one job per platform (`POST /projects/:id/export {platform}`, jobs keyed user:project:platform, `GET` returns `jobs`); both get the same video. Picker: `components/PlatformPicker.tsx`.
- Cover (thumbnail): a frame of Claude's animation, 80% into the chosen scene (`CoverSettings.scene` in `shared/src/cover.ts`, saved as `script.cover` with `PUT /projects/:id/cover`), taken by `hyperframes snapshot` (`Renderer.still(html, at)`, `snapshotHtml`) via `POST /projects/:id/cover/render`, served as `/api/renders/<uuid>.png`. `CoverMaker.tsx` on the Export page. The other cover fields (headline, layout, size) are kept in the type but no longer drawn.
- A project's script is `projects.script` (jsonb) with the `ReelScript` shape in `shared/src/projects.ts` (beats with narration and a card: eyebrow, headline, tone, rows; plus style, cover, animation). Old scripts with 3D fields (`world`, `theme`, `template`, `layout`, `scene`, `shot`, `visual`) still load: the zod schemas drop them.
- **Edit raw footage** (`/app/footage`, sidebar "Raw footage"; from the starter kit Saquib shared on 2026-11-05): a second flow beside topic-to-reel. The user uploads a clip they filmed (`POST /api/footage`, body `video/*` streamed to disk, max 1 GB / 20 min); a background job probes it (FFprobe), finds every pause (`silencedetect` at 0.1 s, so the page can re-cut at any longer pause without FFmpeg) and writes down the words with whisper.cpp (`whisper-cli -ml 1 -sow -oj`); `speechSegments` in `shared/src/footage.ts` turns pauses into takes. The page (`FootageEditPage.tsx`) is the storyboard: each take with its words, keep/drop, pause length, breathing room, silence threshold (re-runs the analysis), caption on/off and position, "play only the kept takes". Export needs an approved storyboard and runs FFmpeg (`filterGraph` in `footage/tools.ts`: trim + concat the kept takes, fill 1080x1920, burn word-by-word ASS captions from `captions.ts`, loudnorm to -14 LUFS, H.264). Edits are folders on this machine, not database rows (`footage/<editId>/edit.json` + clip + exports, `FootageStore`, git-ignored, `FOOTAGE_DIR` moves it), so no migration. Files are served publicly by the unguessable edit id with Range support (`/api/footage-files/:id/:file`). Tools come from PATH or `FFMPEG_BIN`, `FFPROBE_BIN`, `WHISPER_CPP_BIN` + `WHISPER_MODEL`, `YTDLP_BIN`; `GET /api/footage/tools` reports which are ready. Without whisper.cpp the clip is still cut, with no captions. Not built yet: brand sheet from reference videos (yt-dlp), music, Remotion motion graphics over the footage.

## Sign-in

1. `POST /api/auth/request-code {email}`: stores an HMAC of the code (`login_codes`), emails it, and allows one resend per 30 s.
2. `POST /api/auth/verify-code {email, code}`: the code expires in 10 min and allows 5 tries. On success it upserts `app_users`, ensures a `profiles` row, and returns `{ token, user }`.
3. The web app stores `{userId, email, accessToken}` in localStorage (`motionmind-session`). Any 401 signs the user out.
4. Without `SMTP_HOST`, `ConsoleMailer` prints the code in the API terminal.

## Commands (always from the repo root)

| Command | What it does |
|---|---|
| `npm install` | everything, including the HyperFrames CLI |
| `npm run setup` | creates `.env` from `.env.example`, generates `AUTH_SECRET`, lists what's missing |
| `npm run dev` | API on :8787 + web on :5173 together (`dev:api` / `dev:web` for one side) |
| `npm run typecheck` | tsc for shared, backend, frontend |
| `npm test` | Jest, all three projects. One project: `npm test -- --selectProjects backend`. One file: `npm test -- LoginPage` |
| `npm run test:watch` / `npm run test:coverage` | watch mode / coverage report in `coverage/` |
| `npm run build` | typecheck, then `vite build frontend` into `frontend/dist` |

## Environment (`.env` at the root, template `.env.example`)

- API: `API_DATA_MODE` (`supabase` | `memory`), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET`, `SMTP_HOST/PORT/USER/PASS/FROM`, `PORT`, `WEB_ORIGIN`.
- Web: `VITE_DATA_MODE` (`api` | `memory`). Only `VITE_*` values reach the browser, so never prefix a secret with `VITE_`. `VITE_API_URL` is optional; leave it unset to use the same origin.
- Changing `AUTH_SECRET` signs everyone out.

## Conventions

- **Validate at the edge.** Every route parses `req.body`/`params` with zod and answers `400 { error, message }` using `firstIssue()`. `message` is shown to users as-is, so write it as a plain sentence.
- **Error shape:** `{ error: 'snake_code', message: 'Human sentence.' }`. Unknown errors become 500 with a generic message, and details go to the log.
- **Storage behind interfaces.** Each repository has a `Memory*` version (tests, demo mode) and a `Supabase*` version. Add a method to both.
- **Wiring through `AppDeps`.** New services are added to `AppDeps`, built in `bootstrap.ts`, and passed in tests from `app.test.ts`'s `setup()`.
- **Frontend data:** pages call stores, stores call `root.services.*`, and services call `apiRequest`. Pages never call fetch directly. Show errors with `errorText(err)`.
- **Shared rules** (handles, stages, reel script shape, brand name) live in `shared/src` and are imported as `@motionmind/shared`. Don't duplicate them.
- **Motion:** shared pieces live in `components/motion.tsx` (`Reveal` on-scroll fade-in, `CountUp`, `ProgressRing`, `Typewriter`), with keyframes in `tailwind.config.js` and helpers (`.text-gradient`, `.orb`, `.reveal`, `.draw`) in `index.css`. Everything stops under `prefers-reduced-motion`. Project progress for the stepper, rings and "Continue" comes from `lib/progress.ts` (`STAGE_INFO` also holds each step's explanation and tip). To check a design change without a browser tab: run the app in demo mode (`VITE_DATA_MODE=memory npx vite frontend --port 5199`) and use a headless Chrome screenshot script.
- **Look (redesigned 2026-11-11):** a dark studio theme by default (near-black cool surfaces, `data-theme='light'` for the light one; saved as `mm-theme`), one violet accent plus the brand gradient (`.bg-brand` for main buttons, `.text-gradient` for key words, `.aurora` and `.grid-bg` behind hero and auth pages, `.canvas-glow` behind the app). Fonts: Bricolage Grotesque (display) and Plus Jakarta Sans (text). Cards are `rounded-2xl`, buttons `rounded-xl`, the top call to action a pill. The Tailwind colour named `mint` is the brand purple (historical name), `text-accent` is its text version, and success states use emerald (dark-mode overrides for emerald/amber/violet text live in `index.css`). Layout follows a workspace pattern: white sidebar (New reel, nav, Recent, AI mode card, user), breadcrumb top bar, and on a project a vertical steps card beside the stage content (`pages/app/ProjectLayout.tsx`). Segmented controls (library filters, settings tabs) are a grey pill with a white selected tab. Empty stages use `components/EmptyState.tsx`. Discover (`pages/app/DiscoverPage.tsx`) has a **Trending now** tab (`TrendingPanel.tsx`, backend `backend/src/discover/`): Wikipedia's public most-read pages for yesterday (English or Hindi, cached an hour, adult and obituary-list pages filtered out, falls back to the day before), plus reel ideas Claude makes from them, by the server key (`POST /discover/ideas`) or copy and paste (`GET /discover/prompt` + `POST /discover/import`), saved in localStorage; the other tabs are curated starter ideas. All ideas open the new-reel form with `?new=1&topic=`. To screenshot pages that need a real script, run the API in memory mode on a spare port (`PORT=8799 API_DATA_MODE=memory`, no `.env`, codes print in its log) and point Vite at it with the same `PORT`. Don't add cream or beige: that was the old theme.
- **Styling:** use the Tailwind tokens in `frontend/tailwind.config.js` (`ink-*`, `line`, `accent`, `danger`, `mint`, …) and the `components/ui` pieces. Theme values are CSS variables in `index.css`, with light and dark both supported.
- **Copy:** product name from `BRAND.name`. The UI language is plain, and nothing pretends to work when it doesn't.
- **Tests (Jest):** import `describe/it/expect/jest` from `@jest/globals`, since there are no globals. Put tests next to the code as `*.test.ts(x)`. Add an `app.inject()` test for each new route, and a page test (`renderWithStore`, Testing Library) or store/service test for each new frontend flow. Keep `npm run typecheck && npm test && npm run build` green before committing.
- **UI logs:** use `log.info/warn/error(scope, message, data)` from `frontend/src/lib/logger.ts` for anything that helps explain a problem later (user actions, failures, unexpected states). API calls, page changes, crashes, toasts with errors and uncaught errors are logged automatically. Sensitive keys (token, apiKey, code, password, secret) are redacted. Never log request bodies. Users see the log in **Settings → Diagnostics**. Warnings and errors are batched to `/api/client-logs` and appear on the server as `[client-log] {...}` lines.

## Adding a feature (checklist)

1. Types and rules both sides need go in `shared/src` (export from `index.ts`).
2. Schema changes go in a new file in `supabase/migrations/` (timestamped). Enable RLS, add no policies, and revoke from `anon, authenticated`. Update `supabase/test/rls-test.sql`. Ask before applying to motion-mind.
3. Backend: add the repository methods (Memory + Supabase), a `routes.ts` in the feature folder, and register it in `app.ts`. Add tests.
4. Frontend: add the service method in `services/api.ts` (+ `memory.ts` for demo mode), the store, and the page. Add the route in `App.tsx`.

## Gotchas

- Windows dev machine, PowerShell 5.1: `Set-Content -Encoding utf8` writes a BOM, which breaks JSON. Write files with the editor tools, or `[IO.File]::WriteAllText`.
- Vite, PostCSS and Tailwind configs use paths relative to their own files (`import.meta.url`), because commands run from the root.
- HyperFrames uses its own headless Chrome; renders of one user wait for each other (its render lock).
