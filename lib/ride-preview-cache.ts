import type { Pin } from "./client-types";

type RiderRouteContext = { pickup: Pin; destination: Pin };
const contextPrefix = "cocowheels:ride-preview:v1:";
const roadPathPrefix = "cocowheels:road-path:v1:";

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
) {
  write(`${contextPrefix}${rideId}`, { pickup, destination } satisfies RiderRouteContext);
}
export function riderPreviewRoute(rideId: string) {
  const context = read<RiderRouteContext>(`${contextPrefix}${rideId}`);
  if (!context || !context.pickup || !context.destination) return null;
  return context;
}
export function cachedRiderRoadPath(pickup: Pin, destination: Pin) {
  return read<Pin[]>(routeKey(pickup, destination));
}
export function cacheRiderRoadPath(pickup: Pin, destination: Pin, points: Pin[]) {
  write(routeKey(pickup, destination), points);
}
