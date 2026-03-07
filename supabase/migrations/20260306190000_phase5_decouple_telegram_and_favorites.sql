-- Phase 5: Fully decouple Telegram from the shared database schema.
-- Keep core dictionary and web favorites tables intact; remove only Telegram link artifacts.

drop trigger if exists trigger_account_link_token_failure on public.account_link_token_failures;

drop function if exists public.handle_account_link_token_failure();
drop function if exists public.generate_telegram_link_token(bigint);
drop function if exists public.link_telegram_account(text);
drop function if exists public.link_telegram_account_v2(text, uuid);
drop function if exists public.sync_telegram_user(bigint, text, text);

drop table if exists public.account_link_tokens cascade;
drop table if exists public.account_link_token_failures cascade;
drop table if exists public.account_link_token_lockouts cascade;
drop table if exists public.telegram_users cascade;
