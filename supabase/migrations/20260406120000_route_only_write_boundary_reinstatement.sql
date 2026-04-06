revoke all on function public.toggle_my_favorite(text, boolean) from public, anon, authenticated;
revoke all on function public.record_my_study_event(text, boolean, integer, text, date, text, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.start_study_session(text, text, text, boolean, text, uuid, text) from public, anon, authenticated;
revoke all on function public.bind_study_session_token(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.update_study_session_by_token(uuid, text, integer, integer, integer, boolean, timestamptz) from public, anon, authenticated;

drop policy if exists "Authenticated users can manage own api idempotency keys" on public.api_idempotency_keys;
revoke all on public.api_idempotency_keys from public, anon, authenticated;
