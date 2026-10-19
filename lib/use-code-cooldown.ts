"use client";

import { useCallback, useEffect, useState } from "react";

const storageKey = (account: string) =>
  `cocowheels:code-cooldown:v1:${account}`;
export const secondsRemaining = (until: number, now: number) =>
  Math.max(0, Math.ceil((until - now) / 1000));

/** UX only. The API independently enforces all limits on every attempt. */
export function useCodeCooldown(account: string) {
  const key = account.trim().toLowerCase();
  const [deadlines, setDeadlines] = useState<Record<string, number>>({});
  const [now, setNow] = useState(0);
  const until = deadlines[key] ?? 0;
  useEffect(() => {
    const restore = () => {
      setNow(Date.now());
      try {
        const stored = Number(localStorage.getItem(storageKey(key)));
        if (Number.isFinite(stored) && stored > Date.now())
          setDeadlines((previous) => ({
            ...previous,
            [key]: Math.max(previous[key] ?? 0, stored),
          }));
      } catch {
        /* In-memory countdown remains available. */
      }
    };
    const initial = setTimeout(restore, 0);
    const storage = (event: StorageEvent) => {
      if (event.key === storageKey(key)) restore();
    };
    window.addEventListener("storage", storage);
    document.addEventListener("visibilitychange", restore);
    return () => {
      clearTimeout(initial);
      window.removeEventListener("storage", storage);
      document.removeEventListener("visibilitychange", restore);
    };
  }, [key]);
  useEffect(() => {
    if (until <= Date.now()) return;
    const timer = setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= until) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [until]);
  const start = useCallback(
    (seconds: number) => {
      if (!Number.isFinite(seconds) || seconds <= 0) return;
      const time = Date.now();
      const deadline = time + Math.ceil(seconds) * 1000;
      setNow(time);
      setDeadlines((previous) => ({ ...previous, [key]: deadline }));
      try {
        localStorage.setItem(storageKey(key), String(deadline));
      } catch {
        /* Memory fallback. */
      }
    },
    [key],
  );
  return { remaining: secondsRemaining(until, now), start };
}
