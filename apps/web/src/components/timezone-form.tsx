"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormActions, FormField, FormStatus } from "./mutation-form";
import { submitMutation } from "./mutation-client";

type SavedTimezone = { timezone: string; planning: { status: string } };
function isSavedTimezone(value: unknown): value is SavedTimezone {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as SavedTimezone).timezone === "string" &&
    typeof (value as SavedTimezone).planning?.status === "string",
  );
}

export function TimezoneForm({ initialTimezone }: { initialTimezone: string }) {
  const router = useRouter();
  const [expected, setExpected] = useState(initialTimezone);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFeedback(null);
    const result = await submitMutation(
      "/api/v1/account/timezone",
      "PATCH",
      { timezone: timezone.trim(), expectedTimezone: expected },
      isSavedTimezone,
    );
    setSaving(false);
    if (!result.ok) {
      setFeedback({ error: true, text: result.message });
      return;
    }
    setExpected(result.data.timezone);
    setTimezone(result.data.timezone);
    setEditing(false);
    setFeedback({
      error: false,
      text:
        result.data.planning.status === "SUCCEEDED"
          ? "Time zone saved. The latest plan was refreshed; review any unmet work in Planner."
          : "Time zone saved. The planner could not publish a new plan; review missing planning facts.",
    });
    router.refresh();
  }

  return (
    <div className="timezone-form">
      {!editing ? (
        <button
          className="button button-secondary"
          type="button"
          onClick={() => {
            setFeedback(null);
            setEditing(true);
          }}
        >
          Change time zone
        </button>
      ) : (
        <form onSubmit={save} noValidate>
          <FormField
            label="IANA time zone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            required
            autoComplete="off"
            help="For example, America/Toronto. Stored deadlines remain at their original UTC instant."
          />
          <FormActions
            saving={saving}
            onCancel={() => {
              setTimezone(expected);
              setEditing(false);
              setFeedback(null);
            }}
          />
        </form>
      )}
      {feedback && <FormStatus message={feedback.text} error={feedback.error} />}
    </div>
  );
}
