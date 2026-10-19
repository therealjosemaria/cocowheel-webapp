"use client";

import { useEffect, useRef, useState } from "react";
import type { RideUpdate } from "@/lib/ride-updates";

// No personal/location/payment data is persisted: only opaque event keys.
export function readSeen(account: string): string[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(`cocowheels:seen-updates:v1:${account}`) ?? "[]",
    );
    return Array.isArray(value)
      ? value.filter((x): x is string => typeof x === "string").slice(-500)
      : [];
  } catch {
    return [];
  }
}

export default function RideUpdateNotice({
  updates,
  onSeen,
}: {
  updates: RideUpdate[];
  onSeen: (key: string) => void;
}) {
  const [target, setTarget] = useState<RideUpdate | null>(null);
  const followedHash = useRef("");
  useEffect(() => {
    const timers = new Map<Element, ReturnType<typeof setTimeout>>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const update = updates.find((u) => u.target === entry.target.id);
          if (!update) continue;
          if (
            entry.intersectionRatio >= 0.6 &&
            document.visibilityState === "visible"
          ) {
            if (timers.has(entry.target)) continue;
            timers.set(
              entry.target,
              setTimeout(() => {
                timers.delete(entry.target);
                if (document.visibilityState !== "visible") return;
                if (update.driver) {
                  const card = entry.target.closest(".driver-request-card");
                  if (card) {
                    card.classList.remove("request-arrived");
                    void (card as HTMLElement).offsetWidth;
                    card.classList.add("request-arrived");
                  }
                }
                onSeen(update.key);
              }, 700),
            );
          } else {
            clearTimeout(timers.get(entry.target));
            timers.delete(entry.target);
          }
        }
      },
      { threshold: 0.6 },
    );
    const observed = new Set<Element>();
    const scan = () => {
      let first: RideUpdate | null = null;
      for (const update of updates) {
        const element = document.getElementById(update.target);
        if (!element) continue;
        if (!observed.has(element)) {
          observer.observe(element);
          observed.add(element);
        }
        if (
          followedHash.current !== location.hash &&
          location.hash === `#${update.target}`
        ) {
          followedHash.current = location.hash;
          element.scrollIntoView({ block: "center", behavior: "instant" });
        }
        const box = element.getBoundingClientRect();
        if (
          update.driver &&
          !first &&
          (box.top < 0 || box.bottom > innerHeight)
        )
          first = update;
      }
      setTarget(first);
    };
    const mutation = new MutationObserver(scan);
    mutation.observe(document.body, { childList: true, subtree: true });
    const visibility = () => {
      timers.forEach(clearTimeout);
      timers.clear();
      observer.disconnect();
      observed.clear();
      scan();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("scroll", scan, { passive: true });
    window.addEventListener("resize", scan);
    scan();
    return () => {
      observer.disconnect();
      mutation.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("scroll", scan);
      window.removeEventListener("resize", scan);
      timers.forEach(clearTimeout);
      // Animation finishes naturally even after acknowledgement removes the notice.
    };
  }, [updates, onSeen]);
  if (!target || !updates.some((u) => u.key === target.key)) return null;
  return (
    <div className="ride-update-notice" role="status">
      <button
        type="button"
        className="secondary"
        onClick={() => {
          const element = document.getElementById(target.target);
          if (element) {
            element.tabIndex = -1;
            element.focus({ preventScroll: true });
          }
          element?.scrollIntoView({
            behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "instant"
              : "smooth",
            block: "center",
          });
        }}
      >
        New rider request <span aria-hidden="true">↓</span>
      </button>
    </div>
  );
}
