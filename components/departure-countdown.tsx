"use client";

import { useEffect, useState } from "react";
import { departureLabel } from "@/lib/departure-label";

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
  return <>{departureLabel(scheduledAt, now).replace(/^Departs in /, "In ")}</>;
}
