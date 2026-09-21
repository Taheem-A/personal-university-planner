"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MINUTE_MS = void 0;
exports.minutesBetween = minutesBetween;
exports.addMinutes = addMinutes;
exports.maxDate = maxDate;
exports.minDate = minDate;
exports.overlaps = overlaps;
exports.roundUpToQuantum = roundUpToQuantum;
exports.sortByStart = sortByStart;
exports.MINUTE_MS = 60_000;
function minutesBetween(start, end) {
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / exports.MINUTE_MS));
}
function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * exports.MINUTE_MS);
}
function maxDate(...dates) {
    if (dates.length === 0)
        throw new Error("maxDate requires at least one date");
    return dates.reduce((max, current) => current.getTime() > max.getTime() ? current : max);
}
function minDate(...dates) {
    if (dates.length === 0)
        throw new Error("minDate requires at least one date");
    return dates.reduce((min, current) => current.getTime() < min.getTime() ? current : min);
}
function overlaps(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
}
function roundUpToQuantum(minutes, quantum = 5) {
    return Math.ceil(minutes / quantum) * quantum;
}
function sortByStart(items) {
    return [...items].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}
//# sourceMappingURL=time.js.map