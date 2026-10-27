/** All time zones the browser knows, e.g. "Europe/Amsterdam", plus UTC. */
export function timezoneOptions(): string[] {
  const zones = Intl.supportedValuesOf("timeZone");
  return zones.includes("UTC") ? zones : ["UTC", ...zones];
}

/** The time zone this device is set to. */
export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
