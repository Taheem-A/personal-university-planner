import type { ReactNode } from "react";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { authenticatedActor } from "../../server/auth";
import { AppShell } from "../../components/app-shell";

export default async function PlannerLayout({ children }: { children: ReactNode }) {
  await connection();
  const actor = await authenticatedActor();
  if (!actor) redirect("/sign-in");
  return (
    <Suspense fallback={<div className="shell-loading">Loading planner…</div>}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
