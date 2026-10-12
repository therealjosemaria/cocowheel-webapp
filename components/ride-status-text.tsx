"use client";

import { useState } from "react";

export default function RideStatusText({ label }: { label: string }) {
  const [paused, setPaused] = useState(false);
  const ongoing = [
    "Request pending",
    "Awaiting pickup",
    "Published",
    "Ride in progress",
  ].includes(label);
  if (!ongoing) return <span className="ride-status-finished">{label}</span>;
  return (
    <button
      type="button"
      className={`ride-status-text${paused ? " paused" : ""}`}
      title={`${paused ? "Resume" : "Pause"} status animation`}
      aria-label={`${label}. ${paused ? "Resume" : "Pause"} status animation`}
      onClick={() => setPaused((current) => !current)}
    >
      {label}
    </button>
  );
}
