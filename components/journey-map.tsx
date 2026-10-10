"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { divIcon } from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
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
type MarkerKind = "driver" | "departure" | "pickup" | "destination";
type MarkerLabel =
  | string
  | {
      etaMinutes: number;
      text: string;
    };

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character]!,
  );

const locationLabelIcon = (markerLabel: Exclude<MarkerLabel, string>) =>
  divIcon({
    className: "journey-location-label-icon",
    html: `<span class="journey-location-row"><span class="journey-location-eta"><strong>${markerLabel.etaMinutes}</strong><small>MIN</small></span><span class="journey-location-address">${escapeHtml(markerLabel.text)}</span></span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 20],
  });

const mapMarkerIcons: Record<MarkerKind, ReturnType<typeof divIcon>> = {
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
function sameIndexes(left: Set<number>, right: Set<number>) {
  return (
    left.size === right.size && [...left].every((index) => right.has(index))
  );
}
function PinMarkers({
  pins,
  markerKinds,
  markerLabels,
}: {
  pins: Pin[];
  markerKinds?: MarkerKind[];
  markerLabels?: Array<MarkerLabel | undefined>;
}) {
  const map = useMap();
  const [overlapping, setOverlapping] = useState<Set<number>>(() => new Set());
  const updateOverlap = useCallback(() => {
    const next = new Set<number>();
    pins.forEach((driverPin, driverIndex) => {
      if (markerKinds?.[driverIndex] !== "driver") return;
      pins.forEach((pickupPin, pickupIndex) => {
        if (markerKinds?.[pickupIndex] !== "pickup") return;
        const driverPoint = map.latLngToContainerPoint([
          driverPin.latitude,
          driverPin.longitude,
        ]);
        const pickupPoint = map.latLngToContainerPoint([
          pickupPin.latitude,
          pickupPin.longitude,
        ]);
        if (driverPoint.distanceTo(pickupPoint) <= 32) {
          next.add(driverIndex);
          next.add(pickupIndex);
        }
      });
    });
    setOverlapping((current) => (sameIndexes(current, next) ? current : next));
  }, [map, markerKinds, pins]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(updateOverlap);
    map.on("zoomend moveend resize", updateOverlap);
    return () => {
      window.cancelAnimationFrame(frame);
      map.off("zoomend moveend resize", updateOverlap);
    };
  }, [map, updateOverlap]);

  return (
    <>
      {pins.map((pin, index) => {
        const markerKind = markerKinds?.[index];
        const markerLabel = markerLabels?.[index];
        const markerKey = `${pin.latitude}-${pin.longitude}-${index}`;
        return markerKind ? (
          <Fragment key={markerKey}>
            <Marker
              position={[pin.latitude, pin.longitude]}
              icon={mapMarkerIcons[markerKind]}
              opacity={overlapping.has(index) ? 0.52 : 1}
              zIndexOffset={markerKind === "pickup" ? 2 : 1}
            >
              {typeof markerLabel === "string" ? (
                <Tooltip
                  className="journey-location-label"
                  direction="top"
                  offset={[0, -16]}
                  opacity={1}
                  permanent
                >
                  {markerLabel}
                </Tooltip>
              ) : null}
            </Marker>
            {markerLabel && typeof markerLabel !== "string" ? (
              <Marker
                position={[pin.latitude, pin.longitude]}
                icon={locationLabelIcon(markerLabel)}
                interactive={false}
                keyboard={false}
                zIndexOffset={1000}
              />
            ) : null}
          </Fragment>
        ) : (
          <CircleMarker
            key={markerKey}
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
    </>
  );
}
export default function JourneyMap({
  pins = [],
  fitPins,
  lines = [],
  onPick,
  markerKinds,
  markerLabels,
  roadPathAttribution = false,
}: {
  pins?: Pin[];
  fitPins?: Pin[];
  lines?: Line[];
  onPick?: (pin: Pin) => void;
  markerKinds?: MarkerKind[];
  markerLabels?: Array<MarkerLabel | undefined>;
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
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
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
        <PinMarkers
          pins={pins}
          markerKinds={markerKinds}
          markerLabels={markerLabels}
        />
        <MapClick onPick={onPick} />
        <Fit pins={fitPins ?? pins} lines={lines} />
        <ZoomControl position="bottomright" />
      </MapContainer>
      <p className="map-attribution">
        {roadPathAttribution ? (
          <>
            Road path by{" "}
            <a
              href="https://www.geoapify.com/"
              target="_blank"
              rel="noreferrer"
            >
              Geoapify
            </a>
            <span aria-hidden="true"> · </span>
          </>
        ) : null}
        <a href="https://leafletjs.com/" target="_blank" rel="noreferrer">
          Leaflet
        </a>
        <span aria-hidden="true"> · </span>©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap contributors
        </a>
      </p>
    </div>
  );
}
