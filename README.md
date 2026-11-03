# Motion Mind

AI studio for researched, animated explainer reels. This is Phase 1: accounts, handles, dashboard, projects, routes for every stage, and encrypted API-key settings.

## Stack

- `apps/web`: React 18 + TypeScript + Vite + Tailwind CSS + MobX + React Router, Supabase Auth
- `apps/api`: Node.js + Fastify + TypeScript. Stores provider API keys (AES-256-GCM) and tests them
- `packages/shared`: types, handle rules, provider list, brand name
- `supabase/migrations`: database schema with Row Level Security
- `brand/`: logo files

## 1. Supabase setup

The Supabase project **motion-mind** (`dxmtfsmdfncrrwwcxpzj`, Mumbai) is already created with both migrations applied, and its URL and publishable key are filled in `apps/web/.env.example`. You still need steps 3 and 4 below (auth URLs and the server-only service_role key). For a fresh project, do all of these:

1. Create a project at https://supabase.com.
2. Open **SQL Editor**, run each file in `supabase/migrations/` in order (or `supabase db push` with the CLI).
3. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:5173` (your real domain in production)
   - Redirect URLs: `http://localhost:5173/auth/callback` and `http://localhost:5173/reset-password`
4. **Project Settings → API**: copy the Project URL, the `anon` public key and the `service_role` key. The service_role key is for the API server only; never put it in the web app.

## 2. Configure

```bash
cp apps/web/.env.example apps/web/.env.local   # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL
cp apps/api/.env.example apps/api/.env         # SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, KEY_ENCRYPTION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # paste as KEY_ENCRYPTION_SECRET
```

Keep `KEY_ENCRYPTION_SECRET` safe. If it is lost, saved API keys can't be decrypted and must be re-entered.

## 3. Run

```bash
npm install
npm run dev:api    # http://localhost:8787, reads apps/api/.env
npm run dev:web    # http://localhost:5173
```

### Demo mode (no Supabase)

Set `VITE_DATA_MODE=memory` (web) and `API_DATA_MODE=memory` (API). Accounts and projects stay in the browser, keys stay in API memory, and a yellow banner says so. Development only.

## 4. Checks

```bash
npm run typecheck
npm test                    # handle rules, API key storage/encryption/auth, MobX store flows
bash supabase/test/run.sh   # applies the migration to a throwaway Postgres and tests RLS (run as a non-root user)
npm run build
```

## Routes

| Route | Screen |
|---|---|
| `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/callback` | Accounts: password, email link, reset |
| `/onboarding` | Handle + channel setup (required before the app) |
| `/app` | Dashboard |
| `/app/discover` | Topic discovery (next module) |
| `/app/library` | Project library |
| `/app/projects/:id` + `/research`, `/script`, `/storyboard`, `/graphics`, `/voice`, `/editor`, `/export` | Project workspace by stage |
| `/app/settings`, `/app/settings/keys`, `/app/settings/account` | Profile & handle, API keys, account |

Stages that are not built yet say so plainly and have no fake buttons.

## Reel engine (prototype)

`packages/reel-engine` is the Remotion "World mode" renderer used for the Where is my Train test reel. It is kept outside the npm workspaces for now (its own `npm install`); it will be wired into the app in Phase 3.
