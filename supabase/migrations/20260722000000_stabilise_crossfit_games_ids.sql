update event_candidates
set id = 'crossfit_games:' || substring(title from '^[0-9]{4}')
where source = 'crossfit_games'
  and substring(title from '^[0-9]{4}') is not null
  and id <> 'crossfit_games:' || substring(title from '^[0-9]{4}');
