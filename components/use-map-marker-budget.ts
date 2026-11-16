"use client";

import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";
import { mapFrameBudgetExceeded, mapImageDetail } from "@/lib/map-marker-budget";

/** Update after interaction, not on every movement frame. Bound slowdown for this mount. */
export function useMapMarkerBudget() {
  const map = useMap();
  const [view, setView] = useState(() => ({ zoom: map.getZoom(), width: 0, height: 0, revision: 0, reduced: false }));
  useEffect(() => {
    let frame = 0, last = 0, slow = 0, reduced = false;
    const update = () => setView(current => ({ zoom: map.getZoom(), width: map.getSize().x, height: map.getSize().y, revision: current.revision + 1, reduced }));
    const measure = (time: number) => {
      const budget = mapFrameBudgetExceeded(last, time, slow);
      slow = budget.slow; last = time;
      if (budget.exceeded) {
        reduced = true;
        // Apply after movement ends, so we do not churn marker DOM mid-gesture.
        frame = 0;
      } else frame = requestAnimationFrame(measure);
    };
    const start = () => {
      if (frame || reduced || document.hidden) return;
      last = 0; slow = 0; frame = requestAnimationFrame(measure);
    };
    const end = () => { cancelAnimationFrame(frame); frame = 0; update(); };
    const initial = requestAnimationFrame(update);
    map.on("movestart zoomstart", start);
    map.on("moveend zoomend resize", end);
    return () => {
      cancelAnimationFrame(initial); cancelAnimationFrame(frame);
      map.off("movestart zoomstart", start); map.off("moveend zoomend resize", end);
    };
  }, [map]);
  return { ...view, detail: mapImageDetail(view.zoom, view.reduced) };
}
