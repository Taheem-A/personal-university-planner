export type DatabaseErrorKind =
  "UNIQUE_CONSTRAINT" | "FOREIGN_KEY_CONSTRAINT" | "NOT_FOUND" | "KNOWN_DATABASE_ERROR";

export interface DatabaseErrorDetails {
  kind: DatabaseErrorKind;
  code: string;
  fields: string[];
  constraint: string | null;
}

function strings(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return typeof value === "string" ? [value] : [];
}

/**
 * Classifies structured Prisma errors without replacing the original error.
 * Repositories intentionally let failures propagate so callers retain the
 * original code, metadata, stack, and transaction rollback behavior.
 */
export function getDatabaseErrorDetails(error: unknown): DatabaseErrorDetails | null {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  const code = (error as { code?: unknown }).code;
  if (typeof code !== "string" || !code.startsWith("P")) return null;

  const meta = (error as { meta?: unknown }).meta;
  const metadata = meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};
  const adapterError =
    metadata.driverAdapterError && typeof metadata.driverAdapterError === "object"
      ? (metadata.driverAdapterError as { cause?: unknown })
      : undefined;
  const adapterCause =
    adapterError?.cause && typeof adapterError.cause === "object"
      ? (adapterError.cause as Record<string, unknown>)
      : {};
  const adapterConstraint =
    adapterCause.constraint && typeof adapterCause.constraint === "object"
      ? (adapterCause.constraint as Record<string, unknown>)
      : {};
  const modelName = typeof metadata.modelName === "string" ? metadata.modelName : null;
  const constraint =
    typeof metadata.constraint === "string"
      ? metadata.constraint
      : typeof adapterConstraint.index === "string"
        ? adapterConstraint.index
        : modelName;
  let fields = strings(metadata.target ?? metadata.field_name);
  if (fields.length === 0 && modelName && constraint) {
    const prefix = `${modelName}_`;
    if (constraint.startsWith(prefix) && constraint.endsWith("_key")) {
      fields = constraint.slice(prefix.length, -4).split("_");
    }
  }

  const kind: DatabaseErrorKind =
    code === "P2002"
      ? "UNIQUE_CONSTRAINT"
      : code === "P2003"
        ? "FOREIGN_KEY_CONSTRAINT"
        : code === "P2025"
          ? "NOT_FOUND"
          : "KNOWN_DATABASE_ERROR";

  return { kind, code, fields, constraint };
}
