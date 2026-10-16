"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  CONNECTION_MESSAGE,
  connectionSnapshot,
  requestJson,
  subscribeConnection,
} from "@/lib/api-transport";

export default function ConnectionNotice() {
  const unavailable = useSyncExternalStore(
    subscribeConnection,
    connectionSnapshot,
    () => false,
  );
  useEffect(() => {
    if (!unavailable) return;
    const controller = new AbortController();
    let busy = false;
    const check = async () => {
      if (document.hidden || busy) return;
      busy = true;
      try {
        await requestJson("/api/university/session", {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
      } catch {
        /* The shared transport records reachability, including a valid 401. */
      } finally {
        busy = false;
      }
    };
    const timer = setInterval(() => void check(), 15_000);
    window.addEventListener("online", check);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("online", check);
    };
  }, [unavailable]);
  return unavailable ? (
    <aside className="connection-notice" role="status">
      {CONNECTION_MESSAGE}
    </aside>
  ) : null;
}
