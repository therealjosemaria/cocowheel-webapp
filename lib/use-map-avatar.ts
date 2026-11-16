"use client";
import { useEffect, useState } from "react";
import { cocowheelsApi } from "./api-client";
import { isMapAvatarPath, type MapAvatar } from "./map-avatar";
import { subscribeVehicleSaved } from "./vehicle-updates";

/** Use only for a map explicitly showing the signed-in person's own rider route. */
export function useOwnMapAvatar(enabled: boolean) {
  const [artwork, setArtwork] = useState<string>();
  useEffect(() => {
    if (!enabled) return;
    let live = true, generation = 0;
    const refresh = async () => {
      const current = ++generation;
      try {
        const result = await cocowheelsApi<MapAvatar>("/api/avatar");
        if (live && current === generation)
          setArtwork(result.enabled && isMapAvatarPath(result.artworkUrl) ? result.artworkUrl : undefined);
      } catch { if (live && current === generation) setArtwork(undefined); }
    };
    void refresh();
    const unsubscribe = subscribeVehicleSaved(refresh);
    return () => { live = false; unsubscribe(); };
  }, [enabled]);
  return enabled ? artwork : undefined;
}
