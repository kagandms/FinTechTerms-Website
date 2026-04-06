create or replace function public.get_public_term_count()
returns bigint
language sql
security definer
stable
set search_path = public
as $$
    select count(*)::bigint
    from public.terms as terms
    where terms.is_academic is distinct from false;
$$;

revoke all on function public.get_public_term_count() from public;
grant execute on function public.get_public_term_count() to anon, authenticated, service_role;
