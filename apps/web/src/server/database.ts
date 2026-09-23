import { getDatabase } from "@university-planner/database";

/** The Milestone-2 application composition root; routes consume services, not repositories. */
export function applicationDatabase() {
  if (typeof window !== "undefined") throw new Error("Server-only application boundary");
  return getDatabase();
}
