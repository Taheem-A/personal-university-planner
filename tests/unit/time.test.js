const test = require("node:test");
const assert = require("node:assert/strict");
const time = require("../../dist/packages/shared/src/index.js");

function d(value) {
  return new Date(value);
}

function interval(start, end) {
  return time.createInterval(d(start), d(end));
}

test("half-open interval overlap, containment, and intersection are canonical", () => {
  const first = interval("2026-01-01T10:00:00Z", "2026-01-01T11:00:00Z");
  const touching = interval("2026-01-01T11:00:00Z", "2026-01-01T12:00:00Z");
  const contained = interval("2026-01-01T10:15:00Z", "2026-01-01T10:45:00Z");
  const partial = interval("2026-01-01T10:30:00Z", "2026-01-01T11:30:00Z");
  const disjoint = interval("2026-01-01T12:00:00Z", "2026-01-01T13:00:00Z");

  assert.equal(time.intervalsOverlap(first, touching), false);
  assert.equal(time.intervalContains(first, contained), true);
  assert.equal(time.intervalsOverlap(first, partial), true);
  assert.equal(time.intervalsOverlap(first, disjoint), false);
  assert.deepEqual(
    time.intersectIntervals(first, partial),
    interval("2026-01-01T10:30:00Z", "2026-01-01T11:00:00Z"),
  );
  assert.equal(time.intersectIntervals(first, touching), undefined);
});

test("invalid intervals and negative duration are rejected", () => {
  assert.throws(
    () => time.createInterval(d("2026-01-01T10:00:00Z"), d("2026-01-01T10:00:00Z")),
    time.InvalidIntervalError,
  );
  assert.throws(
    () => time.createInterval(d("2026-01-01T11:00:00Z"), d("2026-01-01T10:00:00Z")),
    time.InvalidIntervalError,
  );
  assert.throws(
    () => time.minutesBetween(d("2026-01-01T11:00:00Z"), d("2026-01-01T10:00:00Z")),
    RangeError,
  );
});

test("interval normalization is deterministic and merge adjacency is policy controlled", () => {
  const values = [
    interval("2026-01-01T11:00:00Z", "2026-01-01T12:00:00Z"),
    interval("2026-01-01T10:30:00Z", "2026-01-01T11:30:00Z"),
    interval("2026-01-01T10:00:00Z", "2026-01-01T10:30:00Z"),
  ];
  assert.deepEqual(time.normalizeIntervals(values), [
    interval("2026-01-01T10:00:00Z", "2026-01-01T12:00:00Z"),
  ]);
  assert.equal(time.mergeIntervals(values, { mergeAdjacent: false }).length, 2);
  assert.deepEqual(
    time.sortIntervals(values).map((item) => item.startAt.toISOString()),
    ["2026-01-01T10:00:00.000Z", "2026-01-01T10:30:00.000Z", "2026-01-01T11:00:00.000Z"],
  );
});

test("subtraction produces zero, one, or multiple half-open windows", () => {
  const available = [interval("2026-01-01T10:00:00Z", "2026-01-01T14:00:00Z")];
  assert.deepEqual(time.subtractIntervals(available, []), available);
  assert.deepEqual(
    time.subtractIntervals(available, [interval("2026-01-01T09:00:00Z", "2026-01-01T15:00:00Z")]),
    [],
  );
  assert.deepEqual(
    time.subtractIntervals(available, [interval("2026-01-01T09:00:00Z", "2026-01-01T11:00:00Z")]),
    [interval("2026-01-01T11:00:00Z", "2026-01-01T14:00:00Z")],
  );
  assert.deepEqual(
    time.subtractIntervals(available, [
      interval("2026-01-01T11:00:00Z", "2026-01-01T12:00:00Z"),
      interval("2026-01-01T13:00:00Z", "2026-01-01T13:30:00Z"),
    ]),
    [
      interval("2026-01-01T10:00:00Z", "2026-01-01T11:00:00Z"),
      interval("2026-01-01T12:00:00Z", "2026-01-01T13:00:00Z"),
      interval("2026-01-01T13:30:00Z", "2026-01-01T14:00:00Z"),
    ],
  );
});

test("window splitting and five-minute helpers preserve exact boundaries", () => {
  const source = interval("2026-01-01T10:00:00Z", "2026-01-01T10:52:00Z");
  assert.deepEqual(
    time.splitInterval(source, 20).map((item) => time.minutesBetween(item.startAt, item.endAt)),
    [20, 20, 12],
  );
  assert.equal(time.roundUpToQuantum(11), 15);
  assert.equal(time.roundDownToQuantum(14), 10);
  assert.equal(time.isOnSchedulingQuantum(15), true);
  assert.equal(time.isOnSchedulingQuantum(16), false);
  assert.throws(() => time.roundUpToQuantum(-1), RangeError);
});

test("date-only arithmetic is calendar based and rejects impossible dates", () => {
  assert.equal(time.addLocalDays("2026-02-28", 1), "2026-03-01");
  assert.equal(time.addLocalDays("2028-02-28", 1), "2028-02-29");
  assert.ok(time.compareLocalDates("2026-03-01", "2026-02-28") > 0);
  assert.throws(() => time.addLocalDays("2026-02-30", 1), time.InvalidLocalDateTimeError);
});

