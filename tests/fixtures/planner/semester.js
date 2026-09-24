// Fixed, entirely synthetic Toronto engineering-semester planner snapshots.
const DAY_MS = 86_400_000;

function instant(day, time, offset = "-04:00") {
  return new Date(`${day}T${time}:00${offset}`);
}

function nextDate(day) {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + DAY_MS).toISOString().slice(0, 10);
}

function task(id, minutes, dueAt, changes = {}) {
  return {
    id,
    userId: "synthetic-student",
    title: id,
    status: "READY",
    planningMode: "AUTO",
    availableFrom: instant("2026-09-21", "08:00"),
    dueAt,
    currentEstimatedMinutes: minutes,
    originalEstimatedMinutes: minutes,
    remainingMinutes: minutes,
    energyRequirement: "MEDIUM",
    locationRequirements: ["DESK"],
    minimumSessionMinutes: 15,
    preferredSessionMinutes: 45,
    maximumSessionMinutes: 90,
    splittable: true,
    interruptible: true,
    deadlineConfidence: "FIXED",
    ...changes,
  };
}

function availability(id, day, start, end, changes = {}) {
  return {
    id,
    userId: "synthetic-student",
    startAt: instant(day, start),
    endAt: instant(day, end),
    capacityFactor: 1,
    energyLevel: "HIGH",
    allowedLocationTags: ["ANYWHERE", "DESK", "COMPUTER", "HANDWRITING", "CAMPUS"],
    kind: "ORDINARY",
    ...changes,
  };
}

function event(id, day, start, end, level = "HARD") {
  return {
    id,
    userId: "synthetic-student",
    title: id,
    startAt: instant(day, start),
    endAt: instant(day, end),
    constraintLevel: level,
  };
}

function session(id, taskId, day, start, end, minutes, changes = {}) {
  return {
    id,
    userId: "synthetic-student",
    taskId,
    startAt: instant(day, start),
    endAt: instant(day, end),
    plannedMinutes: minutes,
    state: "PLANNED",
    generatedBy: "USER",
    locked: false,
    ...changes,
  };
}

function preferences() {
  return {
    preferredDailyStudyLimitMinutes: 240,
    minimumFreeTimeMinutes: 30,
    preferredDeadlineBufferHours: 12,
    avoidLateHighEnergyTasks: true,
    maximumConsecutiveWorkMinutes: 90,
    minimumBreakMinutes: 10,
    scheduleCommuteWork: false,
    weekendWorkBias: 0,
    planStabilityWindowMinutes: 120,
  };
}

function weekInput() {
  const weekdays = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"];
  const sleepDays = [...weekdays, "2026-09-26"];
  return {
    userId: "synthetic-student",
    timezone: "America/Toronto",
    now: instant("2026-09-21", "08:00"),
    horizonStart: instant("2026-09-21", "08:00"),
    horizonEnd: instant("2026-09-27", "22:00"),
    tasks: [
      task("CIV100 design assignment", 90, instant("2026-09-24", "18:00"), {
        energyRequirement: "HIGH",
      }),
      task("MAT186 problem set", 60, instant("2026-09-23", "18:00"), {
        energyRequirement: "HIGH",
        locationRequirements: ["HANDWRITING"],
      }),
      task("APS110 reading", 30, instant("2026-09-25", "18:00"), {
        energyRequirement: "LOW",
        locationRequirements: ["ANYWHERE"],
      }),
    ],
    completedTaskIds: [],
    dependencies: [],
    events: [
      event("CIV100 lecture", "2026-09-21", "16:00", "17:00"),
      event("MAT186 tutorial", "2026-09-22", "17:00", "18:00"),
      event("APS110 lecture", "2026-09-23", "16:00", "17:00"),
    ],
    protectedWindows: [
      {
        id: "Friday leisure",
        startAt: instant("2026-09-25", "18:00"),
        endAt: instant("2026-09-25", "22:00"),
        level: "HARD",
        reason: "Protected free time",
      },
    ],
    sleepWindows: sleepDays.map((day) => ({
      id: `sleep:${day}`,
      startAt: instant(day, "23:00"),
      endAt: instant(nextDate(day), "07:00"),
    })),
    recurringWindows: [],
    availability: [
      ...weekdays.map((day) => availability(`study:${day}`, day, "15:00", "20:00")),
      availability("Saturday campus", "2026-09-26", "10:00", "16:00"),
      availability("Sunday home", "2026-09-27", "10:00", "16:00"),
    ],
    manualSessions: [],
    lockedSessions: [],
    previousSessions: [],
    releasedWindows: [],
    replanMode: "INCREMENTAL",
    releasedTimePolicy: "REPLAN_IF_USEFUL",
    minimumSleepMinutes: 480,
    preferences: preferences(),
  };
}

function narrowInput(minutes = 30) {
  const input = weekInput();
  input.horizonEnd = instant("2026-09-21", "22:00");
  input.minimumSleepMinutes = 0;
  input.tasks = [task("CIV100 short exercise", minutes, instant("2026-09-21", "18:00"))];
  input.events = [];
  input.protectedWindows = [];
  input.sleepWindows = [];
  input.availability = [availability("desk slot", "2026-09-21", "09:00", "09:30")];
  return input;
}

module.exports = { instant, task, availability, event, session, weekInput, narrowInput };
