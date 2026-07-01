import { evaluateCandidate, type EventCandidate } from "@watson/core";

const sampleCandidates: EventCandidate[] = [
  {
    id: "springboks-sample",
    title: "Springboks vs Ireland",
    startsAt: "2026-07-11T15:00:00.000Z",
    source: "springboks",
    sourceUrl: "https://www.sarugby.co.za",
    audience: ["Ewan"]
  },
  {
    id: "family-sample",
    title: "Local theatre livestream",
    startsAt: "2026-07-12T18:30:00.000Z",
    source: "manual",
    audience: ["Family"]
  }
];

export default function HomePage() {
  const decisions = sampleCandidates.map((candidate) => ({
    candidate,
    decision: evaluateCandidate(candidate)
  }));

  return (
    <main>
      <div className="dashboard">
        <section>
          <h1>Watson</h1>
          <p>
            Event candidates are discovered by providers, scored by deterministic
            rules, and then suggested or added to Google Calendar.
          </p>
        </section>

        <section className="panel" aria-label="Candidate review">
          <h2>Candidate Review</h2>
          {decisions.map(({ candidate, decision }) => (
            <article className="candidate" key={candidate.id}>
              <strong>{candidate.title}</strong>
              <span className="meta">
                {candidate.source} / {decision.importance} / {decision.action}
              </span>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

