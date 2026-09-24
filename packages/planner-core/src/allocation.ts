import type { PlannerInput, PlannableTask, WorkSession } from "../../domain/src";
import {
  addMinutes,
  instantToLocal,
  minutesBetween,
  overlaps,
  roundDownToQuantum,
  roundUpToQuantum,
  subtractIntervals,
  SCHEDULING_QUANTUM_MINUTES,
} from "../../shared/src";
import type { InstantInterval } from "../../shared/src";
import { HEURISTIC_V1_CONFIG } from "./config";
import { fitsDailySoftPolicy, type DailyPolicy } from "./sustainability";
import type { CandidateWindow, WindowSuitability } from "./windows";
import { windowSuitability } from "./windows";

const QUANTUM = SCHEDULING_QUANTUM_MINUTES;

export interface SessionSize {
  clockMinutes: number;
  workMinutes: number;
}

/** Balance remaining work into useful sessions without making a tiny last fragment. */
export function sessionSize(
  task: PlannableTask,
  suitability: WindowSuitability,
  remaining: number,
  input: PlannerInput,
): SessionSize | undefined {
  const maxClock = roundDownToQuantum(
    Math.min(
      suitability.clockMinutes,
      task.maximumSessionMinutes,
      input.preferences.maximumConsecutiveWorkMinutes,
    ),
  );
  if (maxClock < QUANTUM || suitability.effectiveRate <= 0) return undefined;
  if (!task.splittable && remaining > Math.floor(maxClock * suitability.effectiveRate))
    return undefined;
  const allClock = roundUpToQuantum(remaining / suitability.effectiveRate);
  const breakLength = roundUpToQuantum(Math.max(QUANTUM, input.preferences.minimumBreakMinutes));
  if (
    allClock <= maxClock &&
    suitability.clockMinutes <
      allClock + breakLength + Math.max(QUANTUM, task.minimumSessionMinutes)
  )
    return { clockMinutes: allClock, workMinutes: remaining };
  const stretched = Math.min(
    maxClock,
    Math.max(
      task.preferredSessionMinutes,
      task.preferredSessionMinutes * HEURISTIC_V1_CONFIG.preferredSessionStretch,
    ),
  );
  const desiredWork = task.splittable
    ? Math.ceil(
        remaining / Math.max(1, Math.ceil(remaining / (stretched * suitability.effectiveRate))),
      )
    : remaining;
  let clock = Math.min(maxClock, roundUpToQuantum(desiredWork / suitability.effectiveRate));
  let work = Math.min(remaining, Math.floor(clock * suitability.effectiveRate));
  const minimum = Math.min(task.minimumSessionMinutes, remaining);
  if (work < minimum) return undefined;
  if (task.splittable && remaining - work > 0 && remaining - work < task.minimumSessionMinutes) {
    if (allClock <= maxClock) {
      clock = allClock;
      work = remaining;
    } else {
      const leaveMinimum = remaining - task.minimumSessionMinutes;
      const shorterClock = roundDownToQuantum(leaveMinimum / suitability.effectiveRate);
      if (
        shorterClock >= QUANTUM &&
        Math.floor(shorterClock * suitability.effectiveRate) >= minimum
      ) {
        clock = shorterClock;
        work = Math.floor(clock * suitability.effectiveRate);
      }
    }
  }
  if (!task.splittable && work !== remaining) return undefined;
  return { clockMinutes: clock, workMinutes: work };
}

function breakMinutes(input: PlannerInput): number {
  // Even a zero configured minimum needs a quantum gap after a full session.
  return roundUpToQuantum(Math.max(QUANTUM, input.preferences.minimumBreakMinutes));
}

