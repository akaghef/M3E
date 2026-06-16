-- ==========================================================================
-- M3E Supabase Schema — maps table
-- ==========================================================================
-- Run this in the Supabase SQL Editor to set up the cloud sync backend
-- on a fresh Supabase project.
--
-- Existing projects upgrading from the `documents`-named schema should run
-- supabase_migration_docs_to_maps.sql instead of this file.
--
-- Requires: Supabase project with Auth enabled.
-- ==========================================================================

-- 1. Create the maps table
create table if not exists public.maps (
  id          text        primary key,
  version     int         not null default 1,
  map_version int         not null default 0,
  saved_at    timestamptz not null default now(),
  state       jsonb       not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Index for fast lookup by saved_at (conflict detection queries)
create index if not exists idx_maps_saved_at
  on public.maps (saved_at);

create index if not exists idx_maps_map_version
  on public.maps (map_version);

-- 2. Enable Row Level Security
alter table public.maps enable row level security;

-- 3. RLS Policies
--    Phase 1 (simple): any authenticated user can read and write all maps.
--    Phase 2 (future): add an owner_id column + per-user policies.

create policy "Authenticated users can read maps"
  on public.maps for select to authenticated using (true);
create policy "Authenticated users can insert maps"
  on public.maps for insert to authenticated with check (true);
create policy "Authenticated users can update maps"
  on public.maps for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete maps"
  on public.maps for delete to authenticated using (true);

-- 3b. RLS Policies — anon (development only, anon key access)
--     Remove these before production or when Auth sign-in is wired up.
create policy "Anon can read maps"
  on public.maps for select to anon using (true);
create policy "Anon can insert maps"
  on public.maps for insert to anon with check (true);
create policy "Anon can update maps"
  on public.maps for update to anon using (true) with check (true);
create policy "Anon can delete maps"
  on public.maps for delete to anon using (true);

-- 4. Auto-update updated_at on row modification
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_maps_update
  before update on public.maps
  for each row
  execute function public.handle_updated_at();

-- 5. Realtime publication (for future Supabase Realtime subscriptions)
alter publication supabase_realtime add table public.maps;
