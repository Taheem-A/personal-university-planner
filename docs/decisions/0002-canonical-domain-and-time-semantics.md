# ADR 0002: Canonical domain and time semantics

- Status: Accepted
- Date: 2026-09-21
- Scope: Milestone 1 schema audit, before migration 001

## Context

The Milestone 0 Prisma file was a validating scaffold, not migration history. The roadmap requires the relational vocabulary, ownership boundaries, time meanings, history rules, and external identity rules to be settled before the first migration. The authoritative product specification also separates academic obligations from schedulable work and requires unknown facts to remain unknown.

No migration or live database was created or contacted for this decision.

## Canonical decisions

1. **Three time paths are explicit.** Calendar dates such as term bounds and recurrence effective dates use PostgreSQL `date`. Recurring wall-clock values use PostgreSQL `time(0)` plus an IANA timezone and an explicit `spansNextDay` flag. Instants use `timestamptz(3)` and are handled as UTC at application boundaries. A recurrence is expanded from its local date/time/timezone, then converted to instants; a UTC timestamp is never used as a repeating local schedule.
2. **Intervals are half-open.** Later time-foundation code will treat intervals as `[start, end)`. The database will require end after start, valid date ranges, and positive durations in migration 001 checks.
3. **Ownership is direct and relationally enforced.** Every person-owned model has `userId`. Ownership-sensitive relations reference composite `(id, userId)` keys. This makes user-filtered queries natural and prevents a child from linking to another user's parent even before service authorization is added.
4. **Assessment and Task stay separate.** An Assessment is an academic obligation and owns submission/grade facts. A Task is schedulable effort. Assessment workload and completion percentage are derived from its tasks instead of duplicated as mutable facts.
5. **Submission is not work completion.** `Assessment.submissionStatus/submittedAt` is independent of `Task.status/completedAt` and `CompletionRecord` outcomes.
6. **Duration meanings are named.** Task retains `originalEstimatedMinutes`, `currentEstimatedMinutes`, and `remainingMinutes`. `WorkSession.plannedMinutes` is the scheduled allocation. `CompletionRecord.actualMinutes` is observed time and `remainingAfterMinutes` is the post-observation snapshot. All estimate fields remain nullable when unknown.
7. **Recurring work is first-class.** `RecurringWorkRule` stores course ownership, optional meeting anchor, wall-clock recurrence, effective dates, offsets, task defaults, and activation state. Generated Tasks retain `recurringWorkRuleId` provenance.
8. **Session history is retained.** All required session states remain representable; `locked` is explicit. Superseded sessions point to a single successor and are not deleted. Planner runs remain linked to generated sessions.
9. **Dependencies are finish-to-start for MVP.** `TaskDependencyType` intentionally has only `FINISH_TO_START`. Composite keys prevent duplicates and composite ownership references prevent cross-user edges. A self-edge and graph cycles require migration/application validation because Prisma schema syntax cannot express those checks.
10. **External identity is account scoped.** An integration account is unique per user/provider/external account. Provider objects are unique by `(integrationAccountId, externalId)` and also by `(userId, provider, externalId)`. This preserves the roadmap's provider/external-ID rule without allowing one user's provider IDs to collide with another's. Calendar events use the same account-qualified identity. Disconnecting is a status transition; it does not erase canonical history.
11. **Provenance is compact but sufficient.** Canonical imported/captured records store source kind, authority, and confidence. `ExternalObjectMap` retains provider identity, sync timestamps, and source hash. Field-level conflict policy remains integration-service work and is not prematurely implemented here.
12. **History is archived, not casually cascaded.** User deletion may cascade as the later explicit account-deletion operation. Terms, courses, assessments, tasks, sessions, planner runs, and integrations use archive/status transitions. Their history-bearing child relations use `Restrict`; only relationship rows such as dependency edges disappear with their task. External disconnection does not delete imported canonical records.
13. **Preferences are typed.** One `PlanningPreference` row per user replaces the unbounded key/JSON bag and mirrors the deterministic planner input vocabulary.

## Entity-by-entity audit

