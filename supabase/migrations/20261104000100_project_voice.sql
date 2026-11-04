-- ElevenLabs voiceover timings per project (see ReelVoice in shared/src/projects.ts).
alter table public.projects add column voice jsonb;

-- The MP3s go in a private bucket. With no storage policies, only the API (service role) can read
-- or write; the browser plays them through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice', 'voice', false, 10485760, array['audio/mpeg'])
on conflict (id) do nothing;
