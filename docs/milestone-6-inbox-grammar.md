# Milestone 6 deterministic Inbox grammar

Quick Capture saves the original text as an ACTIVE Inbox item before interpretation. Interpretation is optional and requested from the Inbox review. A failed or unsupported interpretation leaves the original capture active. A proposal is never a canonical academic fact.

Only these explicit forms produce a proposal:

```text
task: Title; course CODE; duration 2h; due 2026-10-05 17:00
assignment: Title; course CODE; due 2026-10-05 17:00
event: Title; course CODE; start 2026-10-05 13:00; end 2026-10-05 14:00
```

- The cue at the beginning, followed by a colon, is required. `task`, `assignment`, and `event` map to Task, Assessment, and CalendarEvent proposals respectively. The title is required; all semicolon-separated facts are optional except the title.
- `course CODE` matches exactly one non-archived course in one of the authenticated user's non-archived terms, case-insensitively. Unknown or duplicate codes produce no proposal. No cross-user course search occurs.
- `duration` accepts only a positive whole number followed by `h` or `m`, such as `2h` or `90m`. It is proposed as minutes for a Task only.
- `due`, `start`, and `end` accept only `YYYY-MM-DD HH:mm` in the user's configured IANA timezone. The shared local-time converter rejects nonexistent and repeated DST wall times until the user corrects them. Event start must precede end when both are supplied.
- Duplicate, unsupported, or misplaced facts produce no proposal. Relative wording such as “next Sunday” is never converted into a deadline. Missing dates and durations remain null.

The review form can replace every proposed value and choose a different entity type. Resolution validates the final payload with the same application-service rules used by ordinary manual creation. The canonical insert and Inbox transition to PROCESSED share one transaction; planner triggering occurs after commit. The saved Inbox row retains raw text and proposal and records the resolved canonical type and ID. Dismissal retains the row and original text.

This grammar is deliberately narrow. Milestone 10 natural-language planning must not treat it as an AI or general language interpreter.
