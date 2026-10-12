"use client";

import { useState } from "react";

export default function RideStatusText({ label }: { label: string }) {
  const [paused, setPaused] = useState(false);
  const tone =
    label === "Request pending"
      ? "pending"
      : label === "Awaiting pickup"
        ? "pickup"
        : ["Published", "Ride in progress"].includes(label)
          ? "live"
          : null;
  if (!tone) return <span>{label}</span>;
  return (
    <button
      type="button"
      className={`ride-status-text status-${tone}${paused ? " paused" : ""}`}
      title={`${paused ? "Resume" : "Pause"} status animation`}
      aria-label={`${label}. ${paused ? "Resume" : "Pause"} status animation`}
      onClick={() => setPaused((current) => !current)}
    >
      {label}
    </button>
  );
}
