export default function BootstrapPage() {
  return (
    <main className="bootstrap-shell">
      <section className="bootstrap-panel" aria-labelledby="bootstrap-title">
        <p className="bootstrap-kicker">Production runtime</p>
        <h1 id="bootstrap-title">University Planner</h1>
        <p>
          The real Next.js application boundary is running. Product screens are intentionally
          not being rebuilt from fixture state here; the approved preview remains the visual
          regression reference while the canonical data and planner services are connected.
        </p>
        <dl>
          <div>
            <dt>Active milestone</dt>
            <dd>0 — Production Bootstrap and Baseline Preservation</dd>
          </div>
          <div>
            <dt>Canonical UI data</dt>
            <dd>Not connected yet</dd>
          </div>
          <div>
            <dt>Approved preview</dt>
            <dd>Preserved separately in /preview</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
