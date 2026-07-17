delete from event_candidates as legacy
where legacy.source = 'magic_pro_tour'
  and legacy.metadata->>'eventDay' = '1'
  and legacy.id = 'magic_pro_tour:' || (legacy.metadata->>'contentfulId')
  and exists (
    select 1
    from event_candidates as daily
    where daily.id = legacy.id || ':day-1'
      and daily.source = legacy.source
      and daily.starts_at = legacy.starts_at
  );
