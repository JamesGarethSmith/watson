import assert from "node:assert/strict";
import test from "node:test";
import { createWatsonDbFromClient, isEventLive } from "../src/index.ts";

const now = new Date("2026-10-18T15:00:00.000Z");

function row(id, startsAt, endsAt = null, source = "premier_league") {
  return {
    id,
    title: id,
    starts_at: startsAt,
    ends_at: endsAt,
    source,
    source_url: null,
    audience: ["Family"],
    importance: "nice_to_watch",
    action: "suggest",
    calendar_event_id: null,
    metadata: {},
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };
}

test("keeps ongoing events with or without an explicit end time", async () => {
  const rows = [
    row("live-without-end", "2026-10-18T14:00:00.000Z"),
    row("ended-without-end", "2026-10-18T11:00:00.000Z"),
    row("ended-football", "2026-10-18T13:05:00.000Z"),
    row("ended-rugby", "2026-10-18T13:15:00.000Z", null, "springboks"),
    row("live-with-end", "2026-10-18T12:00:00.000Z", "2026-10-18T16:00:00.000Z"),
    row("ended-with-end", "2026-10-18T14:00:00.000Z", "2026-10-18T14:30:00.000Z"),
    row("upcoming", "2026-10-18T16:00:00.000Z")
  ];
  let filter = "";
  const query = {
    select() {
      return this;
    },
    or(value) {
      filter = value;
      return this;
    },
    order() {
      const [startCutoff, endCutoff] = [
        ...filter.matchAll(/(?:starts_at|ends_at)\.g(?:te|t)\.([^,]+)/g)
      ].map((match) => match[1]);
      return Promise.resolve({
        data: rows.filter((event) =>
          event.starts_at >= startCutoff || (event.ends_at && event.ends_at > endCutoff)
        ),
        error: null
      });
    }
  };
  const db = createWatsonDbFromClient({ from: () => query });

  const events = await db.listUpcomingEvents(now);

  assert.deepEqual(events.map((event) => event.id), [
    "live-without-end",
    "live-with-end",
    "upcoming"
  ]);
  assert.equal(isEventLive(events[0], now), true);
  assert.equal(isEventLive(events[1], now), true);
  assert.equal(isEventLive(events[2], now), false);
});

test("live state ends at the recorded or assumed end time", () => {
  assert.equal(isEventLive({ source: "manual", startsAt: "2026-10-18T12:00:00.000Z" }, now), false);
  assert.equal(
    isEventLive({ source: "premier_league", startsAt: "2026-10-18T14:00:00.000Z", endsAt: now.toISOString() }, now),
    false
  );
  assert.equal(isEventLive({ source: "manual", startsAt: now.toISOString() }, now), true);
});

test("football and rugby use source-specific durations when the end is missing", () => {
  const cases = [
    { source: "premier_league", startsAt: "2026-10-18T13:05:00.000Z", live: false },
    { source: "champions_league", startsAt: "2026-10-18T13:06:00.000Z", live: true },
    { source: "springboks", startsAt: "2026-10-18T13:15:00.000Z", live: false },
    { source: "springboks", startsAt: "2026-10-18T13:16:00.000Z", live: true },
    { source: "manual", startsAt: "2026-10-18T12:01:00.000Z", live: true }
  ];

  for (const { source, startsAt, live } of cases) {
    assert.equal(isEventLive({ source, startsAt }, now), live, `${source} at ${startsAt}`);
  }
});
