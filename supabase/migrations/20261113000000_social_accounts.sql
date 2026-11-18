-- Phase 2: the creator's connected Instagram and YouTube accounts (read-only analytics).
-- Tokens are encrypted by the API (AES-256-GCM, key derived from AUTH_SECRET) before they get here.

create table public.social_accounts (
  user_id uuid not null references public.app_users (id) on delete cascade,
  platform text not null check (platform in ('instagram', 'youtube')),
  account_id text not null check (char_length(account_id) <= 100),
  handle text not null check (char_length(handle) <= 100),
  name text check (char_length(name) <= 200),
  avatar_url text check (char_length(avatar_url) <= 2000),
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  expires_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, platform)
);

create trigger social_accounts_updated_at before update on public.social_accounts
  for each row execute function public.set_updated_at();

-- One follower count per account per day, so there is a history even where the platform keeps none.
create table public.social_snapshots (
  user_id uuid not null references public.app_users (id) on delete cascade,
  platform text not null check (platform in ('instagram', 'youtube')),
  day date not null,
  followers bigint not null check (followers >= 0),
  primary key (user_id, platform, day)
);

alter table public.social_accounts enable row level security;
alter table public.social_snapshots enable row level security;
revoke all on public.social_accounts, public.social_snapshots from anon, authenticated;
