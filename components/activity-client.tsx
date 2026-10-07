"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ApiError, cocowheelsApi } from "@/lib/api-client";
import type { Ride } from "@/lib/client-types";

type History = { driver: Ride[]; rider: Ride[] };
type ActivityItem = { ride: Ride; role: "DRIVER" | "RIDER" };

const activityTime = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "Completed";

export default function ActivityClient() {
  const [current, setCurrent] = useState<ActivityItem | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const current = await cocowheelsApi<{
          current: { role: "DRIVER" | "RIDER"; ride: Ride } | null;
        }>("/api/current");
        if (!cancelled && current.current) setCurrent(current.current);
        const result = await cocowheelsApi<History>("/api/history");
        if (!cancelled) setHistory(result);
      } catch (reason) {
        if (cancelled) return;
        if (reason instanceof ApiError && reason.status === 401) {
          setHistory({ driver: [], rider: [] });
          return;
        }
        setError("Trying to reconnect. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const activity = useMemo<ActivityItem[]>(() => {
    if (!history) return [];
    return [
      ...history.driver.map((ride) => ({ ride, role: "DRIVER" as const })),
      ...history.rider.map((ride) => ({ ride, role: "RIDER" as const })),
    ].sort(
      (a, b) =>
        new Date(b.ride.completedAt ?? 0).getTime() -
        new Date(a.ride.completedAt ?? 0).getTime(),
    );
  }, [history]);

  if (loading) {
    return (
      <section className="activity-page" aria-live="polite">
        <p className="eyebrow">Activity</p>
        <h1>Loading</h1>
      </section>
    );
  }

  if (error) {
    return (
      <section className="activity-page">
        <p className="eyebrow">Activity</p>
        <h1>Not available</h1>
        <p className="intro">{error}</p>
        <button
          type="button"
          className="primary"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </section>
    );
  }

  return (
    <section className="activity-page">
      <p className="eyebrow">Activity</p>
      {current ? (
        <section className="activity-current">
          <p>Current</p>
          <ActivityCard {...current} current />
        </section>
      ) : null}
      {activity.length === 0 ? (
        current ? null : (
          <p className="intro">Completed and cancelled rides will appear here.</p>
        )
      ) : (
        <div className="activity-list">
          {activity.map(({ ride, role }) => (
            <ActivityCard key={`${role}-${ride.rideId}`} ride={ride} role={role} />
          ))}
        </div>
      )}
    </section>
  );
}

function ActivityCard({
  ride,
  role,
  current = false,
}: ActivityItem & { current?: boolean }) {
  const cancelled =
    ride.status === "CANCELLED" || ride.request?.status === "CANCELLED";
  const time = current
    ? activityTime(ride.scheduledDepartureAt)
    : activityTime(ride.completedAt ?? ride.cancelledAt);
  const status = cancelled ? "CANCELLED" : ride.status;
  return (
    <article className="activity-card">
      <span className="activity-role">{role === "DRIVER" ? "Driver" : "Rider"}</span>
      <div className="activity-card-header">
        <code>{ride.rideId}</code>
        <span>{status}</span>
      </div>
      <p className="activity-card-time">{time}</p>
      <div className="activity-card-bottom">
        <div className="activity-metrics">
          <span>0.00 km</span>
          <span>A${ride.priceAud}</span>
        </div>
        <Link
          className="activity-open"
          href={`/activity/${encodeURIComponent(ride.rideId)}`}
        >
          OPEN RIDE
        </Link>
      </div>
    </article>
  );
}
