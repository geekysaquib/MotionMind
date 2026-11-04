-- Reel editor: uploaded voice/music tracks, scene cuts, pace and caption style, saved per project.
-- Applied to motion-mind on 2026-11-04.
alter table public.projects add column if not exists editor jsonb;

-- Uploaded recordings can be WAV/M4A/OGG etc. and larger than ElevenLabs MP3s.
update storage.buckets
   set file_size_limit = 41943040,
       allowed_mime_types = null
 where id = 'voice';