| Entity             | Documented meaning                        | Scaffold/domain mismatch                                       | Canonical resolution                                                                 | Migration 001 implication                                             |
| ------------------ | ----------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| User               | Owner and timezone context                | Local day bounds were strings; name was mandatory              | Nullable display name, IANA timezone, native local times                             | Validate timezone at application boundary; check day-window semantics |
| AcademicTerm       | Date-bounded semester                     | Bounds were generic timestamps                                 | Native `date`, direct owner, stable status                                           | Check `endDate >= startDate`                                          |
| Course             | User's enrollment in a term               | Term link could cross users; hard cascade                      | Composite owned term link, provenance, archive timestamp                             | Add unique/index strategy and nonnegative credit check                |
| CourseMeeting      | Recurring local class meeting             | No direct owner; strings/timestamps mixed                      | Owner, `time(0)`, timezone, RRULE, `date` effectiveness, overnight flag              | Check local/date ranges and RRULE at boundary                         |
| Assessment         | Academic obligation and submission facts  | Lifecycle status blurred submission; indirect ownership        | Direct owner, explicit submission state, nullable true deadline, grade facts         | Check grade ranges and submission timestamp consistency               |
| Task               | Schedulable effort                        | Ambiguous `estimatedMinutes`; weak owned links                 | Original/current/remaining estimates, nullable unknowns, owned hierarchy and origins | Positive/range checks; parent cannot equal self                       |
| TaskDependency     | Ordering constraint                       | String type, no owner                                          | Owned finish-to-start edge with duplicate prevention                                 | Add self-edge check; service rejects cycles                           |
| RecurringWorkRule  | Generator of recurring coursework         | Missing                                                        | First-class wall-clock rule with task defaults and generated-task provenance         | Validate offsets/session defaults and recurrence syntax               |
| CalendarEvent      | Fixed/flexible occupied interval          | Global-ish external identity; weak provenance                  | UTC-safe interval, account-qualified external identity, source/authority/confidence  | Check `endAt > startAt`; partial unique behavior                      |
| AvailabilityRule   | Recurring usable capacity                 | String time and generic dates                                  | Wall-clock/timezone recurrence with date-only effectiveness                          | Check capacity 0–1 and ranges                                         |
| ProtectedTimeRule  | Recurring hard/soft protected time        | String time and generic dates                                  | Wall-clock/timezone recurrence, reason, date-only effectiveness                      | Check ranges; reject informational protection if policy disallows it  |
| PlanningPreference | Deterministic planning policy             | Arbitrary key/JSON rows                                        | One typed row per user                                                               | Add nonnegative/range checks and seed defaults later                  |
| WorkSession        | Historical planned/actual scheduling unit | Cascaded with task; supersession could disappear               | All seven states, explicit lock, retained task/run/supersession links                | Check positive interval/minutes and supersession invariants           |
| CompletionRecord   | Observation/outcome for work              | No owner; ambiguous completed-minutes estimate                 | Direct owner, actual time, remaining-after snapshot, optional session                | Positive checks; enforce matching task/session in service             |
| EstimateProfile    | Learned aggregate, not original fact      | Nullable polymorphic context had weak uniqueness               | Required stable context key and unique owned aggregate                               | Define allowed context vocabulary before seed                         |
| PlannerRun         | Explainable planning execution            | Trigger cause lacked entity provenance                         | UTC horizon, input snapshot, trigger type/entity, result summary/history             | Check horizon and terminal timestamps                                 |
| IntegrationAccount | A user's provider account                 | Only one provider account; token blob mixed into ordinary data | Multiple external accounts, credential reference, disconnect/error state             | Secrets storage is deferred; never put raw tokens in seed/history     |
| ExternalObjectMap  | Provider-to-canonical identity            | Global provider/external uniqueness collided across users      | Account- and user/provider-scoped uniqueness with sync provenance                    | Ensure provider matches account in service or SQL check               |
| InboxItem          | Unresolved capture/proposal               | Minimal provenance                                             | Owner, source/authority/confidence, optional proposal, processed instant             | Validate proposal at trusted service boundary                         |

## Specification tensions resolved

- The older product text lists assessment estimated workload and completion percentage, while the frozen architecture says Assessment is obligation and Task is schedulable effort. The canonical model derives assessment workload/progress from Tasks to avoid two mutable sources of truth.
- The roadmap's shorthand “provider + external_id uniqueness” is global only if read literally. Privacy and multi-account requirements require the provider identity to be qualified by user/provider account; both scoped constraints are retained.
- The older entity list names `PersonalCommitment`, `TimeEstimate`, and `ExternalIntegration`; the current roadmap names `ProtectedTimeRule`/`CalendarEvent`, Task estimate fields plus `EstimateProfile`, and `IntegrationAccount`/`ExternalObjectMap`. The newer roadmap vocabulary governs.

## Intentionally deferred

- Migration 001, SQL check constraints, zero-to-current proof, and deterministic seed.
- Repository/service code, authorization, cycle detection, optimistic concurrency, provider conflict resolution, and credential storage.
- Auth.js models, integration engines, planner-core v1 changes, and production UI.

## Time-foundation implementation policy

- `packages/shared` owns local-date, local-time, timezone, instant-interval, recurrence, and scheduling-quantum primitives. Domain types re-export these definitions; callers do not create a competing representation.
- Instant intervals are half-open `[start, end)` and require `start < end`. Touching intervals do not overlap, although normalization merges adjacent intervals by default when coverage policy allows it.
- Instant duration uses elapsed epoch time, so a Toronto `01:30` to `03:30` interval over the 2026 spring transition is 60 minutes rather than two wall-clock hours.
- Local-to-instant conversion always requires an IANA timezone. Ambiguous fall-back times select the earlier instant by default; callers may explicitly select the later instant or reject ambiguity. Nonexistent spring-forward local times are rejected.
- Recurrence expansion supports the canonical Milestone-1 subset: `FREQ=DAILY` or `FREQ=WEEKLY`, optional positive `INTERVAL`, and weekly `BYDAY`, bounded by explicit effective dates. It reconstructs each occurrence from local date, local time, and timezone so the wall clock survives offset changes.
- A nonexistent recurrence occurrence is skipped by default because no such local instant occurs; strict callers may request rejection. Ambiguous occurrences use the same explicit earlier/later/reject policy as direct conversion.
- The implementation uses the platform `Date` and `Intl.DateTimeFormat` IANA database behind a shared API. No third-party dependency is admitted because the required recurrence subset and deterministic DST policy are small, tested, and do not justify another time system.
- Planner scheduling precision defaults to five minutes. Shared helpers validate, round up/down, and test quantum alignment; persisted instants retain millisecond precision.

## Consequences

The schema and time conversion contracts are now ready to be represented by the first source-controlled migration. Domain code names the current planning estimate explicitly and consumes shared local-date/local-time/timezone concepts without importing Prisma types.
