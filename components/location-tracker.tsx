"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cocowheelsApi } from "@/lib/api-client";
import type { Ride } from "@/lib/client-types";
import { movementTracker } from "@/lib/location-tracking";

export default function LocationTracker() {
  const adminPage = usePathname().startsWith("/admin");
  const [otherDeviceRide, setOtherDeviceRide] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState(false);
  useEffect(() => {
    if (adminPage) return;
    let stopped = false;
    let busy = false;
    let currentId = "";
    let lastSent = 0;
    let detectMovement = movementTracker();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (delay: number) => {
      clearTimeout(timer);
      if (!stopped) timer = setTimeout(() => void tick(), delay);
    };
    async function tick(force = false) {
      if (
        stopped ||
        busy ||
        document.visibilityState !== "visible" ||
        !navigator.geolocation
      )
        return;
      busy = true;
      let nextDelay = 15000;
      const tickStartedAt = Date.now();
      try {
        const { currents } = await cocowheelsApi<{
          currents: Array<{
            role: string;
            ride: Ride;
            locationSource?: { canReport: boolean } | null;
          }>;
        }>("/api/current");
        const current = currents.find(
          ({ role, ride }) =>
            !ride.isSample &&
            (role === "DRIVER" ||
              ["ACCEPTED", "RIDE_ACTIVE", "CO_RIDE_ACTIVE"].includes(
                ride.status,
              )),
        );
        if (!current || stopped) {
          currentId = "";
          if (!stopped) setOtherDeviceRide(null);
          return;
        }
        setOtherDeviceRide(
          current.locationSource?.canReport === false
            ? current.ride.rideId
            : null,
        );
        if (current.locationSource?.canReport === false) return;
        if (currentId !== current.ride.rideId) {
          currentId = current.ride.rideId;
          lastSent = 0;
          detectMovement = movementTracker();
        }
        const rideId = currentId;
        const tracking = current.ride.tracking;
        if (tracking)
          nextDelay = Math.max(
            1000,
            Math.min(
              20000,
              Date.parse(tracking.nextCaptureAt) -
                Date.parse(tracking.serverNow),
            ),
          );
        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              maximumAge: 0,
              timeout: 12000,
            }),
        );
        if (
          stopped ||
          document.visibilityState !== "visible" ||
          position.coords.accuracy > 100
        )
          return;
        const fix = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        };
        const moving = detectMovement(fix);
        if (
          !tracking &&
          !force &&
          Date.now() - lastSent < (moving ? 15000 : 60000)
        )
          return;
        const result = await cocowheelsApi<{ ride: Ride }>(
          `/api/rides/${encodeURIComponent(rideId)}/location`,
          {
            method: "POST",
            body: JSON.stringify({
              ...fix,
              moving,
              capturedAt: new Date(position.timestamp).toISOString(),
            }),
          },
        );
        if (result.ride.tracking)
          nextDelay = Math.max(
            1000,
            Math.min(
              20000,
              Date.parse(result.ride.tracking.nextCaptureAt) -
                Date.parse(result.ride.tracking.serverNow),
            ),
          );
        lastSent = tickStartedAt;
      } catch {
        // Keep the previous capture timestamp when GPS or the network is unavailable.
      } finally {
        busy = false;
        schedule(nextDelay);
      }
    }
    const resume = () => {
      void tick(true);
    };
    void tick(true);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("online", resume);
    window.addEventListener("cocowheels:identity-changed", resume);
    window.addEventListener("cocowheels:location-source-changed", resume);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("cocowheels:identity-changed", resume);
      window.removeEventListener("cocowheels:location-source-changed", resume);
    };
  }, [adminPage]);
  async function switchDevice() {
    if (!otherDeviceRide || switching) return;
    setSwitching(true);
    try {
      await cocowheelsApi(
        `/api/rides/${encodeURIComponent(otherDeviceRide)}/location-source`,
        { method: "POST" },
      );
      setOtherDeviceRide(null);
      window.dispatchEvent(new Event("cocowheels:location-source-changed"));
    } catch {
      setSwitchError(true);
    } finally {
      setSwitching(false);
    }
  }
  if (adminPage) return null;
  return (
    <>
      {otherDeviceRide ? (
        <section className="location-source-notice">
          <p>Location is updating from another device.</p>
          <button
            type="button"
            className="secondary"
            disabled={switching}
            onClick={() => void switchDevice()}
          >
            {switching ? "Switching…" : "Use this device for location"}
          </button>
        </section>
      ) : null}
      {switchError ? (
        <div className="cancel-prompt-backdrop">
          <section
            className="cancel-prompt"
            role="dialog"
            aria-modal="true"
            aria-label="Location update"
          >
            <p>We couldn’t switch devices. Please try again.</p>
            <button
              type="button"
              className="primary"
              onClick={() => setSwitchError(false)}
            >
              OKAY
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}
