# ADR 0008 — Information views and raw Quick Capture boundary

Status: accepted for the Milestone-5 information-surface slice. Date: 2026-09-25.

## Decision

Upcoming and Inbox use authenticated application read models. Upcoming assembles assessment, independent-task, course, active-session and last-successful-plan facts from one user-scoped repeatable-read snapshot. The UI receives a presentation projection and does not read repositories or calculate risk. Inbox projects canonical InboxItems from user-scoped status reads. Unknown due dates and estimates remain explicit; archived or unrelated-user facts do not enter either model.

Assessment selection stays on `/upcoming` as `assessment=<id>`, with `view=<section>`. The authorized view-model read resolves the ID; unknown, archived and unauthorized IDs have the same unavailable presentation. Opening detail preserves the current range and sort in the URL, so browser Back returns to the meaningful parent. The same URL renders as a desktop right panel or a narrow-screen full-width detail.

The pre-existing `inboxItems.capture` application service is safe to expose as a narrow raw-text mutation before Milestone 6. `/api/v1/inbox/capture` uses the shared same-origin JSON transport guard and service-derived actor; it returns only persisted ID and status. Client success feedback requires a confirmed saved ID. The form never implies a parsed task, deadline, course or assessment was created. Inbox proposal/resolution and any interpretation remain Milestone 6 work.

## Consequences

The production screens remain fixture-free and their data path remains UI → application read/mutation service → scoped repository. Assessment sessions displayed in detail are limited to the read snapshot's near-term window, and the UI names this limit when no sessions are shown. No new library or client identity mechanism is required. Later Milestone-6 capture workflows can extend the mutation path without changing these read-model or URL boundaries.
