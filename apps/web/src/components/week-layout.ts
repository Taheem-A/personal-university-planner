import { addLocalDays, instantToLocal, localDateTimeToInstant } from "@university-planner/shared";
import type { ScheduleItem } from "../server/application/planner-reads";

export interface WeekSegment {
  item: ScheduleItem;
  day: string;
  startMinute: number;
  endMinute: number;
  lane: number;
  laneCount: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

function minute(instant: Date, timezone: string) {
  const local = instantToLocal(instant, timezone).time;
  const [hours, minutes] = local.split(":").map(Number);
  return hours * 60 + minutes;
}

// This is a visual projection only. Each item is clipped using real day instants;
// wall-clock positions are derived in the user's timezone, never the browser's.
export function layoutWeek(
  items: ScheduleItem[],
  weekStart: string,
  timezone: string,
): WeekSegment[][] {
  return Array.from({ length: 7 }, (_, index) => {
    const day = addLocalDays(weekStart, index);
    const start = localDateTimeToInstant({ date: day, time: "00:00", timezone });
    const end = localDateTimeToInstant({
      date: addLocalDays(day, 1),
      time: "00:00",
      timezone,
    });
    const segments: WeekSegment[] = items
      .filter((item) => item.startAt < end && item.endAt > start)
      .map((item) => {
        const clippedStart = new Date(Math.max(start.getTime(), item.startAt.getTime()));
        const clippedEnd = new Date(Math.min(end.getTime(), item.endAt.getTime()));
        const startMinute = item.startAt < start ? 0 : minute(clippedStart, timezone);
        const wallEnd = item.endAt >= end ? 1440 : minute(clippedEnd, timezone);
        const elapsed = (clippedEnd.getTime() - clippedStart.getTime()) / 60000;
        return {
          item,
          day,
          startMinute,
          // The repeated fall-back hour can have identical wall-clock endpoints.
          endMinute: Math.min(1440, Math.max(wallEnd, startMinute + Math.min(elapsed, 30))),
          lane: 0,
          laneCount: 1,
          continuesBefore: item.startAt < start,
          continuesAfter: item.endAt > end,
        };
      })
      .sort(
        (a, b) =>
          a.startMinute - b.startMinute ||
          a.endMinute - b.endMinute ||
          a.item.id.localeCompare(b.item.id),
      );
    // Partition into overlap groups, then assign the first available lane.
    let group: WeekSegment[] = [];
    let groupEnd = -1;
    const finish = () => {
      const lanes: number[] = [];
      for (const segment of group) {
        let lane = lanes.findIndex((until) => until <= segment.startMinute);
        if (lane < 0) lane = lanes.length;
        lanes[lane] = segment.endMinute;
        segment.lane = lane;
      }
      for (const segment of group) segment.laneCount = lanes.length;
      group = [];
    };
    for (const segment of segments) {
      if (group.length && segment.startMinute >= groupEnd) finish();
      group.push(segment);
      groupEnd = Math.max(groupEnd, segment.endMinute);
    }
    if (group.length) finish();
    return segments;
  });
}
