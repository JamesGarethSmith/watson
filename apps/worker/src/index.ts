import { evaluateCandidate } from "@watson/core";
import { createWatsonDb } from "@watson/db";
import { getDefaultProviders } from "@watson/sources";

export interface Env {
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_URL: string;
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
  const db = createWatsonDb({
    supabaseUrl: env.SUPABASE_URL,
    supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY
  });

  for (const provider of getDefaultProviders()) {
    const candidates = await provider.discover();

    for (const candidate of candidates) {
      const decision = evaluateCandidate(candidate);
      await db.saveEventCandidate(candidate, decision);
    }
  }
}
