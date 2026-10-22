"use client";

import { useEffect, useState } from "react";
import { cocowheelsApi } from "@/lib/api-client";
import type { Pin } from "@/lib/client-types";
import {
  cachedDurationLookup,
  extraDrivingLabel,
  extraDrivingSeconds,
} from "@/lib/extra-driving";

const duration = cachedDurationLookup(async (origin, destination) => {
  const result = await cocowheelsApi<{ durationSeconds: number | null }>(
    "/api/route-preview",
    {
      method: "POST",
      body: JSON.stringify({ origin, destination }),
    },
  );
  return result.durationSeconds;
});

export default function ExtraDriving({
  origin,
  destination,
  pickup,
  dropoff,
  expanded,
}: {
  origin: Pin;
  destination: Pin;
  pickup: Pin;
  dropoff: Pin;
  expanded: boolean;
}) {
  const coordinates = JSON.stringify(
    [origin, destination, pickup, dropoff].map((pin) => [
      pin.latitude,
      pin.longitude,
    ]),
  );
  const [result, setResult] = useState<{ key: string; label: string } | null>(
    null,
  );
  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    const pins = (JSON.parse(coordinates) as number[][]).map(
      ([latitude, longitude]) => ({ latitude, longitude }),
    );
    void extraDrivingSeconds(pins[0], pins[1], pins[2], pins[3], duration)
      .then((seconds) => {
        if (!cancelled)
          setResult({ key: coordinates, label: extraDrivingLabel(seconds) });
      })
      .catch(() => {
        if (!cancelled)
          setResult({
            key: coordinates,
            label: "Estimate unavailable",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [coordinates, expanded]);
  if (!expanded && result?.key !== coordinates) return null;
  return (
    <span
      className="extra-driving-estimate"
      role="status"
      title="Estimated extra driving from your offered origin, including pickup and drop-off. Excludes waiting and live traffic."
    >
      {result?.key === coordinates ? result.label : "Estimating…"}
    </span>
  );
}
