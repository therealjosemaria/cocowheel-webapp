"use client";

import { useEffect, useState } from "react";
import { departureLabel, departureTone, plannedDepartureDateTime } from "@/lib/departure-label";

export default function DepartureCountdown({
  scheduledAt,
}: {
  scheduledAt: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) setNow(Date.now());
    };
    const timer = window.setInterval(refresh, 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const plannedTime = plannedDepartureDateTime(scheduledAt);
  if (!plannedTime) return null;
  return <span className="driver-departure-timing">
    <time dateTime={scheduledAt}>{plannedTime}</time>
    <span className={`driver-departure-status departure-tone-${departureTone(scheduledAt, now)}`}>
      {departureLabel(scheduledAt, now).replace(/^Departs in /, "In ")}
    </span>
  </span>;
}