/** Reserve the work interval and an unscheduled break on both sides of it. */
export function reserveSessionBreaks(
  windows: CandidateWindow[],
  session: Pick<WorkSession, "startAt" | "endAt">,
  input: PlannerInput,
): CandidateWindow[] {
  const breakLength = breakMinutes(input);
  const block = {
    startAt: addMinutes(session.startAt, -breakLength),
    endAt: addMinutes(session.endAt, breakLength),
  };
  return windows.flatMap((window) =>
    subtractIntervals([window], [block]).map((part) => {
      const clockMinutes = minutesBetween(part.startAt, part.endAt);
      const local = instantToLocal(part.startAt, input.timezone);
      return {
        ...window,
        startAt: part.startAt,
        endAt: part.endAt,
        clockMinutes,
        remainingUsableMinutes: Math.floor(clockMinutes * window.capacityFactor),
        localDate: local.date,
        localStartTime: local.time,
      };
    }),
  );
}

function preferredTarget(task: PlannableTask, input: PlannerInput): Date | undefined {
  if (task.preferredCompletionAt)
    return task.dueAt && task.preferredCompletionAt > task.dueAt
      ? task.dueAt
      : task.preferredCompletionAt;
  if (task.dueAt && input.preferences.preferredDeadlineBufferHours > 0)
    return addMinutes(task.dueAt, -60 * input.preferences.preferredDeadlineBufferHours);
  return undefined;
}

function stabilityBonus(taskId: string, window: CandidateWindow, input: PlannerInput): number {
  return input.previousSessions.some(
    (session) =>
      session.taskId === taskId &&
      overlaps(session.startAt, session.endAt, window.startAt, window.endAt),
  )
    ? HEURISTIC_V1_CONFIG.stabilityWindowBonus
    : 0;
}

function neighborScore(
  taskId: string,
  startAt: Date,
  endAt: Date,
  sessions: WorkSession[],
): number {
  let score = 0;
  let nearest = Infinity;
  for (const session of sessions) {
    const distance = Math.min(
      Math.abs(session.endAt.getTime() - startAt.getTime()) / 60_000,
      Math.abs(session.startAt.getTime() - endAt.getTime()) / 60_000,
    );
    if (distance > HEURISTIC_V1_CONFIG.contextNeighborMinutes) continue;
    if (distance < nearest || (distance === nearest && session.taskId === taskId)) {
      nearest = distance;
      score =
        session.taskId === taskId
          ? HEURISTIC_V1_CONFIG.taskContinuationBonus
          : -HEURISTIC_V1_CONFIG.contextSwitchPenalty;
    }
  }
  return score;
}

interface WindowChoice {
  index: number;
  suitability: WindowSuitability;
  size: SessionSize;
  score: number;
}

function weekendCost(startAt: Date, input: PlannerInput): number {
  const localDate = instantToLocal(startAt, input.timezone).date;
  const weekday = new Date(`${localDate}T00:00:00.000Z`).getUTCDay();
  if (weekday !== 0 && weekday !== 6) return 0;
  const weekend = (1 - input.preferences.weekendWorkBias) * HEURISTIC_V1_CONFIG.weekendBiasWeight;
  return weekday === 0 ? weekend + HEURISTIC_V1_CONFIG.sundayConcentrationPenalty : weekend;
}

