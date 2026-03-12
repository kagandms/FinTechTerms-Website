alter table public.study_sessions
    add column if not exists idempotency_key text;

create unique index if not exists idx_study_sessions_user_idempotency_key
    on public.study_sessions (user_id, idempotency_key)
    where user_id is not null
      and idempotency_key is not null;

create unique index if not exists idx_study_sessions_anonymous_idempotency_key
    on public.study_sessions (anonymous_id, idempotency_key)
    where anonymous_id is not null
      and idempotency_key is not null;
