import type { ApplicationResult } from "./application/errors";

const statusByCode = {
  VALIDATION_ERROR: 400,
  CONFLICT: 409,
  STALE_WRITE: 409,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  EXTERNAL_PROVIDER_FAILURE: 502,
  PLANNER_INFEASIBLE: 422,
  INTERNAL_ERROR: 500,
} as const;

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export function respond<T>(result: ApplicationResult<T>): Response {
  if (result.ok) return Response.json({ data: result.value }, { headers });
  return Response.json(
    { error: result.error },
    { status: statusByCode[result.error.code], headers },
  );
}

function invalid(message: string, status = 400): Response {
  return Response.json({ error: { code: "VALIDATION_ERROR", message } }, { status, headers });
}

/** Transport-only JSON and same-origin checks; all domain input is validated by the service. */
export async function bodyOf(request: Request): Promise<unknown | Response> {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Same-origin request required." } },
      { status: 403, headers },
    );
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return invalid("Expected JSON content type.", 415);
  const size = request.headers.get("content-length");
  if (size && Number(size) > 65_536) return invalid("Request body exceeds 64 KiB.", 413);
  try {
    const text = await request.text();
    if (text.length > 65_536) return invalid("Request body exceeds 64 KiB.", 413);
    return JSON.parse(text) as unknown;
  } catch {
    return invalid("Malformed JSON request.");
  }
}

export async function mutate<T>(
  request: Request,
  operation: (input: unknown) => Promise<ApplicationResult<T>>,
): Promise<Response> {
  const body = await bodyOf(request);
  return body instanceof Response ? body : respond(await operation(body));
}

export async function mutateById<T>(
  request: Request,
  id: string,
  operation: (input: unknown) => Promise<ApplicationResult<T>>,
): Promise<Response> {
  const body = await bodyOf(request);
  if (body instanceof Response) return body;
  // The route param is authoritative for routing; a second body ID is rejected.
  if (!body || typeof body !== "object" || Array.isArray(body) || "id" in body)
    return invalid("Expected an object without a body ID.");
  return respond(await operation({ ...body, id }));
}
