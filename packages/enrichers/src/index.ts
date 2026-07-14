import { normaliseTitle, type EventCandidate } from "@watson/core";

export interface EventEnricher {
  readonly name: string;
  enrich(candidate: EventCandidate): Promise<EventCandidate>;
}

export async function enrichCandidate(
  candidate: EventCandidate,
  enrichers: EventEnricher[],
  onError: (enricher: EventEnricher, error: unknown) => void = () => undefined
): Promise<EventCandidate> {
  let enriched = candidate;

  for (const enricher of enrichers) {
    try {
      enriched = await enricher.enrich(enriched);
    } catch (error) {
      onError(enricher, error);
    }
  }

  return enriched;
}

export class YouTubeEnricher implements EventEnricher {
  readonly name = "youtube";

  constructor(
    private readonly options: {
      apiKey?: string;
      fetcher?: typeof fetch;
      lookaheadDays?: number;
      maximumTimeDifferenceHours?: number;
      now?: () => Date;
    } = {}
  ) {}

  async enrich(candidate: EventCandidate): Promise<EventCandidate> {
    if (!this.options.apiKey) return candidate;
    if (!isWithinLookahead(
      candidate,
      this.options.now?.() ?? new Date(),
      this.options.lookaheadDays ?? 14
    )) return candidate;

    const fetcher = this.options.fetcher ?? fetch;
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("eventType", "upcoming");
    searchUrl.searchParams.set("maxResults", "10");
    searchUrl.searchParams.set("q", candidate.title);
    searchUrl.searchParams.set("key", this.options.apiKey);

    const searchResponse = await fetcher(searchUrl);
    if (!searchResponse.ok) {
      throw new Error(`YouTube search failed: ${searchResponse.status}`);
    }

    const search = (await searchResponse.json()) as YouTubeSearchResponse;
    const ids = (search.items ?? [])
      .map((item) => item.id?.videoId)
      .filter((id): id is string => Boolean(id));
    if (ids.length === 0) return candidate;

    const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    videosUrl.searchParams.set("part", "snippet,liveStreamingDetails");
    videosUrl.searchParams.set("id", ids.join(","));
    videosUrl.searchParams.set("key", this.options.apiKey);

    const videosResponse = await fetcher(videosUrl);
    if (!videosResponse.ok) {
      throw new Error(`YouTube video lookup failed: ${videosResponse.status}`);
    }

    const videos = (await videosResponse.json()) as YouTubeVideosResponse;
    const match = findBestTimedMatch(
      candidate,
      (videos.items ?? []).flatMap((video) => {
        const startsAt = video.liveStreamingDetails?.scheduledStartTime;
        if (!video.id || !video.snippet?.title || !startsAt) return [];
        return [{
          id: video.id,
          title: video.snippet.title,
          startsAt,
          channelTitle: video.snippet.channelTitle
        }];
      }),
      this.options.maximumTimeDifferenceHours ?? 12
    );

    if (!match) return candidate;

    return withMetadata(candidate, {
      livestreamPlatform: "youtube",
      youtubeVideoId: match.id,
      youtubeUrl: `https://www.youtube.com/watch?v=${match.id}`,
      youtubeScheduledStart: match.startsAt,
      youtubeTitle: match.title,
      youtubeChannelTitle: match.channelTitle ?? null
    });
  }
}

export class DstvEnricher implements EventEnricher {
  readonly name = "dstv";

  constructor(
    private readonly options: {
      fetcher?: typeof fetch;
      guideUrl?: string;
      lookaheadDays?: number;
      maximumTimeDifferenceHours?: number;
      now?: () => Date;
    } = {}
  ) {}

  async enrich(candidate: EventCandidate): Promise<EventCandidate> {
    const eventStart = new Date(candidate.startsAt);
    if (Number.isNaN(eventStart.getTime())) return candidate;
    if (!isWithinLookahead(
      candidate,
      this.options.now?.() ?? new Date(),
      this.options.lookaheadDays ?? 14
    )) return candidate;

    const guideUrl = new URL(
      this.options.guideUrl ?? "https://supersport.com/apix/guide/v6/tvguide"
    );
    guideUrl.searchParams.set("countryCode", "za");
    guideUrl.searchParams.set("startDateTime", shiftHours(eventStart, -12).toISOString());
    guideUrl.searchParams.set("endDateTime", shiftHours(eventStart, 12).toISOString());
    guideUrl.searchParams.set("removeCompletedEvents", "false");

    const response = await (this.options.fetcher ?? fetch)(guideUrl);
    if (!response.ok) {
      throw new Error(`SuperSport TV guide lookup failed: ${response.status}`);
    }

    const body = await response.text();
    if (body.trim().length === 0) return candidate;

    let payload: unknown;
    try {
      payload = JSON.parse(body) as unknown;
    } catch {
      throw new Error("SuperSport TV guide returned an invalid JSON response");
    }
    const broadcasts = extractBroadcasts(payload);
    const match = findBestTimedMatch(
      candidate,
      broadcasts,
      this.options.maximumTimeDifferenceHours ?? 4
    );
    if (!match) return candidate;

    return withMetadata(candidate, {
      broadcastPlatform: "dstv",
      dstvTitle: match.title,
      dstvStartsAt: match.startsAt,
      dstvEndsAt: match.endsAt ?? null,
      dstvChannels: match.channels?.join(", ") ?? null,
      dstvIsLive: match.isLive ?? null
    });
  }
}

