import { getDatabaseErrorDetails } from "@university-planner/database";

export type ApplicationErrorCode =
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "STALE_WRITE"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "EXTERNAL_PROVIDER_FAILURE"
  | "PLANNER_INFEASIBLE"
  | "INTERNAL_ERROR";

export class ApplicationError extends Error {
  constructor(
    public readonly code: ApplicationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}

export type ApplicationResult<T> =
  { ok: true; value: T } | { ok: false; error: { code: ApplicationErrorCode; message: string } };

export function applicationFailure(error: unknown): {
  code: ApplicationErrorCode;
  message: string;
} {
  if (error instanceof ApplicationError) return { code: error.code, message: error.message };
  const databaseError = getDatabaseErrorDetails(error);
  if (databaseError?.kind === "UNIQUE_CONSTRAINT")
    return { code: "CONFLICT", message: "This record conflicts with an existing record." };
  if (databaseError?.kind === "NOT_FOUND")
    return { code: "NOT_FOUND", message: "Record not found." };
  if (databaseError?.kind === "FOREIGN_KEY_CONSTRAINT")
    return { code: "CONFLICT", message: "The related record is unavailable." };
  return { code: "INTERNAL_ERROR", message: "The operation could not be completed." };
}

export async function resultOf<T>(operation: () => Promise<T>): Promise<ApplicationResult<T>> {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    return { ok: false, error: applicationFailure(error) };
  }
}
