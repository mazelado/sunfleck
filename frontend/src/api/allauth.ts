import { getCsrfToken, needsCsrfToken } from "./csrf";
import { toApiError } from "./errors";

/**
 * Calls to django-allauth's headless API, which handles signing in and out and password
 * resets. See https://docs.allauth.org/en/latest/headless/openapi-specification/
 */
const BASE = "/_allauth/browser/v1";

async function request(
  method: string,
  path: string,
  body?: unknown,
  okStatuses = [200],
): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (needsCsrfToken(method)) {
    headers["X-CSRFToken"] = getCsrfToken();
  }
  const response = await globalThis.fetch(`${window.location.origin}${BASE}${path}`, {
    method,
    headers,
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!okStatuses.includes(response.status)) {
    const data: unknown = await response.json().catch(() => null);
    throw toApiError(response.status, data);
  }
}

export function signIn(email: string, password: string): Promise<void> {
  return request("POST", "/auth/login", { email, password });
}

export function signOut(): Promise<void> {
  // allauth answers 401 ("not signed in") once the session has ended.
  return request("DELETE", "/auth/session", undefined, [200, 401]);
}

export function requestPasswordReset(email: string): Promise<void> {
  return request("POST", "/auth/password/request", { email });
}

export function resetPassword(key: string, password: string): Promise<void> {
  return request("POST", "/auth/password/reset", { key, password });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return request("POST", "/account/password/change", {
    current_password: currentPassword,
    new_password: newPassword,
  });
}
