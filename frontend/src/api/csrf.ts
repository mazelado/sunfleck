/** Django's CSRF token, which must accompany every request that changes something. */
export function getCsrfToken(): string {
  const match = /(?:^|;\s*)csrftoken=([^;]+)/.exec(document.cookie);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function needsCsrfToken(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}
