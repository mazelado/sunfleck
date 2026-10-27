/** Where to go after signing in: the page the person wanted, but only within this app. */
export function safeNextPath(next: string | null): string {
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/";
}
