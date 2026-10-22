import type { Pin } from "./client-types";

export type DurationLookup = (
  origin: Pin,
  destination: Pin,
) => Promise<number | null>;

// Compare the same fixed origin and routing model, never scheduled departure wait.
export async function extraDrivingSeconds(
  origin: Pin,
  destination: Pin,
  pickup: Pin,
  dropoff: Pin,
  duration: DurationLookup,
): Promise<number> {
  const values = await Promise.all([
    duration(origin, destination),
    duration(origin, pickup),
    duration(pickup, dropoff),
    duration(dropoff, destination),
  ]);
  if (
    values.some(
      (value) => value === null || !Number.isFinite(value) || value < 0,
    )
  ) {
    throw new Error("EXTRA_DRIVING_UNAVAILABLE");
  }
  const [baseline, first, second, third] = values as number[];
  return Math.max(0, first + second + third - baseline);
}

export function extraDrivingLabel(seconds: number): string {
  if (seconds < 60) return "Less than 1 min";
  const minutes = Math.ceil(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `About ${hours ? `${hours} hr${remainder ? ` ${remainder} min` : ""}` : `${minutes} min`}`;
}

// Memory-only, bounded, short-lived and shared across comparisons in this tab.
export function cachedDurationLookup(
  fetchDuration: DurationLookup,
  now = Date.now,
): DurationLookup {
  const cache = new Map<
    string,
    { expires: number; value: Promise<number | null> }
  >();
  return (origin, destination) => {
    const key = `${origin.latitude},${origin.longitude}|${destination.latitude},${destination.longitude}`;
    if (
      origin.latitude === destination.latitude &&
      origin.longitude === destination.longitude
    )
      return Promise.resolve(0);
    const existing = cache.get(key);
    if (existing && existing.expires > now()) return existing.value;
    const value = fetchDuration(origin, destination)
      .then((result) => {
        if (result === null || !Number.isFinite(result) || result < 0)
          throw new Error("EXTRA_DRIVING_UNAVAILABLE");
        return result;
      })
      .catch((error) => {
        if (cache.get(key)?.value === value) cache.delete(key);
        throw error;
      });
    cache.set(key, { expires: now() + 300_000, value });
    while (cache.size > 100) cache.delete(cache.keys().next().value!);
    return value;
  };
}
