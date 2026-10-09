"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ApiError, cocowheelsApi } from "@/lib/api-client";
import type { Ride } from "@/lib/client-types";
import { routeReference } from "@/lib/route-id";

type History = { driver: Ride[]; rider: Ride[] };
type ActivityItem = { ride: Ride; role: "DRIVER" | "RIDER" };

const departureTime = (value: string) =>
  new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(value));
const locationText = (location?: {
  latitude: number;
  longitude: number;
  label?: string;
}) =>
  location?.label ??
  (location
    ? location.latitude.toFixed(5) + ", " + location.longitude.toFixed(5)
    : "—");

export default function ActivityClient() {
  const [current, setCurrent] = useState<ActivityItem[]>([]);
  const [history, setHistory] = useState<History | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let requestInFlight = false;
    const load = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const [openItems, result] = await Promise.all([
          cocowheelsApi<{
            current: { role: "DRIVER" | "RIDER"; ride: Ride } | null;
            currents: ActivityItem[];
          }>("/api/current"),
          cocowheelsApi<History>("/api/history"),
        ]);
        if (!cancelled) {
          setCurrent(openItems.currents);
          setHistory(result);
          setError(null);
        }
      } catch (reason) {
        if (cancelled) return;
        if (reason instanceof ApiError && reason.status === 401) {
          setCurrent([]);
          setHistory({ driver: [], rider: [] });
          return;
        }
        setError("Trying to reconnect. Please try again.");
      } finally {
        requestInFlight = false;
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 8_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const activity = useMemo<ActivityItem[]>(() => {
    if (!history) return [];
    return [
      ...history.driver.map((ride) => ({ ride, role: "DRIVER" as const })),
      ...history.rider.map((ride) => ({ ride, role: "RIDER" as const })),
    ].sort(
      (a, b) =>
        new Date(b.ride.request?.decidedAt ?? b.ride.completedAt ?? b.ride.cancelledAt ?? b.ride.expiredAt ?? 0).getTime() -
        new Date(a.ride.request?.decidedAt ?? a.ride.completedAt ?? a.ride.cancelledAt ?? a.ride.expiredAt ?? 0).getTime(),
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
                <ActivityCard
                  key={`${item.role}-${item.ride.rideId}-${item.ride.request?.requestId ?? "driver"}`}
                  {...item}
                />
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
                <ActivityCard
                  key={`${role}-${ride.rideId}-${ride.request?.requestId ?? "driver"}`}
                  ride={ride}
                  role={role}
                />
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
}: ActivityItem) {
  const withdrawn =
    ride.request?.status === "CANCELLED" && ride.status !== "CANCELLED";
  const cancelled =
    ride.status === "CANCELLED" || ride.request?.status === "CANCELLED";
  const unavailableRequest =
    ride.request?.status === "DECLINED" ||
    ride.request?.status === "DISCARDED";
  const status = withdrawn
    ? "Request withdrawn"
    : ride.request?.status === "DECLINED"
      ? "Request declined"
      : ride.request?.status === "DISCARDED"
        ? "Request unavailable"
        : cancelled
          ? "Cancelled"
          : ({
              PUBLISHED: "Active",
              REQUESTED: "Requested",
              ACCEPTED: "Accepted",
              RIDE_ACTIVE: "Ride active",
              CO_RIDE_ACTIVE: "Co-ride active",
              COMPLETED: "Completed",
              CANCELLED: "Cancelled",
              EXPIRED: "Expired",
            })[ride.status];
  const statusClass = cancelled || unavailableRequest
    ? "activity-status cancelled"
      : ride.status === "PUBLISHED" || ride.status === "REQUESTED"
        ? "activity-status published"
        : ride.status === "EXPIRED"
          ? "activity-status expired"
        : "activity-status";
  const route =
    role === "DRIVER"
      ? ride.plannedRoute
      : ride.request
        ? { origin: ride.request.pickup, destination: ride.request.destination }
        : undefined;
  const href =
    "/activity/" +
    encodeURIComponent(ride.rideId) +
    (role === "RIDER" && ride.request
      ? "?request=" + encodeURIComponent(ride.request.requestId)
      : "");
  return (
    <article className="activity-card">
      <span className="activity-role">{role === "DRIVER" ? "Driver" : "Rider"}</span>
      <dl className="activity-card-fields">
        <div>
          <dt>Route ID</dt>
          <dd><code>{routeReference(ride.rideId)}</code></dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd className={statusClass}>{status}</dd>
        </div>
        <div>
          <dt>Driver</dt>
          <dd>{ride.driverAlias}</dd>
        </div>
        <div>
          <dt>Departure</dt>
          <dd>{departureTime(ride.scheduledDepartureAt)}</dd>
        </div>
        <div>
          <dt>Where from?</dt>
          <dd>{locationText(route?.origin)}</dd>
        </div>
        <div>
          <dt>Where to?</dt>
          <dd>{locationText(route?.destination)}</dd>
        </div>
        <div>
          <dt>Price</dt>
          <dd>A${ride.priceAud}</dd>
        </div>
        <div className="activity-card-action">
          <dt>Action</dt>
          <dd>
            <Link
              className="activity-open"
              href={href}
              aria-label={`Open ride ${routeReference(ride.rideId)}`}
            >
              OPEN RIDE
            </Link>
          </dd>
        </div>
      </dl>
    </article>
  );
}
