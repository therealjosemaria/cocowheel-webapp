import type { Location, Pin } from "./client-types";
import { distanceMeters } from "./location-tracking";

export const JOURNEY_FIX_MAX_AGE_MS = 30_000;
export function reliableFix(
  location: Location | undefined,
  now: number,
): location is Location {
  if (!location) return false;
  const age = now - Date.parse(location.capturedAt);
  return (
    Number.isFinite(age) &&
    age >= -5_000 &&
    age <= JOURNEY_FIX_MAX_AGE_MS &&
    Number.isFinite(location.accuracyMeters) &&
    location.accuracyMeters >= 0 &&
    location.accuracyMeters <= 100
  );
}
export function atDropoff(
  location: Location | undefined,
  destination: Pin,
  now: number,
) {
  return (
    reliableFix(location, now) &&
    distanceMeters(location, { ...destination, accuracyMeters: 0 }) +
      location.accuracyMeters <=
      150
  );
}
export function journeyEvidence(
  driver: Location | undefined,
  rider: Location | undefined,
  now: number,
) {
  const d = reliableFix(driver, now) ? driver : undefined;
  const r = reliableFix(rider, now) ? rider : undefined;
  const agreement =
    d && r
      ? distanceMeters(d, r) <=
        Math.max(100, d.accuracyMeters + r.accuracyMeters)
        ? "ALIGNED"
        : "DIVERGED"
      : "SINGLE_DEVICE";
  const candidates = [
    ["DRIVER", d || (!r ? driver : undefined)],
    ["RIDER", r || (!d ? rider : undefined)],
  ] as const;
  const source = [...candidates]
    .filter(([, fix]) => fix)
    .sort(
      (a, b) => Date.parse(b[1]!.capturedAt) - Date.parse(a[1]!.capturedAt),
    )[0];
  return {
    source: source?.[0],
    location: source?.[1],
    agreement: !d && !r ? "STALE" : agreement,
  };
}
// Both devices keep their own schedule; a missing peer never blocks a capture.
export function nextCaptureAt(
  now: number,
  acceptedAt: number,
  role: "DRIVER" | "RIDER",
  peerFresh: boolean,
) {
  const cycle = peerFresh ? 20_000 : 10_000;
  const offset = role === "DRIVER" && peerFresh ? 10_000 : 0;
  const phase = (((now - acceptedAt - offset) % cycle) + cycle) % cycle;
  return now + (phase === 0 ? cycle : cycle - phase);
}