function chooseWindow(
  task: PlannableTask,
  remaining: number,
  windows: CandidateWindow[],
  input: PlannerInput,
  policy: DailyPolicy,
  sessions: WorkSession[],
  respectSoftPolicy: boolean,
  avoided: InstantInterval[],
): WindowChoice | undefined {
  let best: WindowChoice | undefined;
  const preferred = preferredTarget(task, input);
  for (let index = 0; index < windows.length; index += 1) {
    const window = windows[index];
    for (const segment of subtractIntervals([window], avoided)) {
      const candidate: CandidateWindow = {
        ...window,
        startAt: segment.startAt,
        endAt: segment.endAt,
      };
      const suitability = windowSuitability(
        { ...task, remainingMinutes: remaining },
        candidate,
        input,
      );
      if (!suitability) continue;
      let size = sessionSize(task, suitability, remaining, input);
      if (!size) continue;
      if (respectSoftPolicy) {
        while (
          size &&
          !fitsDailySoftPolicy(
            input,
            policy,
            sessions,
            suitability.startAt,
            addMinutes(suitability.startAt, size.clockMinutes),
          )
        ) {
          const shorter: number = size.clockMinutes - QUANTUM;
          const work = Math.min(remaining, Math.floor(shorter * suitability.effectiveRate));
          size =
            shorter >= QUANTUM &&
            work >= Math.min(task.minimumSessionMinutes, remaining) &&
            (task.splittable || work === remaining)
              ? { clockMinutes: shorter, workMinutes: work }
              : undefined;
        }
        if (!size) continue;
      }
      const endAt = addMinutes(suitability.startAt, size.clockMinutes);
      const deadline = task.dueAt ?? input.horizonEnd;
      const hoursBeforeDeadline = Math.max(
        HEURISTIC_V1_CONFIG.deadlineMinimumHours,
        (deadline.getTime() - suitability.startAt.getTime()) / 3_600_000,
      );
      const score =
        suitability.energyMatch * HEURISTIC_V1_CONFIG.windowEnergyWeight +
        suitability.effectiveRate * HEURISTIC_V1_CONFIG.windowCapacityWeight +
        (1 / Math.sqrt(hoursBeforeDeadline)) * HEURISTIC_V1_CONFIG.windowUrgencyWeight +
        (preferred && endAt <= preferred ? HEURISTIC_V1_CONFIG.preferredWindowBonus : 0) +
        stabilityBonus(task.id, window, input) +
        (size.clockMinutes / Math.max(QUANTUM, task.preferredSessionMinutes)) *
          HEURISTIC_V1_CONFIG.sessionFitWeight +
        neighborScore(task.id, suitability.startAt, endAt, sessions) -
        suitability.undesirableTimeCost * HEURISTIC_V1_CONFIG.lateWindowPenalty -
        suitability.fragmentationCost * HEURISTIC_V1_CONFIG.fragmentationPenaltyWeight;
      const adjustedScore = score - weekendCost(suitability.startAt, input);
      if (
        !best ||
        adjustedScore > best.score ||
        (adjustedScore === best.score && suitability.startAt < best.suitability.startAt) ||
        (adjustedScore === best.score &&
          suitability.startAt.getTime() === best.suitability.startAt.getTime() &&
          window.id < windows[best.index].id)
      )
        best = { index, suitability, size, score: adjustedScore };
    }
  }
  return best;
}

export function placeTask(
  task: PlannableTask,
  windows: CandidateWindow[],
  input: PlannerInput,
  sessionCounter: { value: number },
  policy: DailyPolicy,
  existingSessions: WorkSession[],
  softIntervals: InstantInterval[],
): { sessions: WorkSession[]; remaining: number; windows: CandidateWindow[] } {
  const generated: WorkSession[] = [];
  let remaining = task.remainingMinutes;
  let mutable = windows;
  while (remaining > 0) {
    const context = [...existingSessions, ...generated];
    const released = input.releasedWindows;
    const keepReleased = input.releasedTimePolicy !== "ALWAYS_REPLAN";
    const stages = [
      [...softIntervals, ...(keepReleased ? released : [])],
      ...(keepReleased ? [released] : []),
      ...(input.releasedTimePolicy === "REPLAN_IF_USEFUL" ? [softIntervals, []] : []),
      ...(input.releasedTimePolicy === "ALWAYS_REPLAN" ? [[]] : []),
    ];
    let choice: WindowChoice | undefined;
    for (const avoided of stages) {
      choice =
        chooseWindow(task, remaining, mutable, input, policy, context, true, avoided) ??
        chooseWindow(task, remaining, mutable, input, policy, context, false, avoided);
      if (choice) break;
    }
    if (!choice) break;
    const startAt = choice.suitability.startAt;
    const endAt = addMinutes(startAt, choice.size.clockMinutes);
    const session: WorkSession = {
      id: `generated-${sessionCounter.value++}`,
      userId: input.userId,
      taskId: task.id,
      startAt,
      endAt,
      plannedMinutes: choice.size.workMinutes,
      state: "PLANNED",
      generatedBy: "PLANNER",
      locked: false,
    };
    generated.push(session);
    remaining -= session.plannedMinutes;
    mutable = reserveSessionBreaks(mutable, session, input);
    if (!task.splittable) break;
  }
  return { sessions: generated, remaining, windows: mutable };
}
