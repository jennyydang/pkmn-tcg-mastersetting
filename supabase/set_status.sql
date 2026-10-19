-- Custom master set status: "ongoing" or "complete", set by the user.
-- Safe to run more than once.
alter table public.tracked_master_sets
  add column if not exists status text
  check (status is null or status in ('ongoing', 'complete'));
