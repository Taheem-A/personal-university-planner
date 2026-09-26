import { redirect } from "next/navigation";
import { secondaryViews } from "../../../server/application/secondary-reads";
import { CoursesView } from "../../../components/courses-view";
import { InlineState } from "../../../components/planner-primitives";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const result = await secondaryViews.courses(
    typeof query.course === "string" ? { courseId: query.course } : {},
  );
  if (!result.ok) {
    if (result.error.code === "UNAUTHORIZED") redirect("/sign-in");
    return (
      <div className="route-content">
        <h1>Courses</h1>
        <InlineState kind="error" title="Courses could not load">
          <p>{result.error.message}</p>
        </InlineState>
      </div>
    );
  }
  return <CoursesView model={result.value} />;
}
