import type { Pin } from "./client-types";

export function directionsUrl(destination: Pin, mode: "drive" | "bicycle" = "drive"): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${destination.latitude},${destination.longitude}`,
    travelmode: mode === "bicycle" ? "bicycling" : "driving",
  });
  return `https://www.google.com/maps/dir/?${params}`;
}
