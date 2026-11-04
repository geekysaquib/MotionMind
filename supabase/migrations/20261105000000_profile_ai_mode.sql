-- How the user works with AI: copy and paste, or the server's API keys. Null = not chosen yet (the app then
-- offers the browser's earlier choice). Saved per account so it follows the user to another browser.
alter table public.profiles add column if not exists ai_mode text check (ai_mode in ('paste', 'keys'));
