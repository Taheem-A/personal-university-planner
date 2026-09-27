import { localDateTimeToInstant } from "@university-planner/shared";

export type InboxProposal = {
  proposedEntityType: "TASK" | "ASSESSMENT" | "CALENDAR_EVENT";
  proposedPayload: {
    title: string;
    courseId: string | null;
    durationMinutes?: number | null;
    dueAt?: string | null;
    startAt?: string | null;
    endAt?: string | null;
  };
};

/** Explicit, semicolon-separated grammar only. No fuzzy dates or inferred deadlines. */
export function interpretInboxText(
  rawText: string,
  courses: { id: string; code: string }[],
  timezone: string,
): InboxProposal | null {
  const [head, ...facts] = rawText
    .trim()
    .split(";")
    .map((part) => part.trim());
  const match = /^(task|assignment|event):\s*(.{1,500})$/i.exec(head ?? "");
  if (!match) return null;
  const kind = match[1].toLowerCase();
  const title = match[2].trim();
  if (!title) return null;
  let courseId: string | null = null;
  let durationMinutes: number | null = null;
  let dueAt: string | null = null;
  let startAt: string | null = null;
  let endAt: string | null = null;
  const seen = new Set<string>();
  for (const fact of facts) {
    const pair = /^(course|duration|due|start|end)\s+(.+)$/i.exec(fact);
    if (!pair) return null;
    const key = pair[1].toLowerCase();
    if (seen.has(key)) return null;
    seen.add(key);
    const value = pair[2].trim();
    if (key === "course") {
      const matches = courses.filter((course) => course.code.toUpperCase() === value.toUpperCase());
      if (matches.length !== 1) return null;
      courseId = matches[0].id;
    } else if (key === "duration") {
      const duration = /^(\d{1,4})(h|m)$/i.exec(value);
      if (!duration) return null;
      durationMinutes = Number(duration[1]) * (duration[2].toLowerCase() === "h" ? 60 : 1);
      if (durationMinutes < 1 || durationMinutes > 100_000) return null;
    } else {
      const instant = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/.exec(value);
      if (!instant) return null;
      try {
        const parsed = localDateTimeToInstant(
          { date: instant[1], time: instant[2], timezone },
          "REJECT",
        ).toISOString();
        if (key === "due") dueAt = parsed;
        if (key === "start") startAt = parsed;
        if (key === "end") endAt = parsed;
      } catch {
        return null;
      }
    }
  }
  if (kind === "event" && (seen.has("due") || seen.has("duration"))) return null;
  if (kind !== "event" && (seen.has("start") || seen.has("end"))) return null;
  if (kind === "assignment" && seen.has("duration")) return null;
  if (startAt && endAt && startAt >= endAt) return null;
  if (kind === "task")
    return {
      proposedEntityType: "TASK",
      proposedPayload: { title, courseId, durationMinutes, dueAt },
    };
  if (kind === "assignment")
    return { proposedEntityType: "ASSESSMENT", proposedPayload: { title, courseId, dueAt } };
  return {
    proposedEntityType: "CALENDAR_EVENT",
    proposedPayload: { title, courseId, startAt, endAt },
  };
}
