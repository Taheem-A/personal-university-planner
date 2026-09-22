# Database persistence boundary

Milestone 1 keeps all canonical PostgreSQL and Prisma access in `packages/database`. Domain, planner-core, and browser code consume neither Prisma nor this package directly. Milestone 2 server application services may depend on the package root and remain responsible for authentication, authorization, validation, and application error mapping.

## Structure

- `src/client.ts` constructs the server-only client and owns runtime reuse.
- `src/transaction.ts` runs a callback with repositories bound to one Prisma transaction.
- `src/repositories/` contains explicit repositories grouped by academic, planning, calendar, history, and integration vocabulary.
- `src/records.ts` declares the plain records returned at the public boundary.
- `src/mapping.ts` converts Prisma-native dates, times, decimals, JSON, and arrays to those records.
- `src/errors.ts` inspects known database errors without hiding or replacing the original error.

Only `src/index.ts` is exported by the package. Generated Prisma models and input types are implementation details.

## Client lifecycle and connections

`getDatabase()` reads `DATABASE_URL` lazily on the server. Development uses a `globalThis` singleton to survive Next.js hot reload; production uses one module-level instance. Tests call `createDatabase({ connectionString })` with an explicit disposable URL. Ambient runtime access is rejected when `APP_ENV=test` or `NODE_ENV=test`, preventing an accidental test connection to production.

The runtime client may use the pooled Neon URL. Migration, seed, and repository integration commands retain their separate direct-connection variables and safeguards.

## Repositories and ownership

Repositories cover User, AcademicTerm, Course, CourseMeeting, Assessment, Task, TaskDependency, RecurringWorkRule, CalendarEvent, AvailabilityRule, ProtectedTimeRule, PlanningPreference, WorkSession, CompletionRecord, EstimateProfile, PlannerRun, IntegrationAccount, ExternalObjectMap, and InboxItem.

Reads and mutations of person-owned data require `userId` where an unconstrained identifier could cross an ownership boundary. Examples include task-by-user lookup, courses by user and term, and work sessions by user and time range. Composite database relations continue to enforce same-owner links. This makes later authorization difficult to omit accidentally, but it does not replace Milestone-2 authorization.

The repositories are intentionally explicit rather than a generic base repository. They expose canonical operations such as archive, supersede, status transition, hierarchy lookup, dependency lookup, and external-identity resolution.

## Transactions and errors

`database.transaction(callback)` supplies a transaction context whose repositories all share one Prisma transaction client. The helper does not catch failures; thrown errors propagate through Prisma and roll back the complete operation.

Constraint failures are also allowed to propagate. `getDatabaseErrorDetails(error)` provides stable structured details—kind, Prisma code, fields, and constraint name—so Milestone-2 services can map expected failures without parsing arbitrary messages.

## Verification

Run the guarded live suite with a direct disposable Neon URL:

```powershell
$env:APP_ENV = "test"
$env:REPOSITORY_TEST_DATABASE_URL = "<direct disposable URL>"
$env:CONFIRM_REPOSITORY_TEST_DATABASE = "RUN_REPOSITORY_INTEGRATION_TESTS"
pnpm db:repositories:verify
```

The target database name must begin with `up_m1_seed_`. The suite reads the deterministic fixture and uses isolated fixed test identifiers for round trips, cross-user checks, rollback, temporal values, JSON, history links, and uniqueness errors. It cleans up only records created by that suite and never resets the database.
