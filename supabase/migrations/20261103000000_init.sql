-- Motion Mind: accounts, handles, projects, provider keys.
-- Row Level Security is on for every table. Provider keys are readable only by the API server (service role).

create extension if not exists citext;

-- ---------- helpers ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle citext unique,
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
    or (handle ~ '^[a-z0-9._]{3,30}$' and handle !~ '\.\.' and handle !~ '^\.' and handle !~ '\.$')
  ),
  constraint handle_not_reserved check (
    handle is null
    or lower(handle::text) not in ('admin','api','app','auth','help','login','logout','settings','signup','support','root','system','www')
  )
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles: owner can read" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles: owner can update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- A profile row is created for every new account.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Handle availability without exposing other users' profiles.
create or replace function public.handle_available(p_handle text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from public.profiles where handle = lower(trim(leading '@' from p_handle))::citext);
$$;

revoke all on function public.handle_available(text) from public;
grant execute on function public.handle_available(text) to anon, authenticated;

-- ---------- projects ----------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
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

alter table public.projects enable row level security;

create policy "projects: owner full access" on public.projects
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------- provider keys (server-only) ----------
create table public.provider_credentials (
  user_id uuid not null references auth.users (id) on delete cascade,
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

-- RLS on with no policies: browsers (anon/authenticated) can never read or write keys.
alter table public.provider_credentials enable row level security;
revoke all on public.provider_credentials from anon, authenticated;
