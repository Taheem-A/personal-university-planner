"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitMutation } from "./mutation-client";

function savedCapture(value: unknown): value is { id: string; status: "ACTIVE" } {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as { id?: unknown }).id === "string" &&
    (value as { status?: unknown }).status === "ACTIVE",
  );
}

export function QuickCapture({ focusOnMount }: { focusOnMount: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  useEffect(() => {
    if (focusOnMount) input.current?.focus();
  }, [focusOnMount]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rawText = value.trim();
    if (!rawText) {
      setMessage({ type: "error", text: "Enter something to capture." });
      input.current?.focus();
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await submitMutation(
        "/api/v1/inbox/capture",
        "POST",
        { rawText },
        savedCapture,
      );
      if (!result.ok) {
        setMessage({
          type: "error",
          text: result.message,
        });
        return;
      }
      setValue("");
      setMessage({
        type: "success",
        text: "Saved to Inbox as raw text. Open the item to review or request an interpretation.",
      });
      router.refresh();
      input.current?.focus();
    } catch {
      setMessage({ type: "error", text: "Capture could not be saved. Try again." });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="quick-capture">
      <form onSubmit={submit} noValidate>
        <label htmlFor="quick-capture-input">Quick capture</label>
        <div>
          <input
            id="quick-capture-input"
            ref={input}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={10000}
            autoComplete="off"
            aria-describedby="quick-capture-help quick-capture-result"
            aria-invalid={message?.type === "error"}
            placeholder="Add a task, deadline, or note…"
          />
          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Add"}
          </button>
        </div>
      </form>
      <p id="quick-capture-help">
        Capture now. Review or request a limited interpretation in Inbox when ready.
      </p>
      <p
        id="quick-capture-result"
        role={message?.type === "error" ? "alert" : "status"}
        className={`capture-result${message ? ` ${message.type}` : ""}`}
      >
        {message?.text ?? ""}
      </p>
    </div>
  );
}
