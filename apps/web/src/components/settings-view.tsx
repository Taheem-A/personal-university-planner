import Link from "next/link";
import type { SettingsViewModel } from "../server/application/secondary-reads";
import { AppearanceControl } from "./appearance-control";

const sections = [
  ["general", "General"],
  ["planning", "Planning"],
  ["appearance", "Appearance"],
  ["data", "Data & privacy"],
] as const;
function SettingRow({
  label,
  description,
  value,
}: {
  label: string;
  description: string;
  value: React.ReactNode;
}) {
  return (
    <div className="setting-row">
      <div>
        <h3>{label}</h3>
        <p>{description}</p>
      </div>
      <div className="setting-value">{value}</div>
    </div>
  );
}
function minutes(value: number) {
  return `${value} minutes`;
}
function yesNo(value: boolean) {
  return value ? "Enabled" : "Disabled";
}
export function SettingsView({ model, section }: { model: SettingsViewModel; section: string }) {
  const preferences = model.preferences;
  return (
    <div className="route-content settings-content">
      <header className="page-header">
        <h1>Settings</h1>
        <p>Your planning boundaries and account context.</p>
      </header>
      <div className="settings-layout">
        <nav className="settings-navigation" aria-label="Settings sections">
          {sections.map(([id, label]) => (
            <Link
              key={id}
              href={`/settings?section=${id}`}
              aria-current={section === id ? "page" : undefined}
              className={section === id ? "active" : ""}
            >
              {label}
            </Link>
          ))}
          <Link href="/integrations">Integrations</Link>
        </nav>
        <section className="settings-panel" aria-labelledby="settings-section-title">
          <h2 id="settings-section-title">
            {sections.find(([id]) => id === section)?.[1] ?? "General"}
          </h2>
          {section === "general" && (
            <>
              <SettingRow
                label="Account"
                description="Name on this planning account."
                value={model.user.name ?? "Name not set"}
              />
              <SettingRow
                label="Time zone"
                description="Deadlines and recurring rules use this time zone."
                value={model.user.timezone}
              />
              <SettingRow
                label="Active term"
                description="Current academic context."
                value={
                  model.activeTerm
                    ? `${model.activeTerm.name} · ${model.activeTerm.startDate}–${model.activeTerm.endDate}`
                    : "No active term"
                }
              />
              <SettingRow
                label="Planning day"
                description="Your recorded day bounds."
                value={
                  model.user.defaultDayStart && model.user.defaultDayEnd
                    ? `${model.user.defaultDayStart}–${model.user.defaultDayEnd}`
                    : "Not set"
                }
              />
              <SettingRow
                label="Locale"
                description="Your recorded locale."
                value={model.user.locale ?? "Not set"}
              />
            </>
          )}
          {section === "planning" &&
            (preferences ? (
              <>
                <SettingRow
                  label="Preferred daily study limit"
                  description="A planning preference, not a hard cap."
                  value={minutes(preferences.preferredDailyStudyLimitMinutes)}
                />
                <SettingRow
                  label="Minimum free time"
                  description="Preferred time kept outside planned work."
                  value={minutes(preferences.minimumFreeTimeMinutes)}
                />
                <SettingRow
                  label="Deadline buffer"
                  description="Preferred lead time before due dates."
                  value={`${preferences.preferredDeadlineBufferHours} hours`}
                />
                <SettingRow
                  label="Consecutive work"
                  description="Preferred maximum before a break."
                  value={minutes(preferences.maximumConsecutiveWorkMinutes)}
                />
                <SettingRow
                  label="Minimum break"
                  description="Preferred break between work periods."
                  value={minutes(preferences.minimumBreakMinutes)}
                />
                <SettingRow
                  label="Sleep minimum"
                  description="Recorded non-negotiable sleep boundary."
                  value={
                    preferences.minimumSleepMinutes === null
                      ? "Not specified"
                      : minutes(preferences.minimumSleepMinutes)
                  }
                />
                <SettingRow
                  label="Commute work"
                  description="Allow compatible work during commute availability."
                  value={yesNo(preferences.scheduleCommuteWork)}
                />
                <SettingRow
                  label="Late high-energy tasks"
                  description="Avoid late placement when possible."
                  value={yesNo(preferences.avoidLateHighEnergyTasks)}
                />
                <SettingRow
                  label="Plan stability window"
                  description="Prefer to keep near-term sessions stable."
                  value={minutes(preferences.planStabilityWindowMinutes)}
                />
                <SettingRow
                  label="Weekend work bias"
                  description="Stored planning preference."
                  value={String(preferences.weekendWorkBias)}
                />
              </>
            ) : (
              <p className="secondary-empty">Planning preferences have not been provisioned.</p>
            ))}
          {section === "appearance" && (
            <>
              <SettingRow
                label="Appearance"
                description="Choose light or dark surfaces. Your choice is retained in this browser."
                value={<AppearanceControl />}
              />
              <p className="settings-note">
                Status labels and course codes remain visible in both themes. Reduced-motion
                preferences are respected automatically.
              </p>
            </>
          )}
          {section === "data" && (
            <>
              <SettingRow
                label="Account data"
                description="Your academic and planning records remain scoped to this account."
                value="Stored in your account"
              />
              <SettingRow
                label="Export"
                description="The existing account export endpoint provides a copy of your data."
                value="Available through the account service"
              />
              <SettingRow
                label="Deletion"
                description="Account deletion is a separate irreversible service action."
                value="No action on this screen"
              />
              <p className="settings-note">
                Data controls will receive their reviewed interface in the manual-management
                milestone.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
