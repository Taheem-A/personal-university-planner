"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { EditorShell, useEditor } from "./manual-editors";
import {
  CheckField,
  DaySelection,
  FormActions,
  FormField,
  SelectField,
  ValidationSummary,
} from "./mutation-form";

type RecurringRule = {
  id: string;
  version: number;
  recurrenceRule: string;
  startTimeLocal: string;
  endTimeLocal: string;
  spansNextDay: boolean;
  timezone: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
};
type AvailabilityRule = RecurringRule & {
  capacityFactor: number;
  energyLevel: string;
  allowedLocationTags: string[];
};
type ProtectedRule = RecurringRule & {
  protectionLevel: string;
  reason: string;
  isSleep: boolean;
};
type Rule = AvailabilityRule | ProtectedRule;
type Preference = {
  version: number;
  preferredDailyStudyLimitMinutes: number;
  minimumFreeTimeMinutes: number;
  preferredDeadlineBufferHours: number;
  avoidLateHighEnergyTasks: boolean;
  maximumConsecutiveWorkMinutes: number;
  minimumBreakMinutes: number;
  scheduleCommuteWork: boolean;
  weekendWorkBias: number;
  planStabilityWindowMinutes: number;
  minimumSleepMinutes: number | null;
};
const daysInRule = (value: string) =>
  /^FREQ=WEEKLY;BYDAY=((?:MO|TU|WE|TH|FR|SA|SU)(?:,(?:MO|TU|WE|TH|FR|SA|SU))*)$/
    .exec(value)?.[1]
    .split(",") ?? [];
const tags = [
  ["ANYWHERE", "Anywhere"],
  ["DESK", "Desk"],
  ["CAMPUS", "Campus"],
  ["HOME", "Home"],
  ["TRANSIT_OK", "Transit or commute"],
  ["COMPUTER", "Computer"],
  ["HANDWRITING", "Handwriting"],
  ["INTERNET_REQUIRED", "Internet"],
] as const;

