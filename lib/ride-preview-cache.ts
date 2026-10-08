import type { Pin } from "./client-types";

type DirectionFit = "GOOD" | "POOR";
type RiderRouteContext = {
  pickup: Pin;
  destination: Pin;
  directionFit?: DirectionFit;
};
type RiderSearchDraft = RiderRouteContext & { departureAt: string | null };
const contextPrefix = "cocowheels:ride-preview:v1:";
const roadPathPrefix = "cocowheels:road-path:v1:";
const searchDraftKey = "cocowheels:find-ride-draft:v1";
const searchReturnKey = "cocowheels:find-ride-return:v1";

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(key) ?? "null");
    return value as T | null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Preview still works if browser storage is unavailable.
  }
}
const routeKey = (pickup: Pin, destination: Pin) =>
  `${roadPathPrefix}${pickup.latitude.toFixed(5)}:${pickup.longitude.toFixed(5)}|${destination.latitude.toFixed(5)}:${destination.longitude.toFixed(5)}`;

export function saveRiderPreviewRoute(
  rideId: string,
  pickup: Pin,
  destination: Pin,
  directionFit: DirectionFit,
) {
  write(
    `${contextPrefix}${rideId}`,
    { pickup, destination, directionFit } satisfies RiderRouteContext,
  );
}
export function saveRiderSearchDraft(
  pickup: Pin,
  destination: Pin,
  departureAt: string | null,
) {
  write(
    searchDraftKey,
    { pickup, destination, departureAt } satisfies RiderSearchDraft,
  );
}
export function riderSearchDraft(): RiderSearchDraft | null {
  const draft = read<RiderSearchDraft>(searchDraftKey);
  if (
    !draft ||
    !draft.pickup ||
    !draft.destination ||
    typeof draft.pickup.latitude !== "number" ||
    typeof draft.pickup.longitude !== "number" ||
    typeof draft.destination.latitude !== "number" ||
    typeof draft.destination.longitude !== "number" ||
    (draft.departureAt !== null && typeof draft.departureAt !== "string")
  )
    return null;
  return draft;
}
export function markRiderSearchReturn() {
  write(searchReturnKey, true);
}
export function consumeRiderSearchReturn() {
  if (typeof window === "undefined") return false;
  try {
    const marked = window.sessionStorage.getItem(searchReturnKey) === "true";
    window.sessionStorage.removeItem(searchReturnKey);
    return marked;
  } catch {
    return false;
  }
}
export function riderPreviewRoute(rideId: string) {
  const context = read<RiderRouteContext>(`${contextPrefix}${rideId}`);
  if (!context || !context.pickup || !context.destination) return null;
  return {
    ...context,
    directionFit:
      context.directionFit === "GOOD" || context.directionFit === "POOR"
        ? context.directionFit
        : undefined,
  };
}
export function cachedRoadPath(origin: Pin, destination: Pin) {
  return read<Pin[]>(routeKey(origin, destination));
}
export function cacheRoadPath(origin: Pin, destination: Pin, points: Pin[]) {
  write(routeKey(origin, destination), points);
}
export function cachedRiderRoadPath(pickup: Pin, destination: Pin) {
  return cachedRoadPath(pickup, destination);
}
export function cacheRiderRoadPath(pickup: Pin, destination: Pin, points: Pin[]) {
  cacheRoadPath(pickup, destination, points);
}
