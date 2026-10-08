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
type MarkerKind =
  | "driver"
  | "driverPickup"
  | "departure"
  | "pickup"
  | "destination";

const mapMarkerIcons: Record<MarkerKind, ReturnType<typeof divIcon>> = {
  driverPickup: divIcon({
    className: "journey-marker-icon",
    html: '<span class="journey-marker-pair" role="img" aria-label="Driver and rider pickup"><span class="journey-marker journey-marker-driver"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 14.5h14l-1.45-4.35a2 2 0 0 0-1.9-1.36H7.35a2 2 0 0 0-1.9 1.36L4 14.5v3.25c0 .69.56 1.25 1.25 1.25h1.5c.69 0 1.25-.56 1.25-1.25V17h8v.75c0 .69.56 1.25 1.25 1.25h1.5c.69 0 1.25-.56 1.25-1.25V14.5Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/><path d="M7.2 14.5h.01M16.8 14.5h.01" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2.8"/></svg></span><span class="journey-marker journey-marker-departure"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="2.4" fill="currentColor"/><path d="M12 8.5v6m0-4-4 2.7m4-2.7 4 2.7m-4 1-3 5m3-5 3 5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg></span></span>',
    iconSize: [58, 34],
    iconAnchor: [29, 17],
  }),
  driver: divIcon({
    className: "journey-marker-icon",
    html: '<span class="journey-marker journey-marker-driver" aria-label="Driver"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 14.5h14l-1.45-4.35a2 2 0 0 0-1.9-1.36H7.35a2 2 0 0 0-1.9 1.36L4 14.5v3.25c0 .69.56 1.25 1.25 1.25h1.5c.69 0 1.25-.56 1.25-1.25V17h8v.75c0 .69.56 1.25 1.25 1.25h1.5c.69 0 1.25-.56 1.25-1.25V14.5Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/><path d="M7.2 14.5h.01M16.8 14.5h.01" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2.8"/></svg></span>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  }),
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
const sameLocation = (left: Pin, right: Pin) =>
  Math.abs(left.latitude - right.latitude) <= 0.00005 &&
  Math.abs(left.longitude - right.longitude) <= 0.00005;

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
        {pins.map((pin, index) => {
          const markerKind = markerKinds?.[index];
          const sharesDriverPickup = markerKind === "pickup" && pins.some(
            (otherPin, otherIndex) =>
              markerKinds?.[otherIndex] === "driver" && sameLocation(pin, otherPin),
          );
          const driverWithPickup = markerKind === "driver" && pins.some(
            (otherPin, otherIndex) =>
              markerKinds?.[otherIndex] === "pickup" && sameLocation(pin, otherPin),
          );
          if (sharesDriverPickup) return null;
          return markerKind ? (
            <Marker
              key={`${pin.latitude}-${pin.longitude}-${index}`}
              position={[pin.latitude, pin.longitude]}
              icon={mapMarkerIcons[driverWithPickup ? "driverPickup" : markerKind]}
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
          );
        })}
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
