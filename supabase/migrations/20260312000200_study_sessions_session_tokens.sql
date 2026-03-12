alter table public.study_sessions
    add column if not exists session_token_hash text;

create index if not exists idx_study_sessions_session_token_hash
    on public.study_sessions (session_token_hash)
    where session_token_hash is not null;
