// Schedule wording, not evidence that the driver has physically departed.
export function departureTone(scheduledAt: string, now: number): "scheduled" | "soon" | "delayed" | "neutral" {
  const remaining = Date.parse(scheduledAt) - now;
  if (!Number.isFinite(remaining)) return "neutral";
  if (remaining > 600000) return "scheduled";
  if (remaining > -60000) return "soon";
  return "delayed";
}

function departureDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours} hr${remainder ? ` ${remainder} min` : ""}`;
}

export function departureLabel(scheduledAt: string, now: number): string {
  const remaining = Date.parse(scheduledAt) - now;
  if (!Number.isFinite(remaining)) return "";
  if (remaining > 0) return `Departs in ${departureDuration(Math.ceil(remaining / 60000))}`;
  if (remaining > -60000) return "Departing now";
  return `Delayed ${departureDuration(Math.floor(-remaining / 60000))}`;
}

const plannedTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  hour: "numeric", minute: "2-digit", timeZone: "Australia/Sydney",
});

export function plannedDepartureTime(scheduledAt: string): string {
  const time = Date.parse(scheduledAt);
  return Number.isFinite(time) ? plannedTimeFormatter.format(time) : "";
}
