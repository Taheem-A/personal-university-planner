# Account data lifecycle (Milestone 2 service boundary)

The authenticated canonical User owns every record. Services obtain this ID from the server-side session; no export or deletion input can substitute another owner. All mutations run inside the application transaction and use user-scoped repositories.

## Ordinary academic history

| Object                                                 | Normal removal behavior                                                                                                                                                                                  |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AcademicTerm                                           | Change status to `ARCHIVED`; preserve courses and history.                                                                                                                                               |
| Course, Assessment, Task, CourseMeeting, CalendarEvent | Set `archivedAt`; preserve existing related facts. Archived rows remain in scoped history queries.                                                                                                       |
| AvailabilityRule, ProtectedTimeRule                    | Set `active = false`; retain recurrence and dates.                                                                                                                                                       |
| WorkSession                                            | Keep planned, locked, generated-by, completion and supersession history. A planned manual session may be cancelled; planner-generated sessions and completed sessions cannot be rewritten by this slice. |
| CompletionRecord, PlannerRun                           | Append/read factual records. No fake run or automatic replanning.                                                                                                                                        |
| InboxItem                                              | Preserve raw text and provenance; process or dismiss with a timestamp.                                                                                                                                   |
| IntegrationAccount                                     | Disconnect clears its credential reference, sets `DISCONNECTED`, preserves metadata, mappings and canonical academic/calendar history. No provider is contacted by this service.                         |
| ExternalObjectMap                                      | Preserve ownership-safe mapping/provenance after disconnect. Account deletion removes it.                                                                                                                |

The versioned canonical JSON export (`university-planner-canonical`, version `1`) contains user settings, academic state, recurring work rules, calendar and availability state, preferences, inbox, work/completion history, estimate profiles, planner metadata, integration metadata and external mappings. It omits auth identities, auth secrets, integration credential references and token/secret keys nested in JSON metadata. The export takes place inside one transaction; snapshot isolation and external-provider export are separate later decisions.

## Full account deletion

The operation requires an authenticated session and exact confirmation text `DELETE MY ACCOUNT`. The repository deletes child relations in dependency order, clears self-references, removes the User and authentication identities, all inside one database transaction. A failed operation rolls back. An already issued session becomes unusable because actor resolution checks for the canonical User. Provider-side revocation is not implied: this milestone stores no provider credentials or sync implementation. Live disposable-database deletion and rollback verification are required before shipping the account-deletion endpoint to users.

Milestone 4 owns Planner Service persistence and actual planner-generated runs. Milestone 7 owns completion-driven execution/replanning transitions. Neither is performed here.
