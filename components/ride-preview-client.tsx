"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { ApiError, cocowheelsApi } from "@/lib/api-client";
import type { Pin } from "@/lib/client-types";
import {
  cacheRoadPath,
  cacheRiderRoadPath,
  cachedRoadPath,
  cachedRiderRoadPath,
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
  status: "PUBLISHED" | "REQUESTED";
  departureLabel: string;
  destinationLabel: string;
  plannedRoute: { origin: Pin; destination: Pin };
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
  const [driverRoadPath, setDriverRoadPath] = useState<{
    coordinates: string;
    points: Pin[];
  } | null>(null);

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
  const driverRouteInput = useMemo(
    () =>
      ride
        ? {
            origin: ride.plannedRoute.origin,
            destination: ride.plannedRoute.destination,
          }
        : null,
    [ride],
  );
  const driverRouteCoordinates = driverRouteInput
    ? `${driverRouteInput.origin.latitude}:${driverRouteInput.origin.longitude}|${driverRouteInput.destination.latitude}:${driverRouteInput.destination.longitude}`
    : "";
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

  useEffect(() => {
    if (!driverRouteInput) return;
    const cached = cachedRoadPath(
      driverRouteInput.origin,
      driverRouteInput.destination,
    );
    if (cached?.length) {
      const timer = window.setTimeout(
        () =>
          setDriverRoadPath({
            coordinates: driverRouteCoordinates,
            points: cached,
          }),
        0,
      );
      return () => window.clearTimeout(timer);
    }
    let cancelled = false;
    void cocowheelsApi<{ points: Pin[] }>("/api/route-preview", {
      method: "POST",
      body: JSON.stringify(driverRouteInput),
    })
      .then(({ points }) => {
        if (cancelled || points.length < 2) return;
        cacheRoadPath(
          driverRouteInput.origin,
          driverRouteInput.destination,
          points,
        );
        setDriverRoadPath({ coordinates: driverRouteCoordinates, points });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [driverRouteCoordinates, driverRouteInput]);

  const activeDriverRoadPath =
    driverRoadPath?.coordinates === driverRouteCoordinates
      ? driverRoadPath.points
      : null;

  const lines = useMemo(() => {
    if (!ride) return [];
    return [
      {
        points: activeDriverRoadPath?.length
          ? activeDriverRoadPath
          : [ride.plannedRoute.origin, ride.plannedRoute.destination],
        color: "#2563eb",
        weight: 8,
        opacity: 0.9,
      },
      ...(riderRoute
        ? [
            {
              points: roadPath?.length
                ? roadPath
                : [riderRoute.pickup, riderRoute.destination],
              color: "#f97316",
              weight: 4,
              opacity: 0.95,
            },
          ]
        : []),
    ];
  }, [ride, activeDriverRoadPath, riderRoute, roadPath]);

  return (
    <section className="ride-preview" aria-live={ride ? undefined : "polite"}>
      {error ? (
        <><h1>Not available</h1><p className="intro">{error}</p></>
      ) : !ride ? (
        <div aria-busy="true" />
      ) : (
        <>
          <h1 className="page-title">Ride preview</h1>
          <div className="ride-preview-summary">
            <div className="ride-preview-header">
              <code>Route ID · {ride.rideId}</code>
              <strong className={ride.status === "PUBLISHED" ? "route-status-active" : "route-status-requested"}>
                {ride.status === "PUBLISHED" ? <><span>Route</span> active</> : "Route requested"}
              </strong>
            </div>
            <dl className={`ride-preview-fields${riderRoute?.directionFit ? " has-fit" : ""}`}>
              <div>
                <dt>Driver</dt>
                <dd>{ride.driverAlias}</dd>
              </div>
              <div>
                <dt>Where from?</dt>
                <dd>{ride.departureLabel}</dd>
              </div>
              <div>
                <dt>Departure</dt>
                <dd>{prettyTime(ride.scheduledDepartureAt)}</dd>
              </div>
              <div>
                <dt>Where to?</dt>
                <dd>{ride.destinationLabel}</dd>
              </div>
              <div>
                <dt>Price</dt>
                <dd>A${ride.priceAud}</dd>
              </div>
              {riderRoute?.directionFit ? (
                <div>
                  <dt>Fit</dt>
                  <dd className={`preview-fit preview-fit-${riderRoute.directionFit.toLowerCase()}`}>
                    {riderRoute.directionFit === "GOOD" ? "Good" : "Poor"}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
          <JourneyMap
            pins={[
              ride.plannedRoute.origin,
              ride.plannedRoute.destination,
              ...(riderRoute ? [riderRoute.pickup, riderRoute.destination] : []),
            ]}
            markerKinds={
              riderRoute
                ? ["driver", "destination", "pickup", "destination"]
                : ["driver", "destination"]
            }
            lines={lines}
            roadPathAttribution={Boolean(
              activeDriverRoadPath?.length || roadPath?.length,
            )}
          />
          <div className="route-key">
            <span><i className="route-key-driver" />Driver route</span>
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
