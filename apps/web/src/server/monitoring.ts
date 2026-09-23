/** Deliberately captures only a fixed signal, never exception messages, request data or user facts. */
let initializing: Promise<void> | undefined;

export async function reportInternalFailure(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || process.env.NODE_ENV === "test") return;
  try {
    initializing ??= (async () => {
      const sentry = await import("@sentry/node");
      sentry.init({
        dsn,
        defaultIntegrations: false,
        tracesSampleRate: 0,
        sendDefaultPii: false,
        beforeSend(event) {
          return {
            ...event,
            message: "Internal application failure",
            level: "error",
            request: undefined,
            user: undefined,
            contexts: undefined,
            extra: undefined,
            breadcrumbs: undefined,
            exception: undefined,
          };
        },
      });
    })();
    await initializing;
    const sentry = await import("@sentry/node");
    sentry.captureMessage("Internal application failure", "error");
  } catch {
    // Monitoring cannot turn a handled application failure into another user-facing failure.
    initializing = undefined;
  }
}
