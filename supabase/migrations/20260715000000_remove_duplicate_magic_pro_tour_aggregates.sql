delete from event_candidates as aggregate
where aggregate.source = 'magic_pro_tour'
  and aggregate.ends_at > aggregate.starts_at + interval '24 hours'
  and exists (
    select 1
    from event_candidates as daily
    where daily.source = aggregate.source
      and daily.id <> aggregate.id
      and lower(trim(daily.title)) = lower(trim(aggregate.title))
      and daily.starts_at::date = aggregate.starts_at::date
      and (
        daily.ends_at is null
        or daily.ends_at <= daily.starts_at + interval '24 hours'
      )
  );
