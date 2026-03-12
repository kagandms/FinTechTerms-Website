create unique index if not exists idx_quiz_attempts_user_idempotency_key_full
    on public.quiz_attempts (user_id, idempotency_key);

create unique index if not exists idx_user_term_srs_user_term
    on public.user_term_srs (user_id, term_id);

create unique index if not exists idx_daily_learning_logs_user_date_unique
    on public.daily_learning_logs (user_id, log_date);

create unique index if not exists idx_user_progress_user_unique
    on public.user_progress (user_id);
