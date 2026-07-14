import { createWatsonDbFromClient, type ScheduledEvent } from "@watson/db";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../lib/supabase/server";
import { logout } from "./auth-actions";

export const dynamic = "force-dynamic";

const timeZone = "Africa/Johannesburg";

const sourceLabels: Record<ScheduledEvent["source"], string> = {
  crossfit_games: "CrossFit Games",
  magic_pro_tour: "Magic Pro Tour",
  springboks: "Springboks",
  premier_league: "Premier League",
  manual: "Manual"
};

const actionLabels: Record<ScheduledEvent["action"], string> = {
  auto_add: "Auto-add",
  suggest: "Suggested",
  ignore: "Ignored"
};

function dateKey(event: ScheduledEvent) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(event.startsAt));
}

function groupByDate(events: ScheduledEvent[]) {
  return events.reduce<Map<string, ScheduledEvent[]>>((groups, event) => {
    const key = dateKey(event);
    groups.set(key, [...(groups.get(key) ?? []), event]);
    return groups;
  }, new Map());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(new Date(`${value}T12:00:00+02:00`));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

async function getEvents() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { events: [], status: "unconfigured" as const };
  }

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/login");
  }

  try {
    const db = createWatsonDbFromClient(supabase);
    return { events: await db.listUpcomingEvents(), status: "ready" as const };
  } catch (error) {
    console.error("Unable to load upcoming events", error);
    return { events: [], status: "error" as const };
  }
}

export default async function HomePage() {
  const { events, status } = await getEvents();
  const groups = groupByDate(events);

  return (
    <main>
      <div className="dashboard">
        <header className="hero">
          <div>
            <p className="eyebrow">Family calendar</p>
            <h1>What&rsquo;s on?</h1>
            <p className="intro">
              Upcoming live events Watson has found for the family.
            </p>
          </div>
          {events.length > 0 && (
            <div className="event-count" aria-label={`${events.length} events`}>
              <strong>{events.length}</strong>
              <span>{events.length === 1 ? "event" : "events"}</span>
            </div>
          )}
          <form action={logout} className="logout-form">
            <button type="submit">Sign out</button>
          </form>
        </header>

        {status === "unconfigured" && (
          <section className="notice">
            <h2>Connect Supabase</h2>
            <p>
              Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to{" "}
              <code>apps/web/.env.local</code> to see upcoming events.
            </p>
          </section>
        )}

        {status === "error" && (
          <section className="notice notice-error">
            <h2>Events couldn&rsquo;t be loaded</h2>
            <p>Check the Supabase connection and try refreshing the page.</p>
          </section>
        )}

        {status === "ready" && events.length === 0 && (
          <section className="notice">
            <h2>No upcoming events yet</h2>
            <p>The next ingestion run will add newly discovered events here.</p>
          </section>
        )}

        {events.length > 0 && (
          <section className="schedule" aria-label="Upcoming events">
            {[...groups.entries()].map(([date, dateEvents]) => (
              <div className="day" key={date}>
                <h2>{formatDate(date)}</h2>
                <div className="event-list">
                  {dateEvents.map((event) => (
                    <article className="event" key={event.id}>
                      <time dateTime={event.startsAt}>
                        {formatTime(event.startsAt)}
                      </time>
                      <div className="event-details">
                        <h3>
                          {event.sourceUrl ? (
                            <a href={event.sourceUrl}>{event.title}</a>
                          ) : (
                            event.title
                          )}
                        </h3>
                        <div className="meta">
                          <span>{sourceLabels[event.source]}</span>
                          <span>{event.audience.join(", ")}</span>
                        </div>
                      </div>
                      <span className={`badge badge-${event.action}`}>
                        {actionLabels[event.action]}
                      </span>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