export function getDefaultEnrichers(config: {
  youtubeApiKey?: string;
}): EventEnricher[] {
  return [
    new YouTubeEnricher({ apiKey: config.youtubeApiKey }),
    new DstvEnricher()
  ];
}

interface TimedItem {
  id?: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  channelTitle?: string;
  channels?: string[];
  isLive?: boolean;
}

interface YouTubeSearchResponse {
  items?: Array<{ id?: { videoId?: string } }>;
}

interface YouTubeVideosResponse {
  items?: Array<{
    id?: string;
    snippet?: { title?: string; channelTitle?: string };
    liveStreamingDetails?: { scheduledStartTime?: string };
  }>;
}

function findBestTimedMatch<T extends TimedItem>(
  candidate: EventCandidate,
  items: T[],
  maximumTimeDifferenceHours: number
): T | undefined {
  const candidateTime = new Date(candidate.startsAt).getTime();
  const maximumDifference = maximumTimeDifferenceHours * 60 * 60 * 1000;

  return items
    .map((item) => ({
      item,
      timeDifference: Math.abs(new Date(item.startsAt).getTime() - candidateTime),
      titleScore: titleSimilarity(candidate.title, item.title)
    }))
    .filter(({ timeDifference, titleScore }) =>
      Number.isFinite(timeDifference) &&
      timeDifference <= maximumDifference &&
      titleScore >= 0.3
    )
    .sort((a, b) =>
      b.titleScore - a.titleScore || a.timeDifference - b.timeDifference
    )[0]?.item;
}

function titleSimilarity(left: string, right: string) {
  const leftTokens = titleTokens(left);
  const rightTokens = titleTokens(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return shared / Math.min(leftTokens.size, rightTokens.size);
}

function titleTokens(title: string) {
  const aliases: Record<string, string> = {
    springboks: "south africa",
    boks: "south africa"
  };
  let normalised = normaliseTitle(title).toLowerCase();
  for (const [alias, replacement] of Object.entries(aliases)) {
    normalised = normalised.replaceAll(alias, replacement);
  }

  return new Set(
    normalised
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
  );
}

const STOP_WORDS = new Set(["live", "the", "and", "from", "official", "stream"]);

function extractBroadcasts(payload: unknown): TimedItem[] {
  const records = findRecordArray(payload);
  return records.flatMap((record) => {
    const title = stringValue(record.title) ?? stringValue(record.name);
    const startsAt =
      stringValue(record.utcStart) ??
      stringValue(record.startTime) ??
      stringValue(record.startsAt);
    if (!title || !startsAt) return [];

    const rawChannels = Array.isArray(record.channel)
      ? record.channel
      : Array.isArray(record.channels)
        ? record.channels
        : [];
    const channels = rawChannels.flatMap((channel) => {
      if (typeof channel === "string") return [channel];
      if (!isRecord(channel)) return [];
      return [stringValue(channel.name) ?? stringValue(channel.channelName)].filter(
        (value): value is string => Boolean(value)
      );
    });

    return [{
      title,
      startsAt,
      endsAt: stringValue(record.utcEnd) ?? stringValue(record.endTime),
      channels,
      isLive: typeof record.isLive === "boolean" ? record.isLive : undefined
    }];
  });
}

function findRecordArray(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  for (const key of ["data", "events", "items", "results"]) {
    const value = payload[key];
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  return [];
}

function withMetadata(
  candidate: EventCandidate,
  metadata: NonNullable<EventCandidate["metadata"]>
): EventCandidate {
  return { ...candidate, metadata: { ...candidate.metadata, ...metadata } };
}

function shiftHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function isWithinLookahead(
  candidate: EventCandidate,
  now: Date,
  lookaheadDays: number
) {
  const startsAt = new Date(candidate.startsAt).getTime();
  const earliest = now.getTime() - 60 * 60 * 1000;
  const latest = now.getTime() + lookaheadDays * 24 * 60 * 60 * 1000;
  return Number.isFinite(startsAt) && startsAt >= earliest && startsAt <= latest;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
