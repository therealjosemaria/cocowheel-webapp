"use client";
import type { ComponentProps } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import { MAP_TILE_URL } from "@/lib/map-style";
import MapCredits from "./map-credits";

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
      {children}
    </MapContainer>
    <MapCredits roadPathAttribution={roadPathAttribution} />
  </div>;
}
