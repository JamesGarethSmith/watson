-- Shared event links should work without a family member signing in.
-- Anonymous visitors can only read; ingestion retains its existing write access.
grant select on table public.event_candidates to anon;

create policy "Public visitors can view events"
on public.event_candidates
for select
to anon
using (true);
