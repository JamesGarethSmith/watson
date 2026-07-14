import { evaluateCandidate } from "@watson/core";
import { createWatsonDb } from "@watson/db";
import { enrichCandidate, getDefaultEnrichers } from "@watson/enrichers";
import { getDefaultProvidersForConfig } from "@watson/sources";

export interface Env {
  FOOTBALL_DATA_API_TOKEN?: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_URL: string;
  YOUTUBE_API_KEY?: string;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      const db = createWatsonDb({
        supabaseUrl: env.SUPABASE_URL,
        supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY
      });

      await db.healthCheck();

      return Response.json({
        ok: true,
        service: "watson-worker",
        supabase: "reachable"
      });
    }

    return Response.json({ ok: true, service: "watson-worker" });
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runIngestion(env));
  }
} satisfies ExportedHandler<Env>;

async function runIngestion(env: Env) {
  const startedAt = Date.now();
  let discoveredCount = 0;
  let enrichedCount = 0;
  let savedCount = 0;

  console.log("Ingestion started");

  const db = createWatsonDb({
    supabaseUrl: env.SUPABASE_URL,
    supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY
  });
  const enrichers = getDefaultEnrichers({
    youtubeApiKey: env.YOUTUBE_API_KEY
  });

  for (const provider of getDefaultProvidersForConfig({
    footballDataApiToken: env.FOOTBALL_DATA_API_TOKEN
  })) {
    const candidates = await provider.discover();
    discoveredCount += candidates.length;
    const providerEnrichers = enrichers.filter((enricher) =>
      provider.enrichers.includes(enricher.name)
    );
    console.log(
      `Provider ${provider.name}: ${candidates.length} candidates; enrichers: ${provider.enrichers.join(", ") || "none"}`
    );

    for (const candidate of candidates) {
      const enrichedCandidate = await enrichCandidate(
        candidate,
        providerEnrichers,
        (enricher, error) => {
          console.error(`Enricher ${enricher.name} failed for ${candidate.id}`, error);
        }
      );
      if (hasNewMetadata(candidate, enrichedCandidate)) {
        enrichedCount += 1;
        console.log(`Enriched ${candidate.id}: ${candidate.title}`);
      }
      const decision = evaluateCandidate(enrichedCandidate);
      await db.saveEventCandidate(enrichedCandidate, decision);
      savedCount += 1;
    }
  }

  console.log(
    `Ingestion complete: ${discoveredCount} discovered, ${enrichedCount} enriched, ${savedCount} saved in ${Date.now() - startedAt}ms`
  );
}

function hasNewMetadata(
  original: { metadata?: Record<string, unknown> },
  enriched: { metadata?: Record<string, unknown> }
) {
  return JSON.stringify(original.metadata ?? {}) !== JSON.stringify(enriched.metadata ?? {});
}
