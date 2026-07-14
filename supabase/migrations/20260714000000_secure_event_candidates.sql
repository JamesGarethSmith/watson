alter table public.event_candidates enable row level security;

revoke all on table public.event_candidates from anon;
grant select on table public.event_candidates to authenticated;

create policy "Authenticated users can view events"
on public.event_candidates
for select
to authenticated
using (true);
