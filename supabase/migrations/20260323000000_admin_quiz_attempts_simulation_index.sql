create index if not exists idx_quiz_attempts_simulation_created_at
    on public.quiz_attempts (created_at)
    include (is_correct, response_time_ms, user_id)
    where quiz_type = 'simulation';
