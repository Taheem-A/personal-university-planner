"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { localDateTimeToInstant } from "@university-planner/shared";

type BaseField = { label: string; help?: string; error?: string; id?: string };
type InputFieldProps = BaseField &
  Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id"> & {
    type?: "text" | "number" | "date" | "datetime-local";
  };

export function FormField({ label, help, error, id, type = "text", ...props }: InputFieldProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  const helpId = `${fieldId}-help`;
  const errorId = `${fieldId}-error`;
  return (
    <div className="mutation-field">
      <label htmlFor={fieldId}>{label}</label>
      <input
        {...props}
        id={fieldId}
        type={type}
        aria-invalid={Boolean(error)}
        aria-describedby={[help && helpId, error && errorId].filter(Boolean).join(" ") || undefined}
      />
      {help && <p id={helpId}>{help}</p>}
      {error && (
        <p id={errorId} className="mutation-field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  help,
  error,
  id,
  children,
  ...props
}: BaseField & Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & { children: ReactNode }) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <div className="mutation-field">
      <label htmlFor={fieldId}>{label}</label>
      <select
        {...props}
        id={fieldId}
        aria-invalid={Boolean(error)}
        aria-describedby={
          [help && `${fieldId}-help`, error && `${fieldId}-error`].filter(Boolean).join(" ") ||
          undefined
        }
      >
        {children}
      </select>
      {help && <p id={`${fieldId}-help`}>{help}</p>}
      {error && (
        <p id={`${fieldId}-error`} className="mutation-field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function CheckField({
  label,
  help,
  error,
  id,
  ...props
}: BaseField & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id">) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <div className="mutation-field mutation-check">
      <label htmlFor={fieldId}>
        <input
          {...props}
          id={fieldId}
          type="checkbox"
          aria-invalid={Boolean(error)}
          aria-describedby={
            [help && `${fieldId}-help`, error && `${fieldId}-error`].filter(Boolean).join(" ") ||
            undefined
          }
        />
        {label}
      </label>
      {help && <p id={`${fieldId}-help`}>{help}</p>}
      {error && (
        <p id={`${fieldId}-error`} className="mutation-field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function DaySelection({
  value,
  onChange,
  label = "Days",
}: {
  value: string[];
  onChange: (days: string[]) => void;
  label?: string;
}) {
  const days = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
  return (
    <fieldset className="mutation-days">
      <legend>{label}</legend>
      {days.map((day) => (
        <CheckField
          key={day}
          label={day}
          checked={value.includes(day)}
          onChange={(event) =>
            onChange(event.target.checked ? [...value, day] : value.filter((item) => item !== day))
          }
        />
      ))}
    </fieldset>
  );
}

export function InstantField({
  timezone,
  meaning = "deadline",
  ...props
}: Omit<InputFieldProps, "type"> & { timezone: string; meaning?: "deadline" | "event" }) {
  return (
    <FormField
      {...props}
      type="datetime-local"
      help={`${props.help ? `${props.help} ` : ""}Local time in ${timezone}. The saved ${meaning === "event" ? "event time" : "deadline"} is a UTC instant; ambiguous or nonexistent local times require correction.`}
    />
  );
}

/** Reject DST gaps and overlaps until the user supplies an unambiguous wall-clock deadline. */
export function deadlineInstant(local: string, timezone: string): string {
  const [date, time] = local.split("T");
  if (!date || !time) throw new Error("Enter a local date and time.");
  return localDateTimeToInstant({ date, time, timezone }, "REJECT").toISOString();
}

export function ValidationSummary({ errors }: { errors: string[] }) {
  return errors.length ? (
    <div className="mutation-summary" role="alert">
      <strong>Check these fields</strong>
      <ul>
        {errors.map((error, index) => (
          <li key={`${error}-${index}`}>{error}</li>
        ))}
      </ul>
    </div>
  ) : null;
}

export function FormStatus({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <p
      className={error ? "mutation-status error" : "mutation-status"}
      role={error ? "alert" : "status"}
      aria-live={error ? "assertive" : "polite"}
    >
      {message}
    </p>
  );
}

export function FormActions({
  saving,
  onCancel,
  destructive = false,
}: {
  saving: boolean;
  onCancel: () => void;
  destructive?: boolean;
}) {
  return (
    <div className="mutation-actions">
      <button
        className={destructive ? "button button-danger-quiet" : "button button-primary"}
        type="submit"
        disabled={saving}
      >
        {saving ? "Saving…" : destructive ? "Archive" : "Save"}
      </button>
      <button
        className="button button-secondary"
        type="button"
        onClick={onCancel}
        disabled={saving}
      >
        Cancel
      </button>
    </div>
  );
}

export function ArchiveConfirmation({
  name,
  confirmed,
  onChange,
}: {
  name: string;
  confirmed: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <CheckField
      label={`I understand that ${name} will be archived.`}
      checked={confirmed}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}
