alter table public.profiles
    add column if not exists metadata_sync_pending boolean not null default false,
    add column if not exists metadata_sync_attempted_at timestamptz,
    add column if not exists metadata_synced_at timestamptz,
    add column if not exists metadata_sync_error text;
