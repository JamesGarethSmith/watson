# Watson

Watson is a personal/family event discovery app. The name is a pun on "what's on?"

## Goal

Help the family avoid missing live events that matter, especially events like Springboks matches for Ewan.

Google Calendar remains the source of truth. Watson discovers events, filters them, and creates/suggests Google Calendar events.

## Planned stack

- Turborepo monorepo
- Next.js app hosted on Vercel
- Cloudflare Worker for scheduled ingestion
- Cloudflare Cron Triggers
- Supabase for Postgres, Auth, and generated API
- Google Calendar API for calendar output
- YouTube API for livestream/premiere sources

## Monorepo shape

- `apps/web`: Next.js frontend
- `apps/worker`: Cloudflare Worker for cron jobs and ingestion
- `packages/core`: shared event models, rules, normalisation
- `packages/sources`: source providers
- `packages/db`: Supabase client and database access
- `supabase/migrations`: database migrations

## Architecture

Sources produce normalised event candidates.

Pipeline:

Source provider
→ EventCandidate
→ rules engine
→ save to Supabase
→ review or auto-add
→ Google Calendar

## Initial providers

- YouTubeProvider
- SpringboksProvider
- PremierLeagueProvider
- ManualProvider

Avoid scraping unless necessary. Prefer official APIs, official fixture pages, RSS, ICS, or structured data.

## AI / LLM policy

Do not add LLMs initially. Keep the first version deterministic.

LLMs may be added later behind an interface for messy input normalisation, deduplication, or relevance classification.

## Important modelling ideas

Events should support:

- title
- start time
- end time
- source
- source URL
- audience: James, Ewan, Sophie, Family
- importance: must_watch, nice_to_watch, ignore
- action: auto_add, suggest, ignore
- calendar mapping/id

Springboks events for Ewan are high priority and should be candidates for auto-add.

## Development approach

Use real hosted services for development where practical:

- real Supabase project
- real Google Calendar test calendar
- real YouTube API
- local Vercel/Next.js dev
- local Cloudflare Worker dev

Do not spend time building full local infrastructure unless needed.

## Coding preferences

- TypeScript
- Deterministic logic before AI
- Small provider interface
- Keep business logic out of database triggers
- Supabase is the data layer, not the business logic layer
- Cloudflare Worker owns ingestion/orchestration
