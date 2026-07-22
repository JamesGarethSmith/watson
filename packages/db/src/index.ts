import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Audience,
  EventAction,
  EventCandidate,
  EventDecision,
  EventSource,
  Importance
} from "@watson/core";

export interface WatsonDbConfig {
  supabaseUrl: string;
  supabaseKey: string;
}

export interface ScheduledEvent extends EventCandidate {
  importance: Importance;
  action: EventAction;
  createdAt: string;
  updatedAt: string;
}

interface EventCandidateRow {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  source: EventSource;
  source_url: string | null;
  audience: Audience[];
  importance: Importance;
  action: EventAction;
  calendar_event_id: string | null;
  metadata: EventCandidate["metadata"];
  created_at: string;
  updated_at: string;
}

export function createWatsonDb(config: WatsonDbConfig) {
  const client = createClient(config.supabaseUrl, config.supabaseKey);

  return createWatsonDbFromClient(client);
}

export function createWatsonDbFromClient(client: SupabaseClient) {
  return {
    async healthCheck() {
      const { error } = await client
        .from("event_candidates")
        .select("id", { count: "exact", head: true });

      if (error) {
        throw error;
      }
    },

    async listUpcomingEvents(from = new Date()): Promise<ScheduledEvent[]> {
      const { data, error } = await client
        .from("event_candidates")
        .select(
          "id,title,starts_at,ends_at,source,source_url,audience,importance,action,calendar_event_id,metadata,created_at,updated_at"
        )
        // Include events that have already started but have not finished yet.
        .or(
          `starts_at.gte.${from.toISOString()},ends_at.gte.${from.toISOString()}`
        )
        .order("starts_at", { ascending: true });

      if (error) {
        throw error;
      }

      return ((data ?? []) as EventCandidateRow[]).map((row) => ({
        id: row.id,
        title: row.title,
        startsAt: row.starts_at,
        ...(row.ends_at ? { endsAt: row.ends_at } : {}),
        source: row.source,
        ...(row.source_url ? { sourceUrl: row.source_url } : {}),
        audience: row.audience,
        importance: row.importance,
        action: row.action,
        ...(row.calendar_event_id
          ? { calendarEventId: row.calendar_event_id }
          : {}),
        metadata: row.metadata ?? {},
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
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
