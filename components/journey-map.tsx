"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { divIcon } from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
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

const locationLabelIcon = (
  markerLabel: Exclude<MarkerLabel, string>,
  index: number,
) =>
  divIcon({
    className: "journey-location-label-icon",
    html: `<span class="journey-location-row" data-map-label="${index}"><span class="journey-location-eta"><strong>${markerLabel.etaMinutes}</strong><small>MIN</small></span><span class="journey-location-address">${escapeHtml(markerLabel.text)}</span></span>`,
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
    html: '<span class="journey-marker journey-marker-departure" aria-label="Starting point"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="2.4" fill="currentColor"/><path d="M12 8.5v6m0-4-4 2.7m4-2.7 4 2.7m-4 1-3 5m3-5 3 5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg></span>',
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
    html: '<span class="journey-marker journey-marker-destination" aria-label="Destination"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V3h14v12H5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M5 3h4.67v4H5zm9.33 0H19v4h-4.67zM9.67 7h4.66v4H9.67zM5 11h4.67v4H5zm9.33 0H19v4h-4.67z" fill="currentColor"/></svg></span>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
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
function Fit({
  pins,
  lines,
  followPins,
  recenterPin,
  followZoom = 16,
  animate = true,
}: {
  pins: Pin[];
  lines: Line[];
  followPins?: Pin[];
  recenterPin?: Pin;
  followZoom?: number;
  animate?: boolean;
}) {
  const map = useMap();
  const manualView = useRef(false);
  const lastInteraction = useRef(0);
  const lastFollowPosition = useRef("");
  const followStarted = useRef(false);
  const recenterEnabled = Boolean(recenterPin);
  const recenter = useEffectEvent(() => {
    if (!recenterPin || Date.now() - lastInteraction.current < 7000) return;
    const key = `${recenterPin.latitude}:${recenterPin.longitude}`;
    if (lastFollowPosition.current === key) return;
    lastFollowPosition.current = key;
    if (!followStarted.current) {
      followStarted.current = true;
      map.setView(
        [recenterPin.latitude, recenterPin.longitude],
        manualView.current ? map.getZoom() : followZoom,
        { animate: true },
      );
      return;
    }
    map.panTo([recenterPin.latitude, recenterPin.longitude], { animate: true });
  });
  useEffect(() => {
    if (!recenterEnabled) {
      followStarted.current = false;
      lastFollowPosition.current = "";
      return;
    }
    recenter();
    const timer = setInterval(() => recenter(), 250);
    return () => clearInterval(timer);
  }, [recenterEnabled]);
  useEffect(() => {
    recenter();
  }, [recenterPin?.latitude, recenterPin?.longitude]);
  const points = followPins?.length
    ? followPins
    : [...pins, ...lines.flatMap((line) => line.points)];
  const pointKey = points
    .map((point) => `${point.latitude}:${point.longitude}`)
    .join("|");
  useEffect(() => {
    const container = map.getContainer();
    const takeControl = () => {
      lastInteraction.current = Date.now();
      lastFollowPosition.current = "";
      manualView.current = true;
      map.stop();
    };
    const keyboardControl = (event: KeyboardEvent) => {
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "+",
          "-",
          "=",
          "Enter",
          " ",
        ].includes(event.key)
      )
        takeControl();
    };
    container.addEventListener("pointerdown", takeControl, { passive: true });
    const dragControl = (event: PointerEvent) => {
      if (event.buttons) takeControl();
    };
    container.addEventListener("pointermove", dragControl, { passive: true });
    container.addEventListener("pointerup", takeControl, { passive: true });
    container.addEventListener("wheel", takeControl, { passive: true });
    container.addEventListener("keydown", keyboardControl);
    return () => {
      container.removeEventListener("pointerdown", takeControl);
      container.removeEventListener("pointermove", dragControl);
      container.removeEventListener("pointerup", takeControl);
      container.removeEventListener("wheel", takeControl);
      container.removeEventListener("keydown", keyboardControl);
    };
  }, [map]);
  useEffect(() => {
    if (recenterEnabled || manualView.current || points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 16, {
        animate,
      });
      return;
    }
    map.fitBounds(
      points.map(
        (point) => [point.latitude, point.longitude] as [number, number],
      ),
      { padding: [48, 48], maxZoom: 16, animate },
    );
    // Coordinates—not freshly allocated prop arrays—are the meaningful fit trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, pointKey, recenterEnabled, animate]);
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
  labelPins,
}: {
  pins: Pin[];
  markerKinds?: MarkerKind[];
  markerLabels?: Array<MarkerLabel | undefined>;
  labelPins?: Pin[];
}) {
  const map = useMap();
  const [overlapping, setOverlapping] = useState<Set<number>>(() => new Set());
  const updateOverlap = useCallback(() => {
    const next = new Set<number>();
    const finishes = pins
      .map((pin, index) => ({ pin, index }))
      .filter(({ index }) => markerKinds?.[index] === "destination");
    if (finishes.length === 2) {
      const [a, b] = finishes.map(({ pin }) =>
        map.latLngToContainerPoint([pin.latitude, pin.longitude]),
      );
      if (a.distanceTo(b) <= 32) {
        next.add(finishes[0].index);
        next.add(finishes[1].index);
      }
    }
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

  useEffect(() => {
    const container = map.getContainer();
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("map-label-connectors");
    container.appendChild(svg);
    let frame = 0;
    const place = () => {
      svg.style.visibility = "visible";
      svg.replaceChildren();
      const viewport = container.getBoundingClientRect();
      const occupied: Array<{
        left: number;
        top: number;
        right: number;
        bottom: number;
      }> = [];
      container
        .querySelectorAll<HTMLElement>("[data-map-label]")
        .forEach((node) => {
          const index = Number(node.dataset.mapLabel);
          const pin = labelPins?.[index] ?? pins[index];
          if (!pin) return;
          const label = node.closest<HTMLElement>(".leaflet-tooltip") ?? node;
          const oldX = Number(label.dataset.shiftX ?? 0),
            oldY = Number(label.dataset.shiftY ?? 0);
          const measured = label.getBoundingClientRect();
          const baseX = measured.left - viewport.left - oldX,
            baseY = measured.top - viewport.top - oldY;
          const w = measured.width,
            h = measured.height;
          const anchor = map.latLngToContainerPoint([
            pin.latitude,
            pin.longitude,
          ]);
          const options = [
            [baseX + oldX, baseY + oldY],
            [anchor.x - w / 2, anchor.y - h - 22],
            [anchor.x + 22, anchor.y - h / 2],
            [anchor.x - w - 22, anchor.y - h / 2],
            [anchor.x - w / 2, anchor.y + 22],
          ];
          const score = ([x, y]: number[]) => {
            const clipping =
              Math.max(0, 8 - x) +
              Math.max(0, 8 - y) +
              Math.max(0, x + w - viewport.width + 8) +
              Math.max(0, y + h - viewport.height + 8);
            const overlap = occupied.reduce(
              (sum, r) =>
                sum +
                Math.max(
                  0,
                  Math.min(x + w + 6, r.right) - Math.max(x - 6, r.left),
                ) *
                  Math.max(
                    0,
                    Math.min(y + h + 6, r.bottom) - Math.max(y - 6, r.top),
                  ),
              0,
            );
            return clipping * 1000 + overlap;
          };
          const chosen = options.reduce((best, option) =>
            score(option) < score(best) ? option : best,
          );
          const x = Math.max(8, Math.min(chosen[0], viewport.width - w - 8));
          const y = Math.max(8, Math.min(chosen[1], viewport.height - h - 8));
          label.dataset.shiftX = String(x - baseX);
          label.dataset.shiftY = String(y - baseY);
          label.style.translate = `${x - baseX}px ${y - baseY}px`;
          const shifted = Math.abs(x - baseX) > 1 || Math.abs(y - baseY) > 1;
          label.classList.toggle("map-label-shifted", shifted);
          occupied.push({ left: x, top: y, right: x + w, bottom: y + h });
          if (shifted) {
            const line = document.createElementNS(svg.namespaceURI, "line");
            for (const [key, value] of Object.entries({
              x1: anchor.x,
              y1: anchor.y,
              x2: Math.max(x, Math.min(anchor.x, x + w)),
              y2: Math.max(y, Math.min(anchor.y, y + h)),
            }))
              line.setAttribute(key, String(value));
            svg.appendChild(line);
          }
        });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    schedule();
    const hideConnectors = () => {
      svg.style.visibility = "hidden";
    };
    map.on("movestart zoomstart", hideConnectors);
    map.on("moveend zoomend resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      map.off("moveend zoomend resize", schedule);
      map.off("movestart zoomstart", hideConnectors);
      svg.remove();
    };
  }, [map, pins, markerLabels, labelPins]);

  return (
    <>
      {pins.map((pin, index) => {
        const markerKind = markerKinds?.[index];
        const markerLabel = markerLabels?.[index];
        const labelPin = labelPins?.[index] ?? pin;
        const markerKey = `${pin.latitude}-${pin.longitude}-${index}`;
        const driverFinish =
          markerKind === "destination" && markerKinds?.[index - 1] === "driver";
        const finishTitle = driverFinish
          ? "Driver destination"
          : "Rider destination";
        const icon =
          markerKind === "destination"
            ? divIcon({
                ...mapMarkerIcons.destination.options,
                html: String(mapMarkerIcons.destination.options.html)
                  .replace(
                    "journey-marker-destination",
                    `journey-marker-destination ${driverFinish ? "finish-driver" : "finish-rider"}`,
                  )
                  .replace(
                    'aria-label="Destination"',
                    `aria-label="${finishTitle}"`,
                  ),
              })
            : markerKind
              ? mapMarkerIcons[markerKind]
              : undefined;
        return markerKind ? (
          <Fragment key={markerKey}>
            <Marker
              position={[pin.latitude, pin.longitude]}
              icon={icon}
              title={markerKind === "destination" ? finishTitle : undefined}
              opacity={overlapping.has(index) ? 0.52 : 1}
              zIndexOffset={markerKind === "pickup" ? 2 : 1}
            >
              {markerKind === "destination" ? (
                <Popup>{finishTitle}</Popup>
              ) : null}
            </Marker>
            {typeof markerLabel === "string" ? (
              <Tooltip
                position={[labelPin.latitude, labelPin.longitude]}
                className="journey-location-label"
                direction="top"
                offset={[0, -16]}
                opacity={1}
                permanent
              >
                <span data-map-label={index}>{markerLabel}</span>
              </Tooltip>
            ) : null}
            {markerLabel && typeof markerLabel !== "string" ? (
              <Marker
                position={[labelPin.latitude, labelPin.longitude]}
                icon={locationLabelIcon(markerLabel, index)}
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
  followPins,
  recenterPin,
  followZoom,
  lines = [],
  onPick,
  markerKinds,
  markerLabels,
  labelPins,
  roadPathAttribution = false,
  animateViewport = true,
}: {
  pins?: Pin[];
  fitPins?: Pin[];
  followPins?: Pin[];
  recenterPin?: Pin;
  followZoom?: number;
  lines?: Line[];
  onPick?: (pin: Pin) => void;
  markerKinds?: MarkerKind[];
  markerLabels?: Array<MarkerLabel | undefined>;
  labelPins?: Pin[];
  roadPathAttribution?: boolean;
  animateViewport?: boolean;
}) {
  return (
    <div className="map-shell">
      <MapContainer
        center={[-33.8688, 151.2093]}
        zoom={15}
        scrollWheelZoom={false}
        zoomControl={false}
        zoomAnimation={animateViewport}
        markerZoomAnimation={animateViewport}
        fadeAnimation={animateViewport}
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
          labelPins={labelPins}
        />
        <MapClick onPick={onPick} />
        <Fit
          animate={animateViewport}
          pins={fitPins ?? pins}
          lines={lines}
          followPins={followPins}
          recenterPin={recenterPin}
          followZoom={followZoom}
        />
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
