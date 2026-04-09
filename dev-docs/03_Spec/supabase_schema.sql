-- ==========================================================================
-- M3E Supabase Schema — documents table
-- ==========================================================================
-- Run this in the Supabase SQL Editor to set up the cloud sync backend.
-- Requires: Supabase project with Auth enabled.
-- ==========================================================================

-- 1. Create the documents table
create table if not exists public.documents (
  id          text        primary key,
  version     int         not null default 1,
  saved_at    timestamptz not null default now(),
  state       jsonb       not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Index for fast lookup by saved_at (conflict detection queries)
create index if not exists idx_documents_saved_at
  on public.documents (saved_at);

-- 2. Enable Row Level Security
alter table public.documents enable row level security;

-- 3. RLS Policies
--    Phase 1 (simple): any authenticated user can read and write all documents.
--    Phase 2 (future): add an owner_id column + per-user policies.

-- Allow authenticated users to SELECT any document
create policy "Authenticated users can read documents"
  on public.documents
  for select
  to authenticated
  using (true);

-- Allow authenticated users to INSERT new documents
create policy "Authenticated users can insert documents"
  on public.documents
  for insert
  to authenticated
  with check (true);

-- Allow authenticated users to UPDATE any document
create policy "Authenticated users can update documents"
  on public.documents
  for update
  to authenticated
  using (true)
  with check (true);

-- Allow authenticated users to DELETE documents (for cleanup)
create policy "Authenticated users can delete documents"
  on public.documents
  for delete
  to authenticated
  using (true);

-- 3b. RLS Policies — anon (development only, anon key access)
--     Remove these before production or when Auth sign-in is wired up.

create policy "Anon can read documents"
  on public.documents for select to anon using (true);
create policy "Anon can insert documents"
  on public.documents for insert to anon with check (true);
create policy "Anon can update documents"
  on public.documents for update to anon using (true) with check (true);
create policy "Anon can delete documents"
  on public.documents for delete to anon using (true);

-- 4. Auto-update updated_at on row modification
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_documents_update
  before update on public.documents
  for each row
  execute function public.handle_updated_at();

-- 5. Realtime publication (for future Supabase Realtime subscriptions)
alter publication supabase_realtime add table public.documents;
