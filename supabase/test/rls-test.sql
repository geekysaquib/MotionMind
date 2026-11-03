-- Run after the migrations. Fails loudly if any security rule is broken.
-- auth-stub.sql grants the API roles everything by default, as Supabase does; the migrations must take it away.

do $$ begin
  assert (select count(*) from public.app_users where email = 'old@example.com') = 1, 'existing Supabase Auth user not carried over';
end $$;

insert into public.app_users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'Alice@Example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com');
insert into public.profiles (id) values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');

-- Emails are unique regardless of case.
do $$ begin
  begin insert into public.app_users (email) values ('alice@example.com'); raise exception 'email should be case-insensitive unique';
  exception when unique_violation then null; end;
end $$;

-- Handle format constraints
do $$ begin
  begin update public.profiles set handle = 'Bad Handle' where id = '00000000-0000-0000-0000-00000000000a'; raise exception 'format check missing';
  exception when check_violation then null; end;
  begin update public.profiles set handle = 'admin' where id = '00000000-0000-0000-0000-00000000000a'; raise exception 'reserved check missing';
  exception when check_violation then null; end;
end $$;

update public.profiles set handle = 'samjho.studio' where id = '00000000-0000-0000-0000-00000000000a';

do $$ begin
  assert public.handle_available('SAMJHO.STUDIO') = false, 'handle_available should be case-insensitive';
  assert public.handle_available('@free_handle') = true, 'handle_available false negative';
  begin update public.profiles set handle = 'Samjho.Studio' where id = '00000000-0000-0000-0000-00000000000b'; raise exception 'unique handle missing';
  exception when unique_violation or check_violation then null; end;
end $$;

-- Projects need a real owner, and go away with the account.
insert into public.projects (owner_id, title) values ('00000000-0000-0000-0000-00000000000b', 'B project');
do $$ begin
  begin insert into public.projects (title) values ('no owner'); raise exception 'owner_id should be required';
  exception when not_null_violation then null; end;
end $$;
delete from public.app_users where id = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert (select count(*) from public.projects) = 0, 'projects not removed with their owner';
  assert (select count(*) from public.profiles) = 1, 'profile not removed with its owner';
end $$;

-- The browser roles can touch nothing: only the API server (service role) reads or writes.
set role anon;
do $$ begin
  begin perform 1 from public.app_users; raise exception 'anon can read app_users';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.login_codes; raise exception 'anon can read login_codes';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.profiles; raise exception 'anon can read profiles';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.projects; raise exception 'anon can read projects';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.provider_credentials; raise exception 'anon can read provider_credentials';
  exception when insufficient_privilege then null; end;
  begin perform public.handle_available('x'); raise exception 'anon can call handle_available';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set role authenticated;
do $$ begin
  begin perform 1 from public.profiles; raise exception 'authenticated can read profiles';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.projects; raise exception 'authenticated can read projects';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select 'ALL DATABASE TESTS PASSED' as result;
