"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Pin } from "@/lib/client-types";
import { cocowheelsApi } from "@/lib/api-client";
import { cachedRoadPath, cacheRoadPath } from "@/lib/ride-preview-cache";
import { DRIVER_ROUTE, RIDER_ROUTE } from "@/lib/map-style";

const JourneyMap = dynamic(() => import("./journey-map"), { ssr: false });
type Route = { origin?: Pin; destination?: Pin };

function useRoadPath(route: Route | undefined, revision: number) {
  const key =
    route?.origin && route.destination
      ? JSON.stringify([
          route.origin.latitude,
          route.origin.longitude,
          route.destination.latitude,
          route.destination.longitude,
        ])
      : "";
  const [result, setResult] = useState<{
    key: string;
    revision: number;
    points: Pin[] | null;
  }>();
  useEffect(() => {
    if (!key) return;
    const [a, b, c, d] = JSON.parse(key) as number[];
    const origin = { latitude: a, longitude: b };
    const destination = { latitude: c, longitude: d };
    const controller = new AbortController();
    const load = async () => {
      try {
        const cached = cachedRoadPath(origin, destination);
        const points =
          cached?.length && cached.length >= 2
            ? cached
            : (
                await cocowheelsApi<{ points: Pin[] }>("/api/route-preview", {
                  method: "POST",
                  body: JSON.stringify({ origin, destination }),
                  signal: controller.signal,
                })
              ).points;
        if (controller.signal.aborted) return;
        if (!points || points.length < 2) throw new Error("NO_ROAD_ROUTE");
        cacheRoadPath(origin, destination, points);
        setResult({ key, revision, points });
      } catch {
        if (!controller.signal.aborted)
          setResult({ key, revision, points: null });
      }
    };
    void load();
    return () => controller.abort();
  }, [key, revision]);
  const current =
    result?.key === key && result.revision === revision ? result : undefined;
  return {
    points: current?.points,
    failed: Boolean(key && current?.points === null),
  };
}

/** Planned routes only: shared by public request discovery and owner Activity. */
export default function RequestRouteMap({
  driver,
  rider,
  riderLabel = "Rider route",
}: {
  driver?: Route;
  rider?: Route;
  riderLabel?: string;
}) {
  const [revision, setRevision] = useState(0);
  const driverPath = useRoadPath(driver, revision);
  const riderPath = useRoadPath(rider, revision);
  const pins = [
    driver?.origin,
    driver?.destination,
    rider?.origin,
    rider?.destination,
  ].filter((pin): pin is Pin => Boolean(pin));
  const lines = [
    ...(driverPath.points
      ? [{ points: driverPath.points, ...DRIVER_ROUTE }]
      : []),
    ...(riderPath.points ? [{ points: riderPath.points, ...RIDER_ROUTE }] : []),
  ];
  return (
    <>
      <div className="demand-map">
        <JourneyMap
          pins={pins}
          lines={lines}
          roadPathAttribution={lines.length > 0}
          animateViewport={false}
        />
      </div>
      {((driver?.origin && driver.destination) || rider) && (
        <div
          className="ride-selection-route-key"
          aria-label="Map route colours"
        >
          {driver?.origin && driver.destination && (
            <span>
              <i className="ride-selection-route-driver" aria-hidden="true" />
              Your route
            </span>
          )}
          {rider && (
            <span>
              <i className="ride-selection-route-rider" aria-hidden="true" />
              {riderLabel}
            </span>
          )}
        </div>
      )}
      {(driverPath.failed || riderPath.failed) && (
        <p className="save-route-profile-note" role="status">
          Road route unavailable.{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => setRevision((value) => value + 1)}
          >
            Try again
          </button>
        </p>
      )}
    </>
  );
}
