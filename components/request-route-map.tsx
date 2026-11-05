"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Pin } from "@/lib/client-types";
import { cocowheelsApi } from "@/lib/api-client";
import { cachedRoadPath, cacheRoadPath } from "@/lib/ride-preview-cache";
import { DRIVER_ROUTE, RIDER_ROUTE } from "@/lib/map-style";
import { JourneyResultsMap } from "./journey-results-layout";
import { useVehicleArtwork } from "@/lib/use-vehicle-artwork";

const JourneyMap = dynamic(() => import("./journey-map"), { ssr: false });
type Route = { origin?: Pin; destination?: Pin; vehicleType?: "car" | "bicycle" };

function useRoadPath(route: Route | undefined, revision: number, mode: "drive" | "bicycle" = "drive") {
  const key =
    route?.origin && route.destination
      ? JSON.stringify([
          route.origin.latitude,
          route.origin.longitude,
          route.destination.latitude,
          route.destination.longitude,
          mode,
        ])
      : "";
  const [result, setResult] = useState<{
    key: string;
    revision: number;
    points: Pin[] | null;
  }>();
  useEffect(() => {
    if (!key) return;
    const [a, b, c, d] = JSON.parse(key) as [number, number, number, number, string];
    const origin = { latitude: a, longitude: b };
    const destination = { latitude: c, longitude: d };
    const controller = new AbortController();
    const load = async () => {
      try {
        const cached = cachedRoadPath(origin, destination, mode);
        const points =
          cached?.length && cached.length >= 2
            ? cached
            : (
                await cocowheelsApi<{ points: Pin[] }>("/api/route-preview", {
                  method: "POST",
                  body: JSON.stringify({ origin, destination, mode }),
                  signal: controller.signal,
                })
              ).points;
        if (controller.signal.aborted) return;
        if (!points || points.length < 2) throw new Error("NO_ROAD_ROUTE");
        cacheRoadPath(origin, destination, points, mode);
        setResult({ key, revision, points });
      } catch {
        if (!controller.signal.aborted)
          setResult({ key, revision, points: null });
      }
    };
    void load();
    return () => controller.abort();
  }, [key, revision, mode]);
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
  back,
  ownDriver = false,
}: {
  driver?: Route;
  rider?: Route;
  riderLabel?: string;
  back?: () => void;
  ownDriver?: boolean;
}) {
  const vehicleArtwork = useVehicleArtwork(ownDriver && Boolean(driver?.origin));
  const [revision, setRevision] = useState(0);
  const driverPath = useRoadPath(driver, revision, driver?.vehicleType === "bicycle" ? "bicycle" : "drive");
  const riderPath = useRoadPath(rider, revision, driver?.vehicleType === "bicycle" ? "bicycle" : "drive");
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
  const map = <JourneyMap
          vehicleArtwork={vehicleArtwork}
          pins={pins}
          markerKinds={[
            ...(driver?.origin ? ["driver" as const] : []),
            ...(driver?.destination ? [driver.origin ? "destination" as const : undefined] : []),
            ...(rider?.origin ? ["pickup" as const] : []),
            ...(rider?.destination ? [rider.origin ? "destination" as const : undefined] : []),
          ]}
          lines={lines}
          roadPathAttribution={lines.length > 0}
          animateViewport={false}
        />;
  return (
    <>
      {back ? <JourneyResultsMap back={back}>{map}</JourneyResultsMap> : <div className="demand-map">{map}</div>}
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
