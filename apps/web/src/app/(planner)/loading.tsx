import { SkeletonLine } from "../../components/planner-primitives";

export default function PlannerLoading() {
  return (
    <div className="route-content route-state" role="status" aria-label="Loading planner screen">
      <h1>Loading your planner…</h1>
      <SkeletonLine width="min(36ch, 80%)" />
      <SkeletonLine width="min(58ch, 100%)" />
    </div>
  );
}
