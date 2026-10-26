import type { Pin } from "./client-types";

const australianState = /(?:New South Wales|Queensland|Victoria|Tasmania|South Australia|Western Australia|Northern Territory|Australian Capital Territory|NSW|QLD|VIC|TAS|SA|WA|NT|ACT)/i;
const stateSuffix = new RegExp(`(?:^${australianState.source}(?:\\s+\\d{4})?|\\s${australianState.source}\\s+\\d{4}|\\s(?:NSW|QLD|VIC|TAS|SA|WA|NT|ACT)(?:\\s+\\d{4})?)$`, "i");

/** Display only: never replace a selected pin's original label or coordinates. */
export function compactAddressLabel(pin: Pin): string {
  const full = pin.label?.trim();
  if (!full) return `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`;
  const parts = full.split(",").map((part) => part.trim()).filter(Boolean);
  const isAustralian = pin.countryCode?.toLowerCase() === "au" ||
    /^Australia$/i.test(parts.at(-1) ?? "") || stateSuffix.test(parts.at(-1) ?? "");
  if (!isAustralian) return full;
  if (/^Australia$/i.test(parts.at(-1) ?? "")) parts.pop();
  // Strip only recognised trailing administrative details, never arbitrary
  // comma-separated parts (which can include unit or multiple street numbers).
  while (parts.length > 1) {
    const last = parts.at(-1)!;
    const shortened = last.replace(stateSuffix, "").replace(/(?:^|\s)\d{4}$/, "").trim();
    if (shortened === last) break;
    if (shortened) { parts[parts.length - 1] = shortened; break; }
    parts.pop();
  }
  return parts.join(", ") || full;
}