test("ordinary Toronto local datetime conversion round-trips with explicit offsets", () => {
  const winter = time.localDateTimeToInstant({
    date: "2026-01-15",
    time: "09:00",
    timezone: "America/Toronto",
  });
  const summer = time.localDateTimeToInstant({
    date: "2026-07-15",
    time: "09:00",
    timezone: "America/Toronto",
  });
  assert.equal(winter.toISOString(), "2026-01-15T14:00:00.000Z");
  assert.equal(summer.toISOString(), "2026-07-15T13:00:00.000Z");
  assert.deepEqual(time.instantToLocal(winter, "America/Toronto"), {
    date: "2026-01-15",
    time: "09:00:00",
    timezone: "America/Toronto",
    offsetMinutes: -300,
  });
});

test("Toronto 2026 spring-forward nonexistent time is rejected", () => {
  assert.throws(
    () =>
      time.localDateTimeToInstant({
        date: "2026-03-08",
        time: "02:30",
        timezone: "America/Toronto",
      }),
    time.NonexistentLocalTimeError,
  );
  const before = time.localDateTimeToInstant({
    date: "2026-03-08",
    time: "01:30",
    timezone: "America/Toronto",
  });
  const after = time.localDateTimeToInstant({
    date: "2026-03-08",
    time: "03:30",
    timezone: "America/Toronto",
  });
  assert.equal(time.minutesBetween(before, after), 60);
});

test("Toronto 2026 fall-back ambiguity has deterministic earlier/later/reject policies", () => {
  const local = { date: "2026-11-01", time: "01:30", timezone: "America/Toronto" };
  assert.equal(time.localDateTimeToInstant(local).toISOString(), "2026-11-01T05:30:00.000Z");
  assert.equal(
    time.localDateTimeToInstant(local, "LATER").toISOString(),
    "2026-11-01T06:30:00.000Z",
  );
  assert.throws(() => time.localDateTimeToInstant(local, "REJECT"), time.AmbiguousLocalTimeError);
});

test("weekly recurrence preserves Toronto wall-clock time across spring DST", () => {
  const occurrences = time.expandRecurringWindows(
    {
      recurrenceRule: "FREQ=WEEKLY;BYDAY=MO",
      startTimeLocal: "09:00",
      endTimeLocal: "10:00",
      spansNextDay: false,
      timezone: "America/Toronto",
      effectiveFrom: "2026-03-02",
      effectiveUntil: "2026-03-16",
    },
    "2026-03-01",
    "2026-03-31",
  );
  assert.deepEqual(
    occurrences.map((item) => item.startAt.toISOString()),
    ["2026-03-02T14:00:00.000Z", "2026-03-09T13:00:00.000Z", "2026-03-16T13:00:00.000Z"],
  );
  assert.deepEqual(
    occurrences.map((item) => time.instantToLocal(item.startAt, item.timezone).time),
    ["09:00:00", "09:00:00", "09:00:00"],
  );
});

test("weekly recurrence preserves Toronto wall-clock time across fall DST", () => {
  const occurrences = time.expandRecurringWindows(
    {
      recurrenceRule: "FREQ=WEEKLY;BYDAY=SU",
      startTimeLocal: "09:00",
      endTimeLocal: "10:00",
      spansNextDay: false,
      timezone: "America/Toronto",
      effectiveFrom: "2026-10-25",
      effectiveUntil: "2026-11-08",
    },
    "2026-10-25",
    "2026-11-08",
  );
  assert.deepEqual(
    occurrences.map((item) => item.startAt.toISOString()),
    ["2026-10-25T13:00:00.000Z", "2026-11-01T14:00:00.000Z", "2026-11-08T14:00:00.000Z"],
  );
  assert.deepEqual(
    occurrences.map((item) => time.instantToLocal(item.startAt, item.timezone).time),
    ["09:00:00", "09:00:00", "09:00:00"],
  );
});

test("recurrence effective bounds and nonexistent occurrence policy are explicit", () => {
  const rule = {
    recurrenceRule: "FREQ=WEEKLY;BYDAY=SU",
    startTimeLocal: "02:30",
    endTimeLocal: "03:30",
    spansNextDay: false,
    timezone: "America/Toronto",
    effectiveFrom: "2026-03-01",
    effectiveUntil: "2026-03-15",
  };
  const skipped = time.expandRecurringWindows(rule, "2026-02-01", "2026-04-01");
  assert.deepEqual(
    skipped.map((item) => item.localDate),
    ["2026-03-01", "2026-03-15"],
  );
  assert.throws(
    () =>
      time.expandRecurringWindows(rule, "2026-02-01", "2026-04-01", {
        nonexistentTime: "REJECT",
      }),
    time.NonexistentLocalTimeError,
  );
});

test("normalization preserves coverage and produces non-overlapping ordered output", () => {
  const source = [
    interval("2026-01-01T12:00:00Z", "2026-01-01T13:00:00Z"),
    interval("2026-01-01T10:00:00Z", "2026-01-01T11:00:00Z"),
    interval("2026-01-01T10:30:00Z", "2026-01-01T12:30:00Z"),
  ];
  const normalized = time.normalizeIntervals(source);
  assert.deepEqual(normalized, [interval("2026-01-01T10:00:00Z", "2026-01-01T13:00:00Z")]);
  for (let index = 1; index < normalized.length; index += 1) {
    assert.ok(normalized[index - 1].endAt < normalized[index].startAt);
  }
});
