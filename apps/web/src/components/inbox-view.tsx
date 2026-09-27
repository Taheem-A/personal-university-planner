import Link from "next/link";
import { Inbox as InboxIcon } from "lucide-react";
import type { InboxViewModel } from "../server/application/information-reads";
import { QuickCapture } from "./quick-capture";
import { InboxResolution } from "./inbox-resolution";

const statusNames = { ACTIVE: "Inbox", PROCESSED: "Processed", DISMISSED: "Dismissed" } as const;
function stamp(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date);
}
export function InboxView({
  model,
  status,
  focusCapture,
  selectedId,
}: {
  model: InboxViewModel;
  status: "ACTIVE" | "PROCESSED" | "DISMISSED";
  focusCapture: boolean;
  selectedId: string | null;
}) {
  const items = model.items.filter((item) => item.status === status);
  const needsInterpretation = model.items.filter(
    (item) => item.status === "ACTIVE" && !item.proposedEntityType,
  ).length;
  return (
    <div className="route-content inbox-content">
      <header className="page-header">
        <h1>Inbox</h1>
        <p>Capture now. Review details when they are available.</p>
      </header>
      <div className="inbox-layout">
        <div className="inbox-main">
          <QuickCapture focusOnMount={focusCapture} />
          <nav className="inbox-tabs" aria-label="Inbox status">
            {model.tabs.map((tab) => (
              <Link
                key={tab.status}
                href={`/inbox?status=${tab.status}`}
                className={status === tab.status ? "active" : ""}
                aria-current={status === tab.status ? "page" : undefined}
              >
                {statusNames[tab.status]} <span>{tab.count}</span>
              </Link>
            ))}
          </nav>
          {items.length ? (
            <ul className="inbox-list">
              {items.map((item) => (
                <li key={item.id} className="inbox-row">
                  <span className="inbox-row-icon" aria-hidden="true">
                    <InboxIcon size={18} />
                  </span>
                  <div className="inbox-row-main">
                    <Link
                      href={`/inbox?status=${status}&item=${encodeURIComponent(item.id)}`}
                      aria-current={selectedId === item.id ? "true" : undefined}
                    >
                      <strong>{item.rawText}</strong>
                    </Link>
                    <span>
                      {item.proposedEntityType
                        ? `Proposed ${item.proposedEntityType.toLowerCase()}${item.proposedTitle ? ` · ${item.proposedTitle}` : ""} — unconfirmed`
                        : "Captured as raw text · details unresolved"}
                    </span>
                  </div>
                  <span className="inbox-row-source">
                    {item.source.replaceAll("_", " ").toLowerCase()}
                  </span>
                  <time dateTime={item.createdAt.toISOString()}>
                    {stamp(item.createdAt, model.timezone)}
                  </time>
                  <span className="inbox-row-status">{statusNames[item.status]}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="inbox-empty">
              <strong>
                {status === "ACTIVE"
                  ? "Your inbox is clear"
                  : `No ${statusNames[status].toLowerCase()} items`}
              </strong>
              <p>
                {status === "ACTIVE"
                  ? "Capture new information above. It will appear here after it is saved."
                  : "Nothing is recorded in this status yet."}
              </p>
            </div>
          )}
          {selectedId && items.some((item) => item.id === selectedId) && (
            <InboxResolution
              key={`${selectedId}:${items.find((item) => item.id === selectedId)!.version}`}
              item={items.find((item) => item.id === selectedId)!}
              timezone={model.timezone}
              courses={model.courseChoices}
            />
          )}
        </div>
        <aside className="inbox-side" aria-label="Inbox context">
          <section>
            <h2>Needs interpretation</h2>
            <p>
              {needsInterpretation === 0
                ? "No active raw captures await interpretation."
                : `${needsInterpretation} active ${needsInterpretation === 1 ? "item" : "items"} saved as raw text. You can request a limited interpretation while reviewing each item.`}
            </p>
          </section>
          <section>
            <h2>About Quick Capture</h2>
            <p>
              Capture saves original text first. A proposal is a suggestion until you review and
              save a canonical object.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
