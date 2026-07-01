export type Audience = "James" | "Ewan" | "Sophie" | "Family";

export type Importance = "must_watch" | "nice_to_watch" | "ignore";

export type EventAction = "auto_add" | "suggest" | "ignore";

export type EventSource =
  | "youtube"
  | "springboks"
  | "premier_league"
  | "manual";

export interface EventCandidate {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  source: EventSource;
  sourceUrl?: string;
  audience: Audience[];
  calendarEventId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface EventDecision {
  importance: Importance;
  action: EventAction;
  reasons: string[];
}

export function evaluateCandidate(candidate: EventCandidate): EventDecision {
  if (isSpringboksForEwan(candidate)) {
    return {
      importance: "must_watch",
      action: "auto_add",
      reasons: ["Springboks events for Ewan are high priority"]
    };
  }

  if (candidate.audience.includes("Family")) {
    return {
      importance: "nice_to_watch",
      action: "suggest",
      reasons: ["Family events should be reviewed before adding"]
    };
  }

  return {
    importance: "nice_to_watch",
    action: "suggest",
    reasons: ["Default deterministic rule"]
  };
}

export function normaliseTitle(title: string) {
  return title.trim().replace(/\s+/g, " ");
}

function isSpringboksForEwan(candidate: EventCandidate) {
  return (
    candidate.source === "springboks" &&
    candidate.audience.includes("Ewan") &&
    normaliseTitle(candidate.title).toLowerCase().includes("springboks")
  );
}

