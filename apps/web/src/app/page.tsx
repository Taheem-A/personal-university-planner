import { readEnvironment } from "../lib/env";

const foundations = [
  "Next.js App Router and strict TypeScript",
  "Framework-independent planner core preserved",
  "PostgreSQL, Auth.js, and service boundaries staged for later milestones",
];

export default function HomePage() {
  const environment = readEnvironment();

  return (
    <main>
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">University Planner · Milestone 0</p>
        <h1 id="page-title">Production foundation ready.</h1>
        <p className="lede">
          The real application shell is running. Canonical data, authentication, and connected
          planning workflows arrive in dependency order; the approved preview remains a separate
          regression reference.
        </p>
        <dl className="status-grid">
          <div>
            <dt>Runtime</dt>
            <dd>Next.js</dd>
          </div>
          <div>
            <dt>Environment</dt>
            <dd>{environment.publicEnvironment}</dd>
          </div>
          <div>
            <dt>Architecture</dt>
            <dd>Modular monolith</dd>
          </div>
        </dl>
      </section>
      <section className="foundation" aria-labelledby="foundation-title">
        <h2 id="foundation-title">Bootstrap boundary</h2>
        <ul>
          {foundations.map((foundation) => (
            <li key={foundation}>{foundation}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
