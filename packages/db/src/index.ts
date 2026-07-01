import { createClient } from "@supabase/supabase-js";
import type { EventCandidate, EventDecision } from "@watson/core";

export interface WatsonDbConfig {
  supabaseUrl: string;
  supabaseKey: string;
}

export function createWatsonDb(config: WatsonDbConfig) {
  const client = createClient(config.supabaseUrl, config.supabaseKey);

  return {
    async healthCheck() {
      const { error } = await client
        .from("event_candidates")
        .select("id", { count: "exact", head: true });

      if (error) {
        throw error;
      }
    },

    async saveEventCandidate(
      candidate: EventCandidate,
      decision: EventDecision
    ) {
      const { error } = await client.from("event_candidates").upsert({
        id: candidate.id,
        title: candidate.title,
        starts_at: candidate.startsAt,
        ends_at: candidate.endsAt ?? null,
        source: candidate.source,
        source_url: candidate.sourceUrl ?? null,
        audience: candidate.audience,
        importance: decision.importance,
        action: decision.action,
        calendar_event_id: candidate.calendarEventId ?? null,
        metadata: candidate.metadata ?? {}
      });

      if (error) {
        throw error;
      }
    }
  };
}
