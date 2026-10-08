"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { ApiError, cocowheelsApi } from "@/lib/api-client";
import type { Pin } from "@/lib/client-types";
import {
  cacheRiderRoadPath,
  cachedRiderRoadPath,
  markRiderSearchReturn,
  riderPreviewRoute,
} from "@/lib/ride-preview-cache";

const JourneyMap = dynamic(() => import("./journey-map"), {
  ssr: false,
  loading: () => <div className="map-loading">Loading map…</div>,
});

type PreviewRide = {
  rideId: string;
  driverAlias: string;
  priceAud: number;
  scheduledDepartureAt: string;
  departureLabel: string;
  destinationLabel: string;
  redactedCorridor: [Pin, Pin];
};
const prettyTime = (value: string) =>
  new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(value));

export default function RidePreviewClient({ rideId }: { rideId: string }) {
  const [ride, setRide] = useState<PreviewRide | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [riderRoute] = useState(() => riderPreviewRoute(rideId));
  const [roadPath, setRoadPath] = useState<Pin[] | null>(() =>
    riderRoute
      ? cachedRiderRoadPath(riderRoute.pickup, riderRoute.destination)
      : null,
  );

  useEffect(() => {
    let cancelled = false;
    void cocowheelsApi<{ ride: PreviewRide }>(
      `/api/rides/${encodeURIComponent(rideId)}/preview`,
    )
      .then((result) => {
        if (!cancelled) setRide(result.ride);
      })
      .catch((reason) => {
        if (cancelled) return;
        setError(
          reason instanceof ApiError && reason.status === 404
            ? "This ride is no longer available."
            : "Trying to reconnect. Please try again.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [rideId]);

  const routeKey = riderRoute
    ? `${riderRoute.pickup.latitude}:${riderRoute.pickup.longitude}|${riderRoute.destination.latitude}:${riderRoute.destination.longitude}`
    : null;
  useEffect(() => {
    if (!riderRoute || roadPath?.length) return;
    let cancelled = false;
    void cocowheelsApi<{ points: Pin[] }>("/api/route-preview", {
      method: "POST",
      body: JSON.stringify({
        origin: riderRoute.pickup,
        destination: riderRoute.destination,
      }),
    })
      .then(({ points }) => {
        if (cancelled || points.length < 2) return;
        cacheRiderRoadPath(riderRoute.pickup, riderRoute.destination, points);
        setRoadPath(points);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [riderRoute, roadPath?.length, routeKey]);

  const lines = useMemo(() => {
    if (!ride) return [];
    return [
      { points: ride.redactedCorridor, color: "#64748b", muted: true },
      ...(riderRoute
        ? [
            {
              points: roadPath?.length
                ? roadPath
                : [riderRoute.pickup, riderRoute.destination],
              color: "#111827",
              muted: !roadPath?.length,
            },
          ]
        : []),
    ];
  }, [ride, riderRoute, roadPath]);

  return (
    <section className="ride-preview" aria-live={ride ? undefined : "polite"}>
      <Link
        href="/"
        className="text-button activity-back"
        onClick={markRiderSearchReturn}
      >
        Back to Find a ride
      </Link>
      {error ? (
        <><h1>Not available</h1><p className="intro">{error}</p></>
      ) : !ride ? (
        <div aria-busy="true" />
      ) : (
        <>
          <h1 className="page-title">Ride preview</h1>
          <div className="ride-preview-summary">
            <strong>{ride.driverAlias}</strong>
            <span>{ride.departureLabel}</span>
            <span>{ride.destinationLabel}</span>
            <small>{prettyTime(ride.scheduledDepartureAt)} · A${ride.priceAud}</small>
          </div>
          <JourneyMap
            pins={riderRoute ? [riderRoute.pickup, riderRoute.destination] : []}
            markerKinds={riderRoute ? ["pickup", "destination"] : undefined}
            lines={lines}
            roadPathAttribution={Boolean(roadPath?.length)}
          />
          <div className="route-key">
            <span><i className="route-key-driver" />Driver direction</span>
            {riderRoute ? <span><i className="route-key-rider" />Your route</span> : null}
          </div>
          {!riderRoute ? (
            <p className="intro">Add your route in Find a ride to compare paths.</p>
          ) : null}
        </>
      )}
    </section>
  );
}
