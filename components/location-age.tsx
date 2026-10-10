"use client";

import { useEffect, useState } from "react";
import type { Location } from "@/lib/client-types";

export default function LocationAge({ location }: { location?: Location }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  if (!location)
    return (
      <small className="driver-location-age">Driver · Published location</small>
    );
  const seconds = Math.max(
    0,
    Math.floor(
      ((now ?? Date.parse(location.capturedAt)) -
        Date.parse(location.capturedAt)) /
        1000,
    ),
  );
  const age =
    seconds < 60
      ? `${seconds}s`
      : seconds < 3600
        ? `${Math.floor(seconds / 60)}m`
        : `${Math.floor(seconds / 3600)}h`;
  const stale = seconds > (location.moving ? 30 : 60);
  return (
    <small
      className="driver-location-age"
      title={new Date(location.capturedAt).toLocaleString()}
    >
      Driver · {stale ? "Last updated" : "Updated"} {age} ago
    </small>
  );
}
