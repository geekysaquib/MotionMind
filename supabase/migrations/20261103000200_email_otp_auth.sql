-- Replace Supabase Auth with our own email OTP login.
-- Accounts live in app_users. The API server (service role) is the only thing that
-- reads or writes any table; browsers never talk to the database directly.

-- ---------- accounts ----------
create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null unique,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

-- Keep anyone who already signed up with Supabase Auth.
insert into public.app_users (id, email, created_at)
select u.id, u.email, u.created_at from auth.users u where u.email is not null
on conflict do nothing;

-- One pending code per email. Only a hash of the code is stored.
create table public.login_codes (
  email extensions.citext primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts smallint not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- point everything at app_users ----------
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- Rows whose owner never made it into app_users (no email) would break the new keys.
delete from public.profiles where id not in (select id from public.app_users);
delete from public.projects where owner_id not in (select id from public.app_users);
delete from public.provider_credentials where user_id not in (select id from public.app_users);

alter table public.profiles drop constraint profiles_id_fkey;
alter table public.profiles add constraint profiles_id_fkey foreign key (id) references public.app_users (id) on delete cascade;

alter table public.projects alter column owner_id drop default;
alter table public.projects drop constraint projects_owner_id_fkey;
alter table public.projects add constraint projects_owner_id_fkey foreign key (owner_id) references public.app_users (id) on delete cascade;

alter table public.provider_credentials drop constraint provider_credentials_user_id_fkey;
alter table public.provider_credentials add constraint provider_credentials_user_id_fkey foreign key (user_id) references public.app_users (id) on delete cascade;

-- ---------- lock the browser out ----------
-- RLS stays on with no policies, so the anon key can read or write nothing.
drop policy if exists "profiles: owner can read" on public.profiles;
drop policy if exists "profiles: owner can update" on public.profiles;
drop policy if exists "projects: owner full access" on public.projects;

alter table public.app_users enable row level security;
alter table public.login_codes enable row level security;

revoke all on public.app_users, public.login_codes, public.profiles, public.projects, public.provider_credentials from anon, authenticated;
revoke execute on function public.handle_available(text) from anon, authenticated;
