"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ApiError, cocowheelsApi } from "@/lib/api-client";
import type { Ride } from "@/lib/client-types";
import { routeReference } from "@/lib/route-id";

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
  const [current, setCurrent] = useState<ActivityItem[]>([]);
  const [history, setHistory] = useState<History | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const current = await cocowheelsApi<{
          current: { role: "DRIVER" | "RIDER"; ride: Ride } | null;
          currents: ActivityItem[];
        }>("/api/current");
        if (!cancelled) setCurrent(current.currents);
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
        new Date(b.ride.completedAt ?? b.ride.cancelledAt ?? b.ride.expiredAt ?? 0).getTime() -
        new Date(a.ride.completedAt ?? a.ride.cancelledAt ?? a.ride.expiredAt ?? 0).getTime(),
    );
  }, [history]);

  if (loading) {
    return <section className="activity-page" aria-busy="true" />;
  }

  if (error) {
    return (
      <section className="activity-page">
        <div className="activity-panel">
          <h1 className="page-title">Activity</h1>
          <div className="activity-panel-content">
            <h1>Not available</h1>
            <p className="intro">{error}</p>
            <button
              type="button"
              className="primary"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="activity-page">
      <div className="activity-panel">
        <h1 className="page-title">Activity</h1>
        <div className="activity-panel-content">
          {current.length ? (
            <section className="activity-current">
              {current.map((item) => (
                <ActivityCard key={`${item.role}-${item.ride.rideId}`} {...item} current />
              ))}
            </section>
          ) : null}
          {activity.length === 0 ? (
            current.length ? null : (
              <p className="intro">Completed, cancelled, and expired rides will appear here.</p>
            )
          ) : (
            <div className="activity-list">
              {activity.map(({ ride, role }) => (
                <ActivityCard key={`${role}-${ride.rideId}`} ride={ride} role={role} />
              ))}
            </div>
          )}
        </div>
      </div>
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
    : activityTime(ride.completedAt ?? ride.cancelledAt ?? ride.expiredAt);
  const status = cancelled ? "CANCELLED" : ride.status;
  const statusClass = cancelled
    ? "activity-status cancelled"
      : ride.status === "PUBLISHED"
        ? "activity-status published"
        : ride.status === "EXPIRED"
          ? "activity-status expired"
        : "activity-status";
  return (
    <article className="activity-card">
      <span className="activity-role">{role === "DRIVER" ? "Driver" : "Rider"}</span>
      <div className="activity-card-header">
        <div className="activity-card-identity">
          <strong>{ride.driverAlias}</strong>
          <code>Ride ID · {routeReference(ride.rideId)}</code>
        </div>
        <span className={statusClass}>{status}</span>
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
