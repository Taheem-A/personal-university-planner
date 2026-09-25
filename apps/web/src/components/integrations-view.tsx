import type { IntegrationsViewModel } from "../server/application/secondary-reads";
import { StatusIndicator } from "./planner-primitives";

const providers = [
  {
    key: "google_calendar",
    name: "Google Calendar",
    description: "Calendar occupied time and optional Study Plan publishing.",
    milestone: "Milestone 9",
  },
  {
    key: "quercus",
    name: "Quercus / LMS",
    description: "Course and assessment import boundary.",
    milestone: "Milestone 14",
  },
  {
    key: "google_drive",
    name: "Google Drive",
    description: "Course and assessment resources.",
    milestone: "Later milestone",
  },
  {
    key: "email",
    name: "Email ingestion",
    description: "Potential captured academic information.",
    milestone: "Later milestone",
  },
] as const;
function matches(provider: string, key: string) {
  const normalized = provider.toLowerCase().replace(/[^a-z0-9]/g, "");
  return key === "google_calendar"
    ? normalized === "googlecalendar"
    : key === "google_drive"
      ? normalized === "googledrive"
      : key === "quercus"
        ? normalized === "quercus" || normalized === "lms"
        : normalized === "email";
}
function stamp(date: Date | null, timezone: string) {
  return date
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: timezone,
      }).format(date)
    : "Never";
}
export function IntegrationsView({ model }: { model: IntegrationsViewModel }) {
  const known = new Set(
    model.accounts
      .filter((account) => providers.some((provider) => matches(account.provider, provider.key)))
      .map((account) => account.id),
  );
  return (
    <div className="route-content integrations-content">
      <header className="page-header">
        <h1>Integrations</h1>
        <p>External sources can supply facts. The planner remains in control of the schedule.</p>
      </header>
      <div className="integrations-list">
        {providers.map((provider) => {
          const accounts = model.accounts.filter((account) =>
            matches(account.provider, provider.key),
          );
          return (
            <section key={provider.key} className="integration-row">
              <div>
                <h2>{provider.name}</h2>
                <p>{provider.description}</p>
                {accounts.length ? (
                  accounts.map((account) => (
                    <p key={account.id} className="integration-meta">
                      {account.displayName ?? "Account name unavailable"} · Last successful sync:{" "}
                      {stamp(account.lastSuccessAt, model.timezone)} · Last attempt:{" "}
                      {stamp(account.lastSyncAt, model.timezone)}
                    </p>
                  ))
                ) : (
                  <p className="integration-meta">
                    No account recorded. Connection workflow planned for {provider.milestone}.
                  </p>
                )}
              </div>
              <div className="integration-status">
                {accounts.length ? (
                  accounts.map((account) => (
                    <StatusIndicator
                      key={account.id}
                      tone={
                        account.status === "ACTIVE"
                          ? "success"
                          : account.status === "ERROR"
                            ? "danger"
                            : "info"
                      }
                    >
                      {account.status === "ACTIVE"
                        ? "Connected"
                        : account.status === "ERROR"
                          ? "Connection error"
                          : "Disconnected"}
                    </StatusIndicator>
                  ))
                ) : (
                  <StatusIndicator tone="info">Not connected</StatusIndicator>
                )}
                <span>{provider.milestone}</span>
              </div>
            </section>
          );
        })}
        {model.accounts
          .filter((account) => !known.has(account.id))
          .map((account) => (
            <section key={account.id} className="integration-row">
              <div>
                <h2>{account.provider}</h2>
                <p>{account.displayName ?? "Recorded integration account"}</p>
                <p className="integration-meta">
                  Last successful sync: {stamp(account.lastSuccessAt, model.timezone)} · Last
                  attempt: {stamp(account.lastSyncAt, model.timezone)}
                </p>
              </div>
              <div className="integration-status">
                <StatusIndicator
                  tone={
                    account.status === "ACTIVE"
                      ? "success"
                      : account.status === "ERROR"
                        ? "danger"
                        : "info"
                  }
                >
                  {account.status.toLowerCase()}
                </StatusIndicator>
              </div>
            </section>
          ))}
      </div>
      <p className="integrations-note">
        Connection, import, sync, and publishing controls are not available in this milestone. A
        stored account is shown only with its recorded status.
      </p>
    </div>
  );
}
