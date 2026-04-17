-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query)

create table if not exists healthlog_state (
  id         text primary key,
  state      jsonb not null,
  updated_at timestamptz default now()
);

-- Allow the anon key to read and write (personal tracker, no auth)
alter table healthlog_state enable row level security;

create policy "allow all for anon"
  on healthlog_state
  for all
  to anon
  using (true)
  with check (true);
