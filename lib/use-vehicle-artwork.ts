"use client";
import { useEffect, useState } from "react";
import { cocowheelsApi } from "./api-client";
import { vehicleArtwork } from "./vehicle-catalogue";
import type { Vehicle } from "./vehicle";
import { subscribeVehicleSaved } from "./vehicle-updates";

/** Only a map explicitly showing this account's driving route uses this hook. */
export function useVehicleArtwork(enabled: boolean) {
  const [artwork, setArtwork] = useState<string>();
  useEffect(() => {
    if (!enabled) return;
    let live = true, generation = 0;
    const refresh = async () => {
      const current = ++generation;
      try {
        const result = await cocowheelsApi<{ vehicle: Vehicle | null }>("/api/vehicle");
        if (live && current === generation) setArtwork(vehicleArtwork(result.vehicle ?? undefined));
      } catch {
        if (live && current === generation) setArtwork(undefined);
      }
    };
    void refresh();
    const unsubscribe = subscribeVehicleSaved(refresh);
    return () => { live = false; unsubscribe(); };
  }, [enabled]);
  return enabled ? artwork : undefined;
}
