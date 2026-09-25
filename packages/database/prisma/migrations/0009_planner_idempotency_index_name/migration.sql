-- PostgreSQL truncated the 0008 idempotency index name at 63 bytes. Prisma's
-- generated name truncates it differently; align the tracked database index.
ALTER INDEX "PlannerRun_userId_triggerType_idempotencyScope_idempotencyKey_k"
  RENAME TO "PlannerRun_userId_triggerType_idempotencyScope_idempotencyK_key";
