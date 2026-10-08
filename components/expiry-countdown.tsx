"use client";

import { useEffect, useState } from "react";

function formattedDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1_000));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  const paddedSeconds = remainder.toString().padStart(2, "0");
  return hours
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${paddedSeconds}`
    : `${minutes}:${paddedSeconds}`;
}

export default function ExpiryCountdown({
  expiresAt,
  serverNow,
}: {
  expiresAt: string;
  serverNow: string;
}) {
  const [clientReceivedAt] = useState(() => Date.now());
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const serverClock = new Date(serverNow).getTime() + (tick - clientReceivedAt);
  const remaining = new Date(expiresAt).getTime() - serverClock;
  const expired = remaining <= 0;

  return (
    <time
      dateTime={expiresAt}
      title={new Date(expiresAt).toLocaleString("en-AU")}
      aria-label={expired ? "Expired" : `Expires in ${formattedDuration(remaining)}`}
    >
      {expired ? "Expired" : formattedDuration(remaining)}
    </time>
  );
}
