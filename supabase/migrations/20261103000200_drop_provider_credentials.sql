-- Users no longer bring their own AI keys: the server's own keys run Claude and other providers.
drop table if exists public.provider_credentials;
