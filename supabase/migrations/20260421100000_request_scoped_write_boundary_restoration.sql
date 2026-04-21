revoke all on function public.toggle_my_favorite(text, boolean) from public, anon;
grant execute on function public.toggle_my_favorite(text, boolean) to authenticated;

revoke all on function public.record_my_study_event(text, boolean, integer, text, date, text, uuid, text, timestamptz) from public, anon;
grant execute on function public.record_my_study_event(text, boolean, integer, text, date, text, uuid, text, timestamptz) to authenticated;

revoke all on function public.start_study_session(text, text, text, boolean, text, uuid, text) from public;
grant execute on function public.start_study_session(text, text, text, boolean, text, uuid, text) to anon, authenticated;

revoke all on function public.bind_study_session_token(uuid, text, text, text) from public;
grant execute on function public.bind_study_session_token(uuid, text, text, text) to anon, authenticated;

revoke all on function public.update_study_session_by_token(uuid, text, integer, integer, integer, boolean, timestamptz) from public;
grant execute on function public.update_study_session_by_token(uuid, text, integer, integer, integer, boolean, timestamptz) to anon, authenticated;

drop policy if exists "Authenticated users can manage own api idempotency keys" on public.api_idempotency_keys;
create policy "Authenticated users can manage own api idempotency keys"
    on public.api_idempotency_keys
    for all
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

revoke all on public.api_idempotency_keys from public, anon, authenticated;
grant select, insert, update, delete on public.api_idempotency_keys to authenticated;
