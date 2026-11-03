-- Motion Mind schema. Supabase is the database only (no Supabase Auth).
-- The API server (service_role) is the only thing that reads or writes. Every table has
-- Row Level Security on with no policies, and the browser roles (anon, authenticated) have no grants.

create schema if not exists extensions;
create extension if not exists citext with schema extensions;

-- Future tables and functions in public are closed to the browser roles too.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- ---------- helpers ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- ---------- accounts (email one-time-code sign-in) ----------
create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null unique,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

-- One pending code per email. Only an HMAC of the code is stored.
create table public.login_codes (
  email extensions.citext primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts smallint not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references public.app_users (id) on delete cascade,
  handle extensions.citext unique,
  display_name text check (char_length(display_name) <= 60),
  channel_name text check (char_length(channel_name) <= 60),
  niche text check (char_length(niche) <= 60),
  language text not null default 'hinglish' check (language in ('en', 'hi', 'hinglish')),
  avatar_url text,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint handle_format check (
    handle is null
    or (handle::text ~ '^[a-z0-9._]{3,30}$' and handle::text !~ '\.\.' and handle::text !~ '^\.' and handle::text !~ '\.$')
  ),
  constraint handle_not_reserved check (
    handle is null
    or lower(handle::text) not in ('admin','api','app','auth','help','login','logout','settings','signup','support','root','system','www')
  )
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- projects ----------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.app_users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  topic text check (char_length(topic) <= 500),
  stage text not null default 'topic'
    check (stage in ('topic','research','script','storyboard','graphics','voice','final')),
  status text not null default 'draft' check (status in ('draft','in_progress','completed','archived')),
  quality_tier text not null default 'standard' check (quality_tier in ('draft','standard','premium','cinematic')),
  duration_sec integer not null default 60 check (duration_sec in (15, 30, 45, 60, 90)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_owner_updated_idx on public.projects (owner_id, updated_at desc);

create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------- provider API keys (AES-256-GCM, encrypted by the API) ----------
create table public.provider_credentials (
  user_id uuid not null references public.app_users (id) on delete cascade,
  provider text not null
    check (provider in ('openai','anthropic','tavily','exa','elevenlabs','replicate','google_tts')),
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  key_version smallint not null default 1,
  last4 text not null check (char_length(last4) <= 4),
  last_tested_at timestamptz,
  last_test_ok boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

create trigger provider_credentials_updated_at before update on public.provider_credentials
  for each row execute function public.set_updated_at();

-- ---------- lock the browser out ----------
alter table public.app_users enable row level security;
alter table public.login_codes enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.provider_credentials enable row level security;

revoke all on public.app_users, public.login_codes, public.profiles, public.projects, public.provider_credentials from anon, authenticated;
