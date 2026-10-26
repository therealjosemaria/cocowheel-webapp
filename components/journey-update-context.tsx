"use client";
import { createContext, useContext, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { JourneyUpdate } from "@/lib/journey-updates";

const Updates = createContext<JourneyUpdate[]>([]);
const Publish = createContext<Dispatch<SetStateAction<JourneyUpdate[]>>>(() => {});
export function JourneyUpdateProvider({ children }: { children: React.ReactNode }) {
  const [updates, setUpdates] = useState<JourneyUpdate[]>([]);
  return <Publish.Provider value={setUpdates}><Updates.Provider value={updates}>{children}</Updates.Provider></Publish.Provider>;
}
export const usePublishJourneyUpdates = () => useContext(Publish);
export function useJourneyUpdate(id: string) {
  return useContext(Updates).find(update => update.id === id);
}

// Highlight only after explicit aggregate navigation, when each card is visible.
// This is not acknowledgement: review happens in the detail content instead.
export function JourneyUpdateMarker({ id }: { id: string }) {
  const update = useJourneyUpdate(id);
  const hasUpdate = Boolean(update);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!hasUpdate) return;
    const card = ref.current?.closest(".activity-card");
    if (!card) return;
    let highlighted = false;
    const observer = new IntersectionObserver(entries => {
      if (highlighted || location.hash !== "#updates" || !entries.some(entry => entry.isIntersecting)) return;
      card.classList.remove("request-arrived");
      void (card as HTMLElement).offsetWidth;
      card.classList.add("request-arrived");
      highlighted = true;
    });
    const observe = () => { highlighted = false; observer.disconnect(); observer.observe(card); };
    observe();
    window.addEventListener("hashchange", observe);
    return () => { observer.disconnect(); window.removeEventListener("hashchange", observe); };
  }, [id, hasUpdate]);
  return update ? <span ref={ref} className="active-ride-update journey-update-marker">Update</span> : null;
}
