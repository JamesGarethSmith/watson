import type { EventCandidate } from "@watson/core";

export interface SourceProvider {
  readonly name: string;
  discover(): Promise<EventCandidate[]>;
}

export class ManualProvider implements SourceProvider {
  readonly name = "manual";

  async discover(): Promise<EventCandidate[]> {
    return [];
  }
}

export class SpringboksProvider implements SourceProvider {
  readonly name = "springboks";

  async discover(): Promise<EventCandidate[]> {
    return [];
  }
}

export class PremierLeagueProvider implements SourceProvider {
  readonly name = "premier_league";

  async discover(): Promise<EventCandidate[]> {
    return [];
  }
}

export class YouTubeProvider implements SourceProvider {
  readonly name = "youtube";

  async discover(): Promise<EventCandidate[]> {
    return [];
  }
}

export function getDefaultProviders(): SourceProvider[] {
  return [
    new SpringboksProvider(),
    new PremierLeagueProvider(),
    new YouTubeProvider(),
    new ManualProvider()
  ];
}

