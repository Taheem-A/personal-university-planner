import type { CourseColor } from "./planner-primitives";

export function courseColor(reference: string | null | undefined): CourseColor {
  const colors: Record<string, CourseColor> = {
    blue: "blue",
    sky: "blue",
    indigo: "violet",
    teal: "teal",
    green: "green",
    emerald: "green",
    amber: "amber",
    orange: "orange",
    rose: "rose",
    red: "rose",
    violet: "violet",
    purple: "violet",
    slate: "slate",
  };
  return colors[reference?.toLowerCase() ?? ""] ?? "slate";
}
