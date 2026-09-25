"use client";

export default function PlannerError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="route-content route-state" role="alert">
      <h1>This screen could not load</h1>
      <p>Your planner data has not been changed. Try loading the screen again.</p>
      <button className="button button-primary" type="button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
