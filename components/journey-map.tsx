"use client";

import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { Pin } from "@/lib/client-types";

type Line = { points: [Pin, Pin]; color: string; muted?: boolean };
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
  useEffect(() => {
    const points = [...pins, ...lines.flatMap((line) => line.points)];
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 14);
      return;
    }
    map.fitBounds(
      points.map(
        (point) => [point.latitude, point.longitude] as [number, number],
      ),
      { padding: [28, 28], maxZoom: 14 },
    );
  }, [map, pins, lines]);
  return null;
}
export default function JourneyMap({
  pins = [],
  lines = [],
  onPick,
}: {
  pins?: Pin[];
  lines?: Line[];
  onPick?: (pin: Pin) => void;
}) {
  return (
    <div className="map-shell">
      <MapContainer
        center={[-33.8688, 151.2093]}
        zoom={12}
        scrollWheelZoom={false}
        zoomControl={false}
        className="journey-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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
              weight: line.muted ? 3 : 5,
              opacity: line.muted ? 0.25 : 0.85,
              dashArray: line.muted ? "7 9" : undefined,
            }}
          />
        ))}
        {pins.map((pin, index) => (
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
        ))}
        <MapClick onPick={onPick} />
        <Fit pins={pins} lines={lines} />
      </MapContainer>
    </div>
  );
}
