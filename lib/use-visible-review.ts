"use client";
import { useEffect, type RefObject } from "react";

/** Same review threshold as journey updates: visible, expanded, 60% for 700ms. */
export function useVisibleReview(ref: RefObject<HTMLElement | null>, key: string | null, review: (key: string) => void) {
  useEffect(() => {
    const element = ref.current;
    if (!element || !key) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => { clearTimeout(timer); timer = undefined; };
    const observer = new IntersectionObserver(entries => {
      clear();
      if (entries[0]?.intersectionRatio >= 0.6 && document.visibilityState === "visible" && !element.closest("details:not([open])"))
        timer = setTimeout(() => {
          if (element.isConnected && document.visibilityState === "visible" && !element.closest("details:not([open])")) review(key);
        }, 700);
    }, { threshold: 0.6 });
    const scan = () => { clear(); observer.unobserve(element); observer.observe(element); };
    observer.observe(element);
    document.addEventListener("visibilitychange", scan);
    document.addEventListener("toggle", scan, true);
    return () => { clear(); observer.disconnect(); document.removeEventListener("visibilitychange", scan); document.removeEventListener("toggle", scan, true); };
  }, [ref, key, review]);
}
