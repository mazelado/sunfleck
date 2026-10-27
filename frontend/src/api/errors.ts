/**
 * Errors from the Sunfleck API and from django-allauth, in one shape the screens can show.
 *
 * Sunfleck:  { "error": { "code": "...", "message": "...", "details": { ... } } }
 * allauth:   { "status": 400, "errors": [{ "code": "...", "message": "...", "param": "..." }] }
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Messages for individual form fields, keyed by field name. */
  readonly fieldErrors: Record<string, string[]>;

  constructor(status: number, code: string, message: string, fieldErrors = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

interface SunfleckErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

interface AllauthErrorBody {
  errors: { code: string; message: string; param?: string }[];
}

function isSunfleckError(body: unknown): body is SunfleckErrorBody {
  return typeof body === "object" && body !== null && "error" in body;
}

function isAllauthError(body: unknown): body is AllauthErrorBody {
  return typeof body === "object" && body !== null && "errors" in body;
}

export function toApiError(status: number, body: unknown): ApiError {
  if (isSunfleckError(body)) {
    const { code, message, details } = body.error;
    const fieldErrors: Record<string, string[]> = {};
    if (Array.isArray(details?.password)) {
      fieldErrors.password = details.password as string[];
    }
    if (typeof details?.field === "string") {
      fieldErrors[details.field] = [message];
    }
    return new ApiError(status, code, message, fieldErrors);
  }
  if (isAllauthError(body) && body.errors.length > 0) {
    const fieldErrors: Record<string, string[]> = {};
    for (const error of body.errors) {
      if (error.param) {
        (fieldErrors[error.param] ??= []).push(error.message);
      }
    }
    const first = body.errors[0];
    return new ApiError(status, first?.code ?? "error", first?.message ?? "", fieldErrors);
  }
  if (status === 429) {
    return new ApiError(status, "too_many_requests", "Too many attempts.");
  }
  return new ApiError(status, "unexpected", `Unexpected response (${String(status)}).`);
}
