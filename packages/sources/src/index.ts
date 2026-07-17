import {
  normaliseTitle,
  type EnricherName,
  type EventCandidate
} from "@watson/core";

export interface SourceProvider {
  readonly name: string;
  readonly enrichers: readonly EnricherName[];
  discover(): Promise<EventCandidate[]>;
}

export class ManualProvider implements SourceProvider {
  readonly name = "manual";
  readonly enrichers = ["youtube", "dstv"] as const;

  async discover(): Promise<EventCandidate[]> {
    return [];
  }
}

export class SpringboksProvider implements SourceProvider {
  readonly name = "springboks";
  readonly enrichers = ["dstv"] as const;

  constructor(
    private readonly options: {
      fetcher?: typeof fetch;
      matchCentreUrl?: string;
      now?: () => Date;
    } = {}
  ) {}

  async discover(): Promise<EventCandidate[]> {
    const matchCentreUrl =
      this.options.matchCentreUrl ?? "https://springboks.rugby/match-centre";
    const fetcher = this.options.fetcher ?? fetch;
    const response = await fetcher(matchCentreUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Springboks fixtures: ${response.status} ${response.statusText}`
      );
    }

    const html = await response.text();
    return parseSpringboksMatchCentre(
      html,
      matchCentreUrl,
      this.options.now?.() ?? new Date()
    );
  }
}

export class PremierLeagueProvider implements SourceProvider {
  readonly name = "premier_league";
  readonly enrichers = ["dstv"] as const;

  constructor(
    private readonly options: {
      apiToken?: string;
      baseUrl?: string;
      competitionCode?: string;
      fetcher?: typeof fetch;
      lookaheadDays?: number;
      now?: () => Date;
      sourceUrl?: string;
    } = {}
  ) {}

  async discover(): Promise<EventCandidate[]> {
    if (!this.options.apiToken) {
      return [];
    }

    const now = this.options.now?.() ?? new Date();
    const dateFrom = toDateOnly(now);
    const dateTo = toDateOnly(addDays(now, this.options.lookaheadDays ?? 120));
    const competitionCode = this.options.competitionCode ?? "PL";
    const url = new URL(
      `${this.options.baseUrl ?? "https://api.football-data.org/v4"}/competitions/${competitionCode}/matches`
    );

    url.searchParams.set("dateFrom", dateFrom);
    url.searchParams.set("dateTo", dateTo);
    url.searchParams.set("status", "SCHEDULED");

    const fetcher = this.options.fetcher ?? fetch;
    const response = await fetcher(url, {
      headers: {
        "X-Auth-Token": this.options.apiToken
      }
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Premier League fixtures: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as FootballDataMatchesResponse;
    return parsePremierLeagueMatches(
      data,
      this.options.sourceUrl ?? "https://www.football-data.org/",
      now
    );
  }
}

export class ChampionsLeagueProvider implements SourceProvider {
  readonly name = "champions_league";
  readonly enrichers = ["dstv"] as const;

  constructor(
    private readonly options: {
      apiToken?: string;
      baseUrl?: string;
      competitionCode?: string;
      fetcher?: typeof fetch;
      lookaheadDays?: number;
      now?: () => Date;
      sourceUrl?: string;
    } = {}
  ) {}

  async discover(): Promise<EventCandidate[]> {
    if (!this.options.apiToken) {
      return [];
    }

    const now = this.options.now?.() ?? new Date();
    const dateFrom = toDateOnly(now);
    const dateTo = toDateOnly(addDays(now, this.options.lookaheadDays ?? 120));
    const competitionCode = this.options.competitionCode ?? "CL";
    const url = new URL(
      `${this.options.baseUrl ?? "https://api.football-data.org/v4"}/competitions/${competitionCode}/matches`
    );

    url.searchParams.set("dateFrom", dateFrom);
    url.searchParams.set("dateTo", dateTo);
    url.searchParams.set("status", "SCHEDULED");

    const fetcher = this.options.fetcher ?? fetch;
    const response = await fetcher(url, {
      headers: {
        "X-Auth-Token": this.options.apiToken
      }
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Champions League fixtures: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as FootballDataMatchesResponse;
    return parseChampionsLeagueMatches(
      data,
      this.options.sourceUrl ?? "https://www.football-data.org/",
      now
    );
  }
}

export class CrossFitGamesProvider implements SourceProvider {
  readonly name = "crossfit_games";
  readonly enrichers = ["youtube"] as const;

  constructor(
    private readonly options: {
      competitionsUrl?: string;
      fetcher?: typeof fetch;
      now?: () => Date;
      sourceUrl?: string;
    } = {}
  ) {}

  async discover(): Promise<EventCandidate[]> {
    const competitionsUrl =
      this.options.competitionsUrl ??
      "https://c3po.crossfit.com/api/competitions/v1/competitions/finals";
    const fetcher = this.options.fetcher ?? fetch;
    const response = await fetcher(competitionsUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch CrossFit Games competition metadata: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as CrossFitCompetition[];
    return parseCrossFitGamesCompetitions(
      data,
      this.options.sourceUrl ??
        "https://games.crossfit.com/finals/schedule?type=individuals",
      this.options.now?.() ?? new Date()
    );
  }
}

export class MagicProTourProvider implements SourceProvider {
  readonly name = "magic_pro_tour";
  readonly enrichers = ["youtube"] as const;

  constructor(
    private readonly options: {
      accessToken?: string;
      baseUrl?: string;
      fetcher?: typeof fetch;
      limit?: number;
      now?: () => Date;
      sourceUrl?: string;
    } = {}
  ) {}

  async discover(): Promise<EventCandidate[]> {
    const now = this.options.now?.() ?? new Date();
    const url = new URL(
      this.options.baseUrl ??
        "https://cdn.contentful.com/spaces/ryplwhabvmmk/environments/master/entries"
    );

    url.searchParams.set("content_type", "scheduleEvent");
    url.searchParams.set("include", "10");
    url.searchParams.set("order", "fields.startTime");
    url.searchParams.set("fields.startTime[gte]", now.toISOString());
    url.searchParams.set("limit", String(this.options.limit ?? 100));
    url.searchParams.set(
      "access_token",
      this.options.accessToken ??
        "55006dd7d868409c694628081e43f6ce5d1cee174943d8fcb03ca66507390427"
    );

    const fetcher = this.options.fetcher ?? fetch;
    const response = await fetcher(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Magic Pro Tour schedule: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as ContentfulScheduleResponse;
    return parseMagicProTourSchedule(
      data,
      this.options.sourceUrl ?? "https://magic.gg/schedule",
      now
    );
  }
}

export function getDefaultProviders(): SourceProvider[] {
  return [
    new SpringboksProvider(),
    new CrossFitGamesProvider(),
    new PremierLeagueProvider(),
    new ChampionsLeagueProvider(),
    new MagicProTourProvider(),
    new ManualProvider()
  ];
}

export function getDefaultProvidersForConfig(config: {
  footballDataApiToken?: string;
}): SourceProvider[] {
  return [
    new SpringboksProvider(),
    new CrossFitGamesProvider(),
    new PremierLeagueProvider({
      apiToken: config.footballDataApiToken
    }),
    new ChampionsLeagueProvider({
      apiToken: config.footballDataApiToken
    }),
    new MagicProTourProvider(),
    new ManualProvider()
  ];
}

interface JsonLdItemList {
  itemListElement?: Array<{ item?: JsonLdSportsEvent }>;
}

interface JsonLdSportsEvent {
  "@type"?: string;
  name?: string;
  startDate?: string;
  sport?: string;
  location?: {
    name?: string;
  };
  competitor?: Array<{
    name?: string;
  }>;
  organizer?: {
    name?: string;
    url?: string;
  };
}

interface CrossFitCompetition {
  id?: number;
  identifier?: string;
  name?: string;
  slug?: string;
  year?: number;
  active?: boolean;
  type?: string;
  start_date?: string;
  end_date?: string;
  competition_name?: string;
  competition_name_short?: string;
}

interface FootballDataMatchesResponse {
  competition?: {
    id?: number;
    name?: string;
    code?: string;
  };
  matches?: FootballDataMatch[];
}

interface FootballDataMatch {
  id?: number;
  utcDate?: string;
  status?: string;
  matchday?: number | null;
  stage?: string | null;
  group?: string | null;
  lastUpdated?: string;
  homeTeam?: FootballDataTeam;
  awayTeam?: FootballDataTeam;
  competition?: {
    id?: number;
    name?: string;
    code?: string;
  };
  season?: {
    id?: number;
    startDate?: string;
    endDate?: string;
    currentMatchday?: number;
  };
}

interface FootballDataTeam {
  id?: number;
  name?: string;
  shortName?: string;
  tla?: string;
}

interface ContentfulScheduleResponse {
  items?: ContentfulScheduleEvent[];
  includes?: {
    Entry?: ContentfulIncludedEntry[];
  };
}

interface ContentfulScheduleEvent {
  sys?: {
    id?: string;
  };
  fields?: {
    entryTitle?: string;
    eventName?: string;
    eventScheduleType?: {
      sys?: {
        id?: string;
      };
    };
    year?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    month?: string;
    dates?: string;
    gameType?: string;
    link?: string;
  };
}

interface ContentfulIncludedEntry {
  sys?: {
    id?: string;
    contentType?: {
      sys?: {
        id?: string;
      };
    };
  };
  fields?: {
    name?: string;
    typeTitle?: string;
    color?: string;
  };
}

export function parsePremierLeagueMatches(
  data: FootballDataMatchesResponse,
  sourceUrl: string,
  now: Date
): EventCandidate[] {
  const candidates = (data.matches ?? [])
    .filter((match) => isUpcomingFootballMatch(match, now))
    .map((match) =>
      toFootballCandidate(
        match,
        data.competition,
        sourceUrl,
        "premier_league"
      )
    );

  return dedupeCandidates(candidates);
}

export function parseChampionsLeagueMatches(
  data: FootballDataMatchesResponse,
  sourceUrl: string,
  now: Date
): EventCandidate[] {
  const candidates = (data.matches ?? [])
    .filter((match) => isUpcomingFootballMatch(match, now))
    .map((match) =>
      toFootballCandidate(
        match,
        data.competition,
        sourceUrl,
        "champions_league"
      )
    );

  return dedupeCandidates(candidates);
}

function isUpcomingFootballMatch(match: FootballDataMatch, now: Date) {
  if (!match.utcDate) {
    return false;
  }

  const startsAt = new Date(match.utcDate);

  if (!Number.isFinite(startsAt.getTime()) || startsAt < now) {
    return false;
  }

  return !["FINISHED", "CANCELLED", "POSTPONED", "SUSPENDED"].includes(
    match.status ?? ""
  );
}

function toFootballCandidate(
  match: FootballDataMatch,
  competition: FootballDataMatchesResponse["competition"],
  sourceUrl: string,
  source: "premier_league" | "champions_league"
): EventCandidate {
  const homeTeam = match.homeTeam?.name ?? "TBD";
  const awayTeam = match.awayTeam?.name ?? "TBD";
  const startsAt = new Date(match.utcDate ?? "").toISOString();

  return {
    id: `${source}:${match.id ?? slugify(`${homeTeam}:${awayTeam}:${startsAt}`)}`,
    title: normaliseTitle(`${homeTeam} v ${awayTeam}`),
    startsAt,
    source,
    sourceUrl,
    audience: ["Family"],
    metadata: {
      matchId: match.id ?? null,
      status: match.status ?? null,
      matchday: match.matchday ?? null,
      stage: match.stage ?? null,
      group: match.group ?? null,
      homeTeamId: match.homeTeam?.id ?? null,
      homeTeamName: match.homeTeam?.name ?? null,
      homeTeamShortName: match.homeTeam?.shortName ?? null,
      homeTeamTla: match.homeTeam?.tla ?? null,
      awayTeamId: match.awayTeam?.id ?? null,
      awayTeamName: match.awayTeam?.name ?? null,
      awayTeamShortName: match.awayTeam?.shortName ?? null,
      awayTeamTla: match.awayTeam?.tla ?? null,
      competitionId: match.competition?.id ?? competition?.id ?? null,
      competitionName: match.competition?.name ?? competition?.name ?? null,
      competitionCode: match.competition?.code ?? competition?.code ?? null,
      seasonId: match.season?.id ?? null,
      lastUpdated: match.lastUpdated ?? null
    }
  };
}

export function parseCrossFitGamesCompetitions(
  competitions: CrossFitCompetition[],
  sourceUrl: string,
  now: Date
): EventCandidate[] {
  const candidates = competitions
    .filter(isCurrentCrossFitGamesCompetition)
    .filter((competition) => isCurrentOrFutureCompetition(competition, now))
    .map((competition) => toCrossFitGamesCandidate(competition, sourceUrl));

  return dedupeCandidates(candidates);
}

export function parseMagicProTourSchedule(
  data: ContentfulScheduleResponse,
  sourceUrl: string,
  now: Date
): EventCandidate[] {
  const eventTypesById = new Map(
    (data.includes?.Entry ?? [])
      .filter((entry) => entry.sys?.contentType?.sys?.id === "eventType")
      .map((entry) => [entry.sys?.id, entry.fields?.typeTitle])
      .filter(
        (entry): entry is [string, string] =>
          typeof entry[0] === "string" && typeof entry[1] === "string"
      )
  );

  const candidates = (data.items ?? [])
    .filter((event) => isMagicProTourEvent(event, eventTypesById))
    .filter((event) => isUpcomingContentfulEvent(event, now))
    .flatMap((event) => toMagicProTourCandidates(event, sourceUrl));

  return dedupeMagicProTourDays(candidates);
}

function dedupeMagicProTourDays(candidates: EventCandidate[]) {
  const candidatesByDay = new Map<string, EventCandidate>();

  for (const candidate of candidates) {
    const day = candidate.startsAt.slice(0, 10);
    const key = `${normaliseTitle(candidate.title).toLowerCase()}:${day}`;
    const existing = candidatesByDay.get(key);

    // Magic's schedule can contain both a multi-day tournament entry and
    // individual broadcast entries. Prefer the individual entry; it has the
    // authoritative start/end time for that day's coverage.
    if (
      !existing ||
      magicEventDayCount(candidate) < magicEventDayCount(existing)
    ) {
      candidatesByDay.set(key, candidate);
    }
  }

  return [...candidatesByDay.values()].sort((left, right) =>
    left.startsAt.localeCompare(right.startsAt)
  );
}

function magicEventDayCount(candidate: EventCandidate) {
  const dayCount = candidate.metadata?.eventDayCount;
  return typeof dayCount === "number" ? dayCount : Number.POSITIVE_INFINITY;
}

function isMagicProTourEvent(
  event: ContentfulScheduleEvent,
  eventTypesById: Map<string, string>
) {
  const eventTypeId = event.fields?.eventScheduleType?.sys?.id;
  const eventType = eventTypeId ? eventTypesById.get(eventTypeId) : undefined;
  const title = event.fields?.eventName ?? event.fields?.entryTitle ?? "";

  return eventType === "Pro Tour" || normaliseTitle(title).startsWith("Pro Tour ");
}

function isUpcomingContentfulEvent(event: ContentfulScheduleEvent, now: Date) {
  const date = event.fields?.endTime ?? event.fields?.startTime;

  if (!date) {
    return false;
  }

  const endsAt = new Date(date);
  return Number.isFinite(endsAt.getTime()) && endsAt >= now;
}

function toMagicProTourCandidates(
  event: ContentfulScheduleEvent,
  sourceUrl: string
): EventCandidate[] {
  const title = normaliseTitle(
    event.fields?.eventName ?? event.fields?.entryTitle ?? "Magic Pro Tour"
  );
  const eventStart = new Date(event.fields?.startTime ?? "");
  const eventEnd = event.fields?.endTime
    ? new Date(event.fields.endTime)
    : undefined;
  const dayMs = 24 * 60 * 60 * 1000;
  const durationMs = eventEnd
    ? Math.max(0, eventEnd.getTime() - eventStart.getTime())
    : 0;
  const dayCount = durationMs > dayMs ? Math.floor(durationMs / dayMs) + 1 : 1;
  const dailyDurationMs = eventEnd
    ? Math.max(0, durationMs - (dayCount - 1) * dayMs)
    : undefined;
  const contentfulId =
    event.sys?.id ?? slugify(`${title}:${eventStart.toISOString()}`);

  return Array.from({ length: dayCount }, (_, dayIndex) => {
    const dayStart = new Date(eventStart.getTime() + dayIndex * dayMs);
    const dayEnd =
      dailyDurationMs === undefined
        ? undefined
        : new Date(dayStart.getTime() + dailyDurationMs);

    return {
      id: `magic_pro_tour:${contentfulId}:day-${dayIndex + 1}`,
      title,
      startsAt: dayStart.toISOString(),
      endsAt: dayEnd?.toISOString(),
      source: "magic_pro_tour",
      sourceUrl: event.fields?.link ?? sourceUrl,
      audience: ["Family"],
      metadata: {
        contentfulId: event.sys?.id ?? null,
        eventDay: dayIndex + 1,
        eventDayCount: dayCount,
        location: event.fields?.location ?? null,
        year: event.fields?.year ?? null,
        month: event.fields?.month ?? null,
        dates: event.fields?.dates ?? null,
        gameType: event.fields?.gameType ?? null,
        scheduleUrl: sourceUrl
      }
    };
  });
}

function isCurrentCrossFitGamesCompetition(competition: CrossFitCompetition) {
  return (
    competition.active === true &&
    competition.type === "finals" &&
    competition.slug === "finals" &&
    typeof competition.start_date === "string" &&
    typeof competition.end_date === "string"
  );
}

function isCurrentOrFutureCompetition(
  competition: CrossFitCompetition,
  now: Date
) {
  if (!competition.end_date) {
    return false;
  }

  const endsAt = new Date(competition.end_date);
  return Number.isFinite(endsAt.getTime()) && endsAt >= now;
}

function toCrossFitGamesCandidate(
  competition: CrossFitCompetition,
  sourceUrl: string
): EventCandidate {
  const year = competition.year ?? new Date(competition.start_date ?? "").getUTCFullYear();
  const title = normaliseTitle(`${year} CrossFit Games`);
  const startsAt = new Date(competition.start_date ?? "").toISOString();
  const endsAt = new Date(competition.end_date ?? "").toISOString();

  return {
    id: `crossfit_games:${slugify(`${competition.identifier ?? competition.id}:${startsAt}`)}`,
    title,
    startsAt,
    endsAt,
    source: "crossfit_games",
    sourceUrl,
    audience: ["Family"],
    metadata: {
      competitionId: competition.id ?? null,
      competitionIdentifier: competition.identifier ?? null,
      competitionName: competition.competition_name ?? competition.name ?? null,
      competitionNameShort: competition.competition_name_short ?? null,
      slug: competition.slug ?? null,
      type: competition.type ?? null
    }
  };
}

export function parseSpringboksMatchCentre(
  html: string,
  sourceUrl: string,
  now: Date
): EventCandidate[] {
  const events = extractJsonLdSportsEvents(html);
  const candidates = events
    .filter(isSeniorSpringboksEvent)
    .filter((event) => isFutureEvent(event, now))
    .map((event) => toSpringboksCandidate(event, sourceUrl));

  return dedupeCandidates(candidates);
}

function extractJsonLdSportsEvents(html: string): JsonLdSportsEvent[] {
  const blocks = html.matchAll(
    /<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g
  );
  const events: JsonLdSportsEvent[] = [];

  for (const block of blocks) {
    const rawJson = block[1];

    if (!rawJson) {
      continue;
    }

    const parsed = JSON.parse(rawJson) as JsonLdItemList;
    const items = parsed.itemListElement ?? [];

    for (const item of items) {
      if (item.item?.["@type"] === "SportsEvent") {
        events.push(item.item);
      }
    }
  }

  return events;
}

function isSeniorSpringboksEvent(event: JsonLdSportsEvent) {
  return getCompetitorNames(event).some((name) => name === "Springboks");
}

function isFutureEvent(event: JsonLdSportsEvent, now: Date) {
  if (!event.startDate) {
    return false;
  }

  const startsAt = new Date(event.startDate);
  return Number.isFinite(startsAt.getTime()) && startsAt >= now;
}

function toSpringboksCandidate(
  event: JsonLdSportsEvent,
  sourceUrl: string
): EventCandidate {
  const title = normaliseTitle(event.name ?? "Springboks fixture");
  const startsAt = new Date(event.startDate ?? "").toISOString();
  const competitors = getCompetitorNames(event);
  const venue = event.location?.name;

  return {
    id: `springboks:${slugify(`${title}:${startsAt}`)}`,
    title,
    startsAt,
    source: "springboks",
    sourceUrl,
    audience: ["Ewan"],
    metadata: {
      competitors: competitors.join(" | "),
      venue: venue ?? null,
      sport: event.sport ?? null,
      organizerName: event.organizer?.name ?? null,
      organizerUrl: event.organizer?.url ?? null
    }
  };
}

function getCompetitorNames(event: JsonLdSportsEvent) {
  return (event.competitor ?? [])
    .map((competitor) => competitor.name?.trim())
    .filter((name): name is string => Boolean(name));
}

function dedupeCandidates(candidates: EventCandidate[]) {
  const seen = new Set<string>();
  const deduped: EventCandidate[] = [];

  for (const candidate of candidates) {
    if (seen.has(candidate.id)) {
      continue;
    }

    seen.add(candidate.id);
    deduped.push(candidate);
  }

  return deduped;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}
