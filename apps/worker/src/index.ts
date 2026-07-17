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
    let candidates;

    try {
      candidates = await provider.discover();
    } catch (error) {
      logIngestionError("provider_discovery", error, {
        provider: provider.name
      });
      throw error;
    }

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
          logIngestionError("candidate_enrichment", error, {
            provider: provider.name,
            enricher: enricher.name,
            candidateId: candidate.id
          });
        }
      );
      if (hasNewMetadata(candidate, enrichedCandidate)) {
        enrichedCount += 1;
        console.log(`Enriched ${candidate.id}: ${candidate.title}`);
      }
      const decision = evaluateCandidate(enrichedCandidate);

      try {
        await db.saveEventCandidate(enrichedCandidate, decision);
      } catch (error) {
        logIngestionError("candidate_save", error, {
          provider: provider.name,
          candidateId: candidate.id
        });
        throw error;
      }

      savedCount += 1;
    }
  }

  console.log(
    `Ingestion complete: ${discoveredCount} discovered, ${enrichedCount} enriched, ${savedCount} saved in ${Date.now() - startedAt}ms`
  );
}

function logIngestionError(
  stage: string,
  error: unknown,
  context: Record<string, string>
) {
  console.error({
    event: "ingestion_error",
    stage,
    ...context,
    error: serialiseError(error)
  });
}

function serialiseError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  if (typeof error === "object" && error !== null) {
    const value = error as Record<string, unknown>;

    return {
      name: "NonErrorThrown",
      message: typeof value.message === "string" ? value.message : String(error),
      ...(typeof value.code === "string" ? { code: value.code } : {}),
      ...(typeof value.details === "string" ? { details: value.details } : {}),
      ...(typeof value.hint === "string" ? { hint: value.hint } : {})
    };
  }

  return {
    name: "NonErrorThrown",
    message: String(error)
  };
}

function hasNewMetadata(
  original: { metadata?: Record<string, unknown> },
  enriched: { metadata?: Record<string, unknown> }
) {
  return JSON.stringify(original.metadata ?? {}) !== JSON.stringify(enriched.metadata ?? {});
}