export function RuleEditor({
  kind,
  rule,
  timezone,
  returnTo,
}: {
  kind: "availability" | "protection";
  rule?: Rule;
  timezone: string;
  returnTo: string;
}) {
  const editor = useEditor(rule?.id, rule?.version);
  const router = useRouter();
  const availability = kind === "availability";
  const oldAvailability = rule && "capacityFactor" in rule ? rule : undefined;
  const oldProtection = rule && "protectionLevel" in rule ? rule : undefined;
  const [recurrenceRule, setRecurrenceRule] = useState(
    rule?.recurrenceRule ?? (availability ? "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" : "FREQ=DAILY"),
  );
  const [start, setStart] = useState(rule?.startTimeLocal ?? (availability ? "09:00" : "22:00"));
  const [end, setEnd] = useState(rule?.endTimeLocal ?? (availability ? "17:00" : "07:00"));
  const [overnight, setOvernight] = useState(rule?.spansNextDay ?? !availability);
  const [zone, setZone] = useState(rule?.timezone ?? timezone);
  const [from, setFrom] = useState(rule?.effectiveFrom ?? "");
  const [until, setUntil] = useState(rule?.effectiveUntil ?? "");
  const [capacity, setCapacity] = useState(
    oldAvailability ? String(Math.round(oldAvailability.capacityFactor * 100)) : "100",
  );
  const [energy, setEnergy] = useState(oldAvailability?.energyLevel ?? "MEDIUM");
  const [locations, setLocations] = useState(oldAvailability?.allowedLocationTags ?? ["ANYWHERE"]);
  const [reason, setReason] = useState(oldProtection?.reason ?? "");
  const [level, setLevel] = useState(oldProtection?.protectionLevel ?? "HARD");
  const [sleep, setSleep] = useState(oldProtection?.isSleep ?? false);
  const [confirmed, setConfirmed] = useState(false);
  const selectedDays = daysInRule(recurrenceRule);
  const errors = [
    !recurrenceRule.trim() && "Choose recurrence days or enter a rule.",
    !from && "Enter the first effective date.",
    availability && !capacity.trim() && "Enter usable capacity.",
    !availability && !reason.trim() && "Enter a protection label.",
  ].filter((item): item is string => Boolean(item));
  const base = availability ? "/api/v1/manual/availability" : "/api/v1/manual/protected-time";
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (errors.length) return editor.fail(errors.join(" "));
    const common = {
      recurrenceRule,
      startTimeLocal: start,
      endTimeLocal: end,
      spansNextDay: overnight,
      timezone: zone,
      effectiveFrom: from,
      effectiveUntil: until || null,
    };
    const fields = availability
      ? {
          ...common,
          capacityFactor: Number(capacity) / 100,
          energyLevel: energy,
          allowedLocationTags: locations,
        }
      : { ...common, reason, protectionLevel: sleep ? "HARD" : level, isSleep: sleep };
    await editor.commit(
      editor.id ? `${base}/${encodeURIComponent(editor.id)}` : base,
      editor.id ? "PATCH" : "POST",
      editor.id ? { expectedVersion: editor.version, ...fields } : fields,
      availability ? "Availability rule" : "Protected time rule",
    );
  }
  return (
    <EditorShell
      title={`${rule ? "Edit" : "Add"} ${availability ? "availability" : "protected time"}`}
      returnTo={returnTo}
      feedback={editor.feedback}
    >
      {editor.archived ? (
        <p>This recurring rule is deactivated.</p>
      ) : (
        <>
          <p className="manual-help">
            {availability
              ? "Work may be scheduled in this window. The planner will not fill every minute."
              : "Hard protection blocks scheduling. Soft protection is avoided unless needed; informational time does not constrain the planner."}
          </p>
          <form onSubmit={submit} noValidate>
            <ValidationSummary errors={editor.feedback?.error ? errors : []} />
            {!availability && (
              <>
                <FormField
                  label="Protection label"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  help="For example, sleep, commute, prayer, meals, gym, family time, or leisure."
                  required
                />
                <CheckField
                  label="This is sleep"
                  checked={sleep}
                  onChange={(event) => {
                    setSleep(event.target.checked);
                    if (event.target.checked) setLevel("HARD");
                  }}
                  help="Sleep always uses hard protection."
                />
                <SelectField
                  label="Protection strength"
                  value={sleep ? "HARD" : level}
                  disabled={sleep}
                  onChange={(event) => setLevel(event.target.value)}
                >
                  <option value="HARD">Hard · never schedule through</option>
                  <option value="SOFT">Soft · avoid if possible</option>
                  <option value="INFORMATIONAL">Informational · show only</option>
                </SelectField>
              </>
            )}
            <SelectField
              label="Repeats"
              value={
                recurrenceRule === "FREQ=DAILY"
                  ? "DAILY"
                  : selectedDays.length
                    ? "WEEKLY"
                    : "CUSTOM"
              }
              onChange={(event) =>
                setRecurrenceRule(
                  event.target.value === "DAILY"
                    ? "FREQ=DAILY"
                    : event.target.value === "WEEKLY"
                      ? "FREQ=WEEKLY;BYDAY=MO"
                      : recurrenceRule,
                )
              }
            >
              <option value="WEEKLY">Selected days each week</option>
              <option value="DAILY">Every day</option>
              <option value="CUSTOM">Advanced rule</option>
            </SelectField>
            {selectedDays.length > 0 && (
              <DaySelection
                label="Recurring days"
                value={selectedDays}
                onChange={(days) => setRecurrenceRule(`FREQ=WEEKLY;BYDAY=${days.join(",")}`)}
              />
            )}
            <FormField
              label="Local start time"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              placeholder="09:00"
              help="24-hour HH:MM in the rule time zone."
            />
            <FormField
              label="Local end time"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              placeholder="17:00"
              help="24-hour HH:MM in the rule time zone."
            />
            <CheckField
              label="Ends on the next day"
              checked={overnight}
              onChange={(event) => setOvernight(event.target.checked)}
            />
            <FormField
              label="First effective date"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              required
            />
            <details className="manual-advanced">
              <summary>End date, time zone, and planning details</summary>
              <FormField
                label="Last effective date"
                type="date"
                value={until}
                onChange={(event) => setUntil(event.target.value)}
              />
              <FormField
                label="Time zone"
                value={zone}
                onChange={(event) => setZone(event.target.value)}
                help="Recurring times keep their local wall-clock meaning through daylight-saving changes."
              />
              <FormField
                label="Recurrence rule"
                value={recurrenceRule}
                onChange={(event) => setRecurrenceRule(event.target.value)}
                help="Advanced RFC 5545 rule; validated by the shared recurrence service."
              />
              {availability && (
                <>
                  <FormField
                    label="Usable capacity (%)"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={capacity}
                    onChange={(event) => setCapacity(event.target.value)}
                    help="A lower value means less effective planning capacity, not a shorter clock window."
                  />
                  <SelectField
                    label="Energy available"
                    value={energy}
                    onChange={(event) => setEnergy(event.target.value)}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </SelectField>
                  <fieldset className="mutation-days">
                    <legend>Places and capabilities available</legend>
                    {tags.map(([tag, label]) => (
                      <CheckField
                        key={tag}
                        label={label}
                        checked={locations.includes(tag)}
                        onChange={(event) =>
                          setLocations(
                            event.target.checked
                              ? [...locations, tag]
                              : locations.filter((item) => item !== tag),
                          )
                        }
                      />
                    ))}
                  </fieldset>
                  <p className="manual-help">
                    Transit marks commute availability. Settings controls whether compatible work
                    may be planned there.
                  </p>
                </>
              )}
            </details>
            <FormActions saving={editor.busy} onCancel={() => router.replace(returnTo)} />
          </form>
          {editor.id && (
            <div className="manual-archive">
              <CheckField
                label="I understand this recurring rule will be deactivated."
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <button
                className="button button-danger-quiet"
                type="button"
                disabled={!confirmed || editor.busy}
                onClick={() =>
                  editor.commit(
                    `${base}/${encodeURIComponent(editor.id!)}`,
                    "DELETE",
                    { expectedVersion: editor.version },
                    "Rule deactivation",
                  )
                }
              >
                Deactivate rule
              </button>
            </div>
          )}
        </>
      )}
    </EditorShell>
  );
}

