# Motion Mind

AI studio for researched, animated explainer reels. This is Phase 1: accounts, handles, dashboard, projects, routes for every stage, and encrypted API-key settings.

## Stack

- `frontend`: React 18 + TypeScript + Vite + Tailwind CSS + MobX + React Router. Talks only to our API
- `backend`: Node.js + Fastify + TypeScript. Email one-time-code sign-in (SMTP), sessions, profiles, projects, and provider API keys (AES-256-GCM)
- `shared`: types, handle rules, provider list, brand name
- `supabase/migrations`: database schema. Supabase is the database only (no Supabase Auth), and every table is locked to the API server
- `brand/`: logo files

```
MotionMind/
├── frontend/            React web app (Vite)
├── backend/             Fastify API server
│   └── reel-engine/     Remotion video renderer
├── package.json         The only package.json: every dependency and command
├── shared/              Types and rules used by both
├── supabase/            Database migrations and tests
└── brand/               Logos
```

## 1. Supabase setup

The Supabase project **motion-mind** (`dxmtfsmdfncrrwwcxpzj`, Mumbai) is already created. You need its server-only service_role key (step 3). For a fresh project, do all of these:

1. Create a project at https://supabase.com.
2. Open **SQL Editor**, run each file in `supabase/migrations/` in order (or `supabase db push` with the CLI).
3. **Project Settings → API**: copy the Project URL and the `service_role` key into the root `.env`. The service_role key is for the API server only; never put it in the web app.

## 2. Configure

```bash
cp .env.example .env   # one file for everything: API, web app (VITE_*) and reel engine
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # run twice: KEY_ENCRYPTION_SECRET and AUTH_SECRET
```

Keep `KEY_ENCRYPTION_SECRET` safe. If it is lost, saved API keys can't be decrypted and must be re-entered. Changing `AUTH_SECRET` signs everyone out.

### Sign-in emails (SMTP)

Sign-in is a 6-digit code sent by email, and a first sign-in creates the account. Fill in `SMTP_*` in `.env`. For Gmail, turn on 2-Step Verification, create an **App password** (Google Account → Security → App passwords), then set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=you@gmail.com` and `SMTP_PASS=<the 16-character app password>`. While `SMTP_HOST` is empty, codes are printed in the `npm run dev:api` terminal instead.

## 3. Run

```bash
npm install
npm run dev:api    # http://localhost:8787, reads .env
npm run dev:web    # http://localhost:5173
```

## Deploy to Netlify

`netlify.toml` sets up a single site. The web app is served from `frontend/dist`, and the API runs as a Netlify Function (`backend/netlify/functions/api.ts`) on the same domain at `/api/*`, so you don't need CORS or `VITE_API_URL`.

1. In Netlify, choose **Add new site → Import from Git** and pick this repo. The build settings come from `netlify.toml`.
2. Under **Site configuration → Environment variables**, add:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `KEY_ENCRYPTION_SECRET`, `AUTH_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (all secret, all for the API). Use the same `KEY_ENCRYPTION_SECRET` as local if you want keys you've already saved to keep working.

The web app needs no environment variables on Netlify.

`backend/reel-engine` does not run on Netlify. Remotion rendering needs Chromium, ffmpeg and minutes of compute, which is beyond Netlify Function limits. In Phase 3 it will run on Remotion Lambda or a separate render worker, and the Netlify API will hand jobs to it.

### Demo mode (no database)

Set `VITE_DATA_MODE=memory` (web) and `API_DATA_MODE=memory` (API). Accounts and projects stay in the browser, keys stay in API memory, and a yellow banner says so. No email is sent, and the sign-in code is always `123456`. Development only.

## 4. Checks

```bash
npm run typecheck
npm test                    # handle rules, email-code sign-in, profiles/projects, API key encryption, MobX store flows
bash supabase/test/run.sh   # applies the migrations to a throwaway Postgres and checks browser roles are locked out (Linux, non-root)
npm run build
```

## Routes

| Route | Screen |
|---|---|
| `/login` (`/signup` redirects here) | Email, then a 6-digit code. Signs in, or creates the account on first use |
| `/onboarding` | Handle + channel setup (required before the app) |
| `/app` | Dashboard |
| `/app/discover` | Topic discovery (next module) |
| `/app/library` | Project library |
| `/app/projects/:id` + `/research`, `/script`, `/storyboard`, `/graphics`, `/voice`, `/editor`, `/export` | Project workspace by stage |
| `/app/settings`, `/app/settings/keys`, `/app/settings/account` | Profile & handle, API keys, account |

Stages that are not built yet say so plainly and have no fake buttons.

## Reel engine (prototype)

`backend/reel-engine` is the Remotion "World mode" renderer used for the Where is my Train test reel. Its dependencies are in the root `package.json`; run it with `npm run reel:tts` and `npm run reel:render -- video out` from the repo root. It will be wired into the app in Phase 3.
