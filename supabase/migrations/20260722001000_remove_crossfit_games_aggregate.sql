delete from event_candidates
where source = 'crossfit_games'
  and id ~ '^crossfit_games:[0-9]{4}$';
