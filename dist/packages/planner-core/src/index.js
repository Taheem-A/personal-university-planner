"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePlan = validatePlan;
exports.generatePlan = generatePlan;
exports.simulateProtectedWindow = simulateProtectedWindow;
const src_1 = require("../../shared/src");
const FIVE_MINUTES = 5;
function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}
function energyFit(task, window) {
    const rank = { LOW: 0, MEDIUM: 1, HIGH: 2 };
    const delta = rank[window.energyLevel] - rank[task.energyRequirement];
    if (delta >= 0)
        return 1;
    return delta === -1 ? 0.72 : 0.42;
}
function locationFits(task, window) {
    if (task.locationRequirements.length === 0 || task.locationRequirements.includes("ANYWHERE"))
        return true;
    return task.locationRequirements.every((requirement) => window.allowedLocationTags.includes(requirement));
}
function subtractIntervals(window, occupied) {
    let parts = [window];
    for (const block of occupied) {
        const next = [];
        for (const part of parts) {
            if (!(0, src_1.overlaps)(part.startAt, part.endAt, block.startAt, block.endAt)) {
                next.push(part);
                continue;
            }
            if (block.startAt > part.startAt) {
                next.push({ startAt: part.startAt, endAt: (0, src_1.minDate)(block.startAt, part.endAt) });
            }
            if (block.endAt < part.endAt) {
                next.push({ startAt: (0, src_1.maxDate)(block.endAt, part.startAt), endAt: part.endAt });
            }
        }
        parts = next.filter((part) => part.endAt > part.startAt);
    }
    return parts;
}
function occupiedIntervals(input) {
    const hardEvents = input.events
        .filter((event) => event.constraintLevel === "HARD")
        .map((event) => ({ startAt: event.startAt, endAt: event.endAt }));
    const locked = input.lockedSessions
        .filter((session) => session.state === "PLANNED" || session.state === "ACTIVE")
        .map((session) => ({ startAt: session.startAt, endAt: session.endAt }));
    return (0, src_1.sortByStart)([...hardEvents, ...locked]);
}
function candidateWindows(input) {
    const occupied = occupiedIntervals(input);
    const result = [];
    for (const availability of input.availability) {
        const boundedStart = (0, src_1.maxDate)(availability.startAt, input.horizonStart);
        const boundedEnd = (0, src_1.minDate)(availability.endAt, input.horizonEnd);
        if (boundedEnd <= boundedStart)
            continue;
        const free = subtractIntervals({ startAt: boundedStart, endAt: boundedEnd }, occupied);
        for (const part of free) {
            result.push({ ...availability, startAt: part.startAt, endAt: part.endAt });
        }
    }
    return (0, src_1.sortByStart)(result);
}
function eligibleTask(task, input) {
    return ((task.status === "READY" || task.status === "IN_PROGRESS") &&
        task.planningMode === "AUTO" &&
        task.remainingMinutes > 0 &&
        task.availableFrom <= input.horizonEnd);
}
function windowUsableMinutes(task, window, input) {
    if (!locationFits(task, window))
        return 0;
    const start = (0, src_1.maxDate)(window.startAt, task.availableFrom, input.now);
    const deadline = task.dueAt ?? input.horizonEnd;
    const end = (0, src_1.minDate)(window.endAt, deadline, input.horizonEnd);
    if (end <= start)
        return 0;
    const clock = (0, src_1.minutesBetween)(start, end);
    const energy = energyFit(task, window);
    return Math.floor(clock * clamp01(window.capacityFactor) * energy);
}
function calculatePressure(task, windows, input) {
    const suitableCapacityMinutes = windows.reduce((sum, window) => sum + windowUsableMinutes(task, window, input), 0);
    const slackMinutes = suitableCapacityMinutes - task.remainingMinutes;
    const pressureRatio = task.remainingMinutes / Math.max(1, suitableCapacityMinutes);
    const dueHours = task.dueAt
        ? Math.max(0.25, (task.dueAt.getTime() - input.now.getTime()) / 3_600_000)
        : 24 * 30;
    const deadlinePressure = 1 / Math.sqrt(dueHours);
    const lowSlackPressure = slackMinutes <= 0 ? 4 : 1 / Math.max(1, slackMinutes / 60);
    const preferredPressure = task.preferredCompletionAt && task.preferredCompletionAt <= input.horizonEnd ? 0.5 : 0;
    const override = task.priorityOverride ?? 0;
    const score = pressureRatio * 3 + deadlinePressure * 4 + lowSlackPressure + preferredPressure + override;
    return {
        taskId: task.id,
        suitableCapacityMinutes,
        remainingMinutes: task.remainingMinutes,
        slackMinutes,
        pressureRatio,
        score,
    };
}
function sessionTarget(task, availableClockMinutes, remaining) {
    const preferred = Math.min(task.preferredSessionMinutes, remaining, availableClockMinutes);
    const max = Math.min(task.maximumSessionMinutes, remaining, availableClockMinutes);
    let target = preferred >= task.minimumSessionMinutes ? preferred : max;
    if (remaining < task.minimumSessionMinutes)
        target = Math.min(remaining, availableClockMinutes);
    if (!task.splittable && remaining > availableClockMinutes)
        return 0;
    if (target <= 0)
        return 0;
    return Math.min(availableClockMinutes, (0, src_1.roundUpToQuantum)(target, FIVE_MINUTES));
}
function stableSessionBonus(taskId, window, input) {
    const old = input.previousSessions?.find((session) => session.taskId === taskId && (0, src_1.overlaps)(session.startAt, session.endAt, window.startAt, window.endAt));
    return old ? 0.6 : 0;
}
function chooseWindow(task, windows, input) {
    let bestIndex = -1;
    let bestScore = -Infinity;
    for (let index = 0; index < windows.length; index += 1) {
        const window = windows[index];
        const usable = windowUsableMinutes(task, window, input);
        if (usable < Math.min(task.minimumSessionMinutes, task.remainingMinutes))
            continue;
        if (!locationFits(task, window))
            continue;
        const energy = energyFit(task, window);
        const deadline = task.dueAt ?? input.horizonEnd;
        const hoursBeforeDeadline = Math.max(0.25, (deadline.getTime() - window.startAt.getTime()) / 3_600_000);
        const earlyUsefulness = 1 / Math.sqrt(hoursBeforeDeadline);
        const lateHour = window.startAt.getHours();
        const latePenalty = task.energyRequirement === "HIGH" && input.preferences.avoidLateHighEnergyTasks && lateHour >= 21 ? 1.5 : 0;
        const score = energy * 2 +
            window.capacityFactor +
            earlyUsefulness +
            stableSessionBonus(task.id, window, input) -
            latePenalty;
        if (score > bestScore) {
            bestScore = score;
            bestIndex = index;
        }
    }
    return bestIndex;
}
function placeTask(task, windows, input, sessionCounter) {
    const sessions = [];
    let remaining = task.remainingMinutes;
    const mutable = [...windows];
    while (remaining > 0) {
        const windowIndex = chooseWindow({ ...task, remainingMinutes: remaining }, mutable, input);
        if (windowIndex < 0)
            break;
        const window = mutable[windowIndex];
        const startAt = (0, src_1.maxDate)(window.startAt, task.availableFrom, input.now);
        const deadline = task.dueAt ?? input.horizonEnd;
        const endBound = (0, src_1.minDate)(window.endAt, deadline, input.horizonEnd);
        const availableClock = (0, src_1.minutesBetween)(startAt, endBound);
        const target = sessionTarget(task, availableClock, remaining);
        if (target <= 0)
            break;
        const endAt = (0, src_1.addMinutes)(startAt, target);
        sessions.push({
            id: `generated-${sessionCounter.value++}`,
            taskId: task.id,
            startAt,
            endAt,
            plannedMinutes: target,
            state: "PLANNED",
            generatedBy: "PLANNER",
            locked: false,
        });
        remaining = Math.max(0, remaining - target);
        if (endAt >= window.endAt) {
            mutable.splice(windowIndex, 1);
        }
        else {
            mutable[windowIndex] = { ...window, startAt: (0, src_1.addMinutes)(endAt, input.preferences.minimumBreakMinutes) };
        }
        if (!task.splittable)
            break;
    }
    return { sessions, remaining, windows: mutable };
}
function validatePlan(sessions, input) {
    const errors = [];
    const active = (0, src_1.sortByStart)(sessions.filter((session) => session.state === "PLANNED" || session.state === "ACTIVE"));
    for (let i = 0; i < active.length; i += 1) {
        const session = active[i];
        if (session.endAt <= session.startAt)
            errors.push(`Session ${session.id} has non-positive duration.`);
        const task = input.tasks.find((candidate) => candidate.id === session.taskId);
        if (!task)
            errors.push(`Session ${session.id} references missing task ${session.taskId}.`);
        if (task && session.startAt < task.availableFrom)
            errors.push(`Session ${session.id} starts before task availability.`);
        if (task?.dueAt && session.endAt > task.dueAt)
            errors.push(`Session ${session.id} ends after hard deadline.`);
        for (const event of input.events.filter((candidate) => candidate.constraintLevel === "HARD")) {
            if ((0, src_1.overlaps)(session.startAt, session.endAt, event.startAt, event.endAt)) {
                errors.push(`Session ${session.id} overlaps hard event ${event.id}.`);
            }
        }
        if (i > 0 && (0, src_1.overlaps)(active[i - 1].startAt, active[i - 1].endAt, session.startAt, session.endAt)) {
            errors.push(`Sessions ${active[i - 1].id} and ${session.id} overlap.`);
        }
    }
    for (const locked of input.lockedSessions) {
        if (!sessions.some((session) => session.id === locked.id && session.startAt.getTime() === locked.startAt.getTime())) {
            errors.push(`Locked session ${locked.id} was not preserved.`);
        }
    }
    return errors;
}
function generatePlan(input) {
    let windows = candidateWindows(input);
    const tasks = input.tasks.filter((task) => eligibleTask(task, input));
    const pressures = tasks.map((task) => calculatePressure(task, windows, input));
    const pressureByTask = new Map(pressures.map((pressure) => [pressure.taskId, pressure]));
    const ranked = [...tasks].sort((a, b) => {
        const pressureDelta = (pressureByTask.get(b.id)?.score ?? 0) - (pressureByTask.get(a.id)?.score ?? 0);
        if (Math.abs(pressureDelta) > 0.0001)
            return pressureDelta;
        const aDue = a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bDue = b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aDue - bDue;
    });
    const sessionCounter = { value: 1 };
    const sessions = [...input.lockedSessions];
    const warnings = [];
    const unscheduledMinutesByTask = {};
    for (const task of ranked) {
        const placed = placeTask(task, windows, input, sessionCounter);
        sessions.push(...placed.sessions);
        windows = placed.windows;
        if (placed.remaining > 0) {
            unscheduledMinutesByTask[task.id] = placed.remaining;
            const pressure = pressureByTask.get(task.id);
            warnings.push({
                code: pressure && pressure.suitableCapacityMinutes <= 0 ? "NO_SUITABLE_WINDOW" : "INFEASIBLE",
                taskId: task.id,
                message: `Task ${task.title} has ${placed.remaining} minute(s) that do not currently fit.`,
                deficitMinutes: placed.remaining,
            });
        }
        else {
            const pressure = pressureByTask.get(task.id);
            if (pressure && pressure.slackMinutes >= 0 && pressure.slackMinutes <= 60) {
                warnings.push({
                    code: "LOW_SLACK",
                    taskId: task.id,
                    message: `${task.title} has only ${pressure.slackMinutes} minute(s) of suitable slack.`,
                });
            }
        }
    }
    const errors = validatePlan(sessions, input);
    if (errors.length > 0) {
        throw new Error(`Planner produced invalid output:\n${errors.join("\n")}`);
    }
    return {
        sessions: (0, src_1.sortByStart)(sessions),
        warnings,
        pressures,
        unscheduledMinutesByTask,
    };
}
function simulateProtectedWindow(input, request) {
    const before = generatePlan(input);
    const synthetic = {
        id: `scenario:${request.title}`,
        title: request.title,
        startAt: request.startAt,
        endAt: request.endAt,
        constraintLevel: request.protectionLevel,
        source: "SCENARIO",
    };
    const afterInput = {
        ...input,
        events: [...input.events, synthetic],
        previousSessions: before.sessions,
    };
    const after = generatePlan(afterInput);
    const beforeByTask = new Map();
    const afterByTask = new Map();
    for (const session of before.sessions)
        beforeByTask.set(session.taskId, [...(beforeByTask.get(session.taskId) ?? []), session]);
    for (const session of after.sessions)
        afterByTask.set(session.taskId, [...(afterByTask.get(session.taskId) ?? []), session]);
    const movedTaskIds = [...new Set([...beforeByTask.keys(), ...afterByTask.keys()])].filter((taskId) => {
        const a = beforeByTask.get(taskId) ?? [];
        const b = afterByTask.get(taskId) ?? [];
        if (a.length !== b.length)
            return true;
        return a.some((session, index) => session.startAt.getTime() !== b[index]?.startAt.getTime());
    });
    const deadlineSafe = after.warnings.every((warning) => warning.code !== "INFEASIBLE" && warning.code !== "NO_SUITABLE_WINDOW");
    return {
        request,
        before,
        after,
        movedTaskIds,
        canApply: deadlineSafe,
        deadlineSafe,
    };
}
//# sourceMappingURL=index.js.map