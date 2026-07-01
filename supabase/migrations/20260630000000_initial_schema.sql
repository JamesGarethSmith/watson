create type audience as enum ('James', 'Ewan', 'Sophie', 'Family');
create type event_importance as enum ('must_watch', 'nice_to_watch', 'ignore');
create type event_action as enum ('auto_add', 'suggest', 'ignore');
create type event_source as enum ('youtube', 'springboks', 'premier_league', 'manual');

create table event_candidates (
  id text primary key,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  source event_source not null,
  source_url text,
  audience audience[] not null default '{}',
  importance event_importance not null default 'nice_to_watch',
  action event_action not null default 'suggest',
  calendar_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index event_candidates_starts_at_idx on event_candidates (starts_at);
create index event_candidates_action_idx on event_candidates (action);
create index event_candidates_audience_idx on event_candidates using gin (audience);
