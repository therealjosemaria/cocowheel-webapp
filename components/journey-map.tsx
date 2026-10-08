"use client";

import { useEffect } from "react";
import { divIcon } from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
  ZoomControl,
} from "react-leaflet";
import type { Pin } from "@/lib/client-types";

type Line = {
  points: Pin[];
  color: string;
  muted?: boolean;
  weight?: number;
  opacity?: number;
};
type MarkerKind = "departure" | "pickup" | "destination";

const mapMarkerIcons: Record<MarkerKind, ReturnType<typeof divIcon>> = {
  departure: divIcon({
    className: "journey-marker-icon",
    html: '<span class="journey-marker journey-marker-departure" aria-label="Departure"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="2.4" fill="currentColor"/><path d="M12 8.5v6m0-4-4 2.7m4-2.7 4 2.7m-4 1-3 5m3-5 3 5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg></span>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  }),
  pickup: divIcon({
    className: "journey-marker-icon",
    html: '<span class="journey-marker journey-marker-departure" aria-label="Pickup"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="2.4" fill="currentColor"/><path d="M12 8.5v6m0-4-4 2.7m4-2.7 4 2.7m-4 1-3 5m3-5 3 5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg></span>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  }),
  destination: divIcon({
    className: "journey-marker-icon",
    html: '<span class="journey-marker journey-marker-destination" aria-label="Final destination"></span>',
    iconSize: [34, 28],
    iconAnchor: [17, 14],
  }),
};
function MapClick({ onPick }: { onPick?: (pin: Pin) => void }) {
  useMapEvents({
    click(event) {
      onPick?.({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });
  return null;
}
function Fit({ pins, lines }: { pins: Pin[]; lines: Line[] }) {
  const map = useMap();
  const pointKey = [...pins, ...lines.flatMap((line) => line.points)]
    .map((point) => `${point.latitude}:${point.longitude}`)
    .join("|");
  useEffect(() => {
    const points = [...pins, ...lines.flatMap((line) => line.points)];
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 16);
      return;
    }
    map.fitBounds(
      points.map(
        (point) => [point.latitude, point.longitude] as [number, number],
      ),
      { padding: [28, 28], maxZoom: 16 },
    );
  // Coordinates—not freshly allocated prop arrays—are the meaningful fit trigger.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, pointKey]);
  return null;
}
export default function JourneyMap({
  pins = [],
  lines = [],
  onPick,
  markerKinds,
  roadPathAttribution = false,
}: {
  pins?: Pin[];
  lines?: Line[];
  onPick?: (pin: Pin) => void;
  markerKinds?: MarkerKind[];
  roadPathAttribution?: boolean;
}) {
  return (
    <div className="map-shell">
      <MapContainer
        center={[-33.8688, 151.2093]}
        zoom={15}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={false}
        className="journey-map"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {lines.map((line, index) => (
          <Polyline
            key={index}
            positions={line.points.map(
              (point) => [point.latitude, point.longitude] as [number, number],
            )}
            pathOptions={{
              color: line.color,
              weight: line.weight ?? (line.muted ? 3 : 5),
              opacity: line.opacity ?? (line.muted ? 0.25 : 0.85),
              dashArray: line.muted ? "7 9" : undefined,
            }}
          />
        ))}
        {pins.map((pin, index) =>
          markerKinds?.[index] ? (
            <Marker
              key={`${pin.latitude}-${pin.longitude}-${index}`}
              position={[pin.latitude, pin.longitude]}
              icon={mapMarkerIcons[markerKinds[index]]}
            />
          ) : (
            <CircleMarker
              key={`${pin.latitude}-${pin.longitude}-${index}`}
              center={[pin.latitude, pin.longitude]}
              radius={8}
              pathOptions={{
                color: "#073b4c",
                fillColor: "#ff6b35",
                fillOpacity: 1,
                weight: 2,
              }}
            />
          ),
        )}
        <MapClick onPick={onPick} />
        <Fit pins={pins} lines={lines} />
        <ZoomControl position="bottomright" />
      </MapContainer>
      <p className="map-attribution">
        {roadPathAttribution ? <>
          Road path by{" "}
          <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">
            Geoapify
          </a>
          <span aria-hidden="true"> · </span>
        </> : null}
        <a href="https://leafletjs.com/" target="_blank" rel="noreferrer">Leaflet</a>
        <span aria-hidden="true"> · </span>
        ©{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OpenStreetMap contributors
        </a>
      </p>
    </div>
  );
}
