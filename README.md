# Watson

Watson is a personal/family event discovery app for finding live events that
matter and getting them into Google Calendar.

## Workspace

- `apps/web`: Next.js frontend
- `apps/worker`: Cloudflare Worker for scheduled ingestion
- `packages/core`: shared event models, deterministic rules, normalisation
- `packages/sources`: source provider interfaces and implementations
- `packages/enrichers`: deterministic YouTube and DStv/SuperSport enrichment
- `packages/db`: Supabase client and database access
- `supabase/migrations`: database schema migrations

## Prerequisites

This repo pins Node and pnpm with `mise` in `.tool-versions`.

```bash
brew install mise supabase/tap/supabase
mise install
```

## Development

```bash
pnpm install
pnpm build
pnpm web:dev
pnpm worker:dev
```

`wrangler` and `vercel` are installed as project dev dependencies, so use them
through `pnpm` or package scripts rather than global installs.

## Deployment

Pushing `main` deploys the web app to Vercel. Deploy the ingestion Worker
separately from the same checkout with `pnpm --filter @watson/worker deploy`.
The Worker deploy requires a valid Wrangler login or `CLOUDFLARE_API_TOKEN`.

The events homepage is public and does not require a login. Apply
`supabase/migrations/20260906000000_public_event_read_access.sql` before deploying
the web change so anonymous visitors can read events. Public database access is
read-only; ingestion still uses its existing privileged credentials.

## Worker configuration

The DStv/SuperSport enricher needs no credentials. To enable YouTube livestream
enrichment, add a YouTube Data API v3 key as a Worker secret:

```bash
pnpm --filter @watson/worker exec wrangler secret put YOUTUBE_API_KEY
```
