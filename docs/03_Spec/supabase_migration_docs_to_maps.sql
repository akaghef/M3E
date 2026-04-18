-- ==========================================================================
-- M3E Supabase Migration — documents -> maps, doc_version -> map_version
-- ==========================================================================
-- Target: Supabase projects that were previously bootstrapped with the old
--         `documents` table (schema defined in supabase_schema.sql prior to
--         2026-04-16).
--
-- Run this in the Supabase SQL Editor once. Idempotent: each step is guarded
-- with IF EXISTS / IF NOT EXISTS where PostgreSQL supports it.
-- ==========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Rename table: documents -> maps
-- ---------------------------------------------------------------------------
alter table if exists public.documents rename to maps;

-- ---------------------------------------------------------------------------
-- 2. Rename column: doc_version -> map_version
-- ---------------------------------------------------------------------------
alter table if exists public.maps
  rename column doc_version to map_version;

-- ---------------------------------------------------------------------------
-- 3. Rename index
-- ---------------------------------------------------------------------------
alter index if exists public.idx_documents_saved_at rename to idx_maps_saved_at;
alter index if exists public.idx_documents_doc_version rename to idx_maps_map_version;

-- ---------------------------------------------------------------------------
-- 4. Drop old RLS policies (tied to the old table identity by name).
--    PostgreSQL keeps policies on the renamed table, but their display names
--    still say "documents" — recreate with new names for clarity.
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated users can read documents"   on public.maps;
drop policy if exists "Authenticated users can insert documents" on public.maps;
drop policy if exists "Authenticated users can update documents" on public.maps;
drop policy if exists "Authenticated users can delete documents" on public.maps;
drop policy if exists "Anon can read documents"   on public.maps;
drop policy if exists "Anon can insert documents" on public.maps;
drop policy if exists "Anon can update documents" on public.maps;
drop policy if exists "Anon can delete documents" on public.maps;

create policy "Authenticated users can read maps"
  on public.maps for select to authenticated using (true);
create policy "Authenticated users can insert maps"
  on public.maps for insert to authenticated with check (true);
create policy "Authenticated users can update maps"
  on public.maps for update to authenticated using (true) with check (true);
create policy "Authenticated users can delete maps"
  on public.maps for delete to authenticated using (true);

create policy "Anon can read maps"
  on public.maps for select to anon using (true);
create policy "Anon can insert maps"
  on public.maps for insert to anon with check (true);
create policy "Anon can update maps"
  on public.maps for update to anon using (true) with check (true);
create policy "Anon can delete maps"
  on public.maps for delete to anon using (true);

-- ---------------------------------------------------------------------------
-- 5. Recreate trigger with the new name.
-- ---------------------------------------------------------------------------
drop trigger if exists on_documents_update on public.maps;

create trigger on_maps_update
  before update on public.maps
  for each row
  execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Update realtime publication membership.
-- ---------------------------------------------------------------------------
-- The publication carries table identity by OID, so the rename is reflected
-- automatically. Nothing to do here — but an explicit refresh is harmless:
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'maps'
  ) then
    -- already attached post-rename
    null;
  else
    execute 'alter publication supabase_realtime add table public.maps';
  end if;
end $$;

commit;

-- ==========================================================================
-- Verification (run separately and read the output)
-- ==========================================================================
-- select count(*) as map_count from public.maps;
-- select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'maps'
--   order by ordinal_position;
-- select policyname from pg_policies where schemaname = 'public' and tablename = 'maps';
-- select tgname from pg_trigger where tgrelid = 'public.maps'::regclass and not tgisinternal;

-- ==========================================================================
-- Rollback (if something is wrong — run in a separate transaction)
-- ==========================================================================
-- begin;
-- alter table if exists public.maps rename to documents;
-- alter table if exists public.documents rename column map_version to doc_version;
-- alter index if exists public.idx_maps_saved_at rename to idx_documents_saved_at;
-- alter index if exists public.idx_maps_map_version rename to idx_documents_doc_version;
-- -- Then recreate the original-named policies / trigger per supabase_schema.sql (old version).
-- commit;
