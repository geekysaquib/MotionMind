-- Security hardening from the Supabase advisor.

-- Fixed search_path on the trigger helper.
alter function public.set_updated_at() set search_path = public;

-- The sign-up trigger runs as a trigger only; nobody should call it over the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Keep citext out of the exposed public schema.
create schema if not exists extensions;
alter extension citext set schema extensions;
alter function public.handle_available(text) set search_path = public, extensions;

-- handle_available stays callable by anon on purpose: the sign-up form checks
-- handle availability. It returns only true/false and never exposes profile rows.
