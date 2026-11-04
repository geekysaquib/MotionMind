-- Which platforms a reel is made for: Instagram Reels, YouTube Shorts, or both. Existing reels keep both.
alter table public.projects add column if not exists platforms text[] not null default '{instagram,youtube}'
  check (platforms <@ array['instagram','youtube']::text[] and cardinality(platforms) >= 1);
