-- The template a reel started from (its look, caption style and how its script is written). Null = the default template.
alter table public.projects add column if not exists template text
  check (template is null or template in ('explainer-3d', 'system-design', 'app-backend', 'night-tech', 'science-lab'));
