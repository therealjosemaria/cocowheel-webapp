// Schedule wording, not evidence that the driver has physically departed.
export function departureLabel(scheduledAt: string, now: number): string {
  const remaining = Date.parse(scheduledAt) - now;
  if (!Number.isFinite(remaining)) return "";
  if (remaining > 0) return `Departs in ${Math.ceil(remaining / 60000)} min`;
  if (remaining > -60000) return "Departing now";
  return "Delayed";
}
