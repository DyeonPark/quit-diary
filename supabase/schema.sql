-- Run this in the Supabase SQL editor. Each diary entry belongs to its owner.
create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  note text not null default '' check (char_length(note) <= 240),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

alter table public.diary_entries enable row level security;

create policy "Users can read their own diary entries"
  on public.diary_entries for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own diary entries"
  on public.diary_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own diary entries"
  on public.diary_entries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own diary entries"
  on public.diary_entries for delete to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists diary_entries_user_date_idx
  on public.diary_entries (user_id, entry_date);