/** Starting values mirror the established planner scenario policy; users can inspect and change each field. */
export const balancedPreferences = {
  preferredDailyStudyLimitMinutes: 240,
  minimumFreeTimeMinutes: 30,
  preferredDeadlineBufferHours: 12,
  avoidLateHighEnergyTasks: true,
  maximumConsecutiveWorkMinutes: 90,
  minimumBreakMinutes: 10,
  scheduleCommuteWork: false,
  weekendWorkBias: 0,
  planStabilityWindowMinutes: 120,
  minimumSleepMinutes: 420,
};

export function PreferenceEditor({
  preference,
  returnTo,
}: {
  preference: Preference | null;
  returnTo: string;
}) {
  const editor = useEditor(preference ? "current" : undefined, preference?.version);
  const router = useRouter();
  const [values, setValues] = useState({ ...balancedPreferences, ...preference });
  const set = (key: keyof typeof balancedPreferences, value: number | boolean | null) =>
    setValues((current) => ({ ...current, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    const fields: Record<string, unknown> = { ...values };
    delete fields.version;
    await editor.commit(
      editor.id ? "/api/v1/manual/preferences/current" : "/api/v1/manual/preferences",
      editor.id ? "PATCH" : "POST",
      editor.id ? { expectedVersion: editor.version, ...fields } : fields,
      "Planning preferences",
    );
  }
  const number = (
    label: string,
    key: keyof typeof balancedPreferences,
    min = 0,
    step = 1,
    help?: string,
  ) => (
    <FormField
      label={label}
      type="number"
      min={min}
      step={step}
      value={values[key] == null ? "" : String(values[key])}
      onChange={(event) => set(key, event.target.value === "" ? null : Number(event.target.value))}
      help={help}
    />
  );
  return (
    <EditorShell
      title={preference ? "Edit planning preferences" : "Set planning preferences"}
      returnTo={returnTo}
      feedback={editor.feedback}
    >
      <p className="manual-help">
        Balanced fills the visible canonical fields. Adjust them before saving; no hidden preset is
        stored.
      </p>
      <button
        type="button"
        className="button button-secondary"
        onClick={() =>
          setValues({
            ...balancedPreferences,
            ...(preference ? { version: preference.version } : {}),
          })
        }
      >
        Use Balanced values
      </button>
      <form onSubmit={submit}>
        {number("Preferred daily study limit (minutes)", "preferredDailyStudyLimitMinutes")}
        {number("Minimum free time each day (minutes)", "minimumFreeTimeMinutes")}
        {number("Preferred deadline buffer (hours)", "preferredDeadlineBufferHours")}
        {number("Maximum consecutive work (minutes)", "maximumConsecutiveWorkMinutes", 1)}
        {number("Minimum break (minutes)", "minimumBreakMinutes")}
        {number("Plan stability window (minutes)", "planStabilityWindowMinutes")}
        {number(
          "Minimum sleep (minutes)",
          "minimumSleepMinutes",
          1,
          1,
          "Planning also needs an explicit hard sleep rule under Availability.",
        )}
        <SelectField
          label="Weekend work bias"
          value={String(values.weekendWorkBias)}
          onChange={(event) => set("weekendWorkBias", Number(event.target.value))}
        >
          <option value="-1">Strongly prefer weekdays</option>
          <option value="-0.5">Prefer weekdays</option>
          <option value="0">Balanced</option>
          <option value="0.5">Prefer weekends</option>
          <option value="1">Strongly prefer weekends</option>
        </SelectField>
        <CheckField
          label="Avoid late high-energy work"
          checked={values.avoidLateHighEnergyTasks}
          onChange={(event) => set("avoidLateHighEnergyTasks", event.target.checked)}
        />
        <CheckField
          label="Allow compatible work during commute availability"
          checked={values.scheduleCommuteWork}
          onChange={(event) => set("scheduleCommuteWork", event.target.checked)}
        />
        <FormActions saving={editor.busy} onCancel={() => router.replace(returnTo)} />
      </form>
    </EditorShell>
  );
}
