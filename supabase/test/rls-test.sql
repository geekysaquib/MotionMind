-- Run after the migration. Fails loudly if any security rule is broken.
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
revoke all on public.provider_credentials from anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '{"display_name":"Alice"}'),
  ('00000000-0000-0000-0000-00000000000b', '{}');

do $$ begin
  assert (select count(*) from public.profiles) = 2, 'profile trigger did not create rows';
  assert (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'Alice', 'display_name not copied';
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

insert into public.provider_credentials (user_id, provider, ciphertext, iv, auth_tag, last4)
  values ('00000000-0000-0000-0000-00000000000a', 'elevenlabs', 'x', 'y', 'z', 'abcd');

-- As user B
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  assert (select count(*) from public.profiles) = 1, 'user B can see other profiles';
  insert into public.projects (title) values ('B project');
  assert (select count(*) from public.projects) = 1, 'B cannot see own project';
end $$;
do $$ begin
  begin perform 1 from public.provider_credentials; raise exception 'authenticated can read provider_credentials';
  exception when insufficient_privilege then null; end;
end $$;

-- As user A
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin
  assert (select count(*) from public.projects) = 0, 'user A can see B''s project';
  update public.projects set title = 'hijack';
  assert (select count(*) from public.projects where title = 'hijack') = 0, 'cross-user update';
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.projects where title = 'hijack') = 0, 'A modified B''s project';
end $$;
select 'ALL RLS TESTS PASSED' as result;
