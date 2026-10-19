/** Compact button suffix; round up so the wait is never understated. */
export function codeCooldownLabel(seconds: number) {
  return seconds >= 60
    ? `${Math.ceil(seconds / 60)} min`
    : `${Math.ceil(seconds)}s`;
}

/** Remaining time for the server limit that rejected this attempt; no guessed TTL. */
export function verificationWaitMessage(seconds?: number) {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0)
    return "Please wait a little before trying again.";
  const value = seconds < 60 ? Math.ceil(seconds) : Math.ceil(seconds / 60);
  const unit = seconds < 60 ? "second" : "minute";
  return `Please try again in ${value} ${unit}${value === 1 ? "" : "s"}.`;
}
