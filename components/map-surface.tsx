"use client";
import { useEffect, type ComponentProps } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { MAP_TILE_URL } from "@/lib/map-style";
import MapCredits from "./map-credits";
import { journeyRoleArtClass } from "@/lib/journey-role-art";
import { forgetMapImageIcon } from "@/lib/map-role-icon";

function AvatarImageFallback() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const fallback = (event: Event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || !image.classList.contains("map-avatar-artwork")) return;
      forgetMapImageIcon(image.getAttribute("src"));
      const replacement = document.createElement("i");
      replacement.className = journeyRoleArtClass("rider");
      replacement.setAttribute("aria-hidden", "true");
      image.replaceWith(replacement);
    };
    container.addEventListener("error", fallback, true);
    return () => container.removeEventListener("error", fallback, true);
  }, [map]);
  return null;
}

/** One tile/credit base; each view owns its geometry and interaction settings. */
export default function MapSurface({
  children,
  frameClassName = "map-shell",
  roadPathAttribution = false,
  ...props
}: ComponentProps<typeof MapContainer> & {
  frameClassName?: string;
  roadPathAttribution?: boolean;
}) {
  return <div className={frameClassName}>
    <MapContainer {...props} attributionControl={false}>
      <TileLayer url={MAP_TILE_URL} />
      <AvatarImageFallback />
      {children}
    </MapContainer>
    <MapCredits roadPathAttribution={roadPathAttribution} />
  </div>;
}
