import type { Pin } from "./client-types";

export function directionsUrl(destination: Pin): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${destination.latitude},${destination.longitude}`,
    travelmode: "driving",
  });
  return `https://www.google.com/maps/dir/?${params}`;
}
