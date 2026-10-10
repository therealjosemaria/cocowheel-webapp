"use client";

import { useEffect } from "react";
import { cocowheelsApi } from "@/lib/api-client";
import type { Ride } from "@/lib/client-types";
import { movementTracker } from "@/lib/location-tracking";

export default function LocationTracker() {
  useEffect(() => {
    let stopped = false;
    let busy = false;
    let currentId = "";
    let lastSent = 0;
    let detectMovement = movementTracker();
    async function tick(force = false) {
      if (
        stopped ||
        busy ||
        document.visibilityState !== "visible" ||
        !navigator.geolocation
      )
        return;
      busy = true;
      const tickStartedAt = Date.now();
      try {
        const { currents } = await cocowheelsApi<{
          currents: Array<{ role: string; ride: Ride }>;
        }>("/api/current");
        const current = currents.find(
          ({ role, ride }) =>
            role === "DRIVER" ||
            ["ACCEPTED", "RIDE_ACTIVE", "CO_RIDE_ACTIVE"].includes(ride.status),
        );
        if (!current || stopped) {
          currentId = "";
          return;
        }
        if (currentId !== current.ride.rideId) {
          currentId = current.ride.rideId;
          lastSent = 0;
          detectMovement = movementTracker();
        }
        const rideId = currentId;
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
        if (!force && Date.now() - lastSent < (moving ? 15000 : 60000)) return;
        await cocowheelsApi(
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
        lastSent = tickStartedAt;
      } catch {
        // Keep the previous capture timestamp when GPS or the network is unavailable.
      } finally {
        busy = false;
      }
    }
    const resume = () => {
      void tick(true);
    };
    void tick(true);
    const timer = window.setInterval(() => void tick(), 15000);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("online", resume);
    window.addEventListener("cocowheels:identity-changed", resume);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("cocowheels:identity-changed", resume);
    };
  }, []);
  return null;
}
