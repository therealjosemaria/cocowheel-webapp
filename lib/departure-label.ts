// Schedule wording, not evidence that the driver has physically departed.
export function departureTone(scheduledAt: string, now: number): "scheduled" | "soon" | "delayed" | "neutral" {
  const remaining = Date.parse(scheduledAt) - now;
  if (!Number.isFinite(remaining)) return "neutral";
  if (remaining > 600000) return "scheduled";
  if (remaining > -60000) return "soon";
  return "delayed";
}

export function departureLabel(scheduledAt: string, now: number): string {
  const remaining = Date.parse(scheduledAt) - now;
  if (!Number.isFinite(remaining)) return "";
  if (remaining > 0) return `Departs in ${Math.ceil(remaining / 60000)} min`;
  if (remaining > -60000) return "Departing now";
  return "Delayed";
}
