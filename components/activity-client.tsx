"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ApiError, cocowheelsApi } from "@/lib/api-client";
import type { Ride } from "@/lib/client-types";
import { routeReference } from "@/lib/route-id";
import CancelPrompt from "./cancel-prompt";

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
  const [revision, setRevision] = useState(0);

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
  }, [revision]);

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
                  refresh={() => setRevision((current) => current + 1)}
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
                  refresh={() => setRevision((current) => current + 1)}
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
  refresh,
}: ActivityItem & { refresh: () => void }) {
  const [endPromptOpen, setEndPromptOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState(false);
  const withdrawn =
    ride.request?.status === "CANCELLED" && ride.status !== "CANCELLED";
  const rideCancelled = ride.status === "CANCELLED";
  const unavailableRequest =
    ride.request?.status === "DECLINED" ||
    ride.request?.status === "DISCARDED";
  const status =
    ["PUBLISHED", "REQUESTED", "ACCEPTED"].includes(ride.status)
      ? "Active"
      : rideCancelled
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
  const statusClass = rideCancelled
    ? "activity-status cancelled"
      : status === "Active"
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
  const requestStatus = ride.request
    ? ({
        PENDING: "Pending",
        ACCEPTED: "Accepted",
        DECLINED: "Declined",
        DISCARDED: "Unavailable",
        CANCELLED: "Withdrawn",
      })[ride.request.status]
    : null;
  const canEndRequest =
    role === "RIDER" &&
    Boolean(ride.request) &&
    (ride.request?.status === "PENDING" ||
      ride.request?.status === "ACCEPTED") &&
    !["CO_RIDE_ACTIVE", "COMPLETED", "CANCELLED", "EXPIRED"].includes(
      ride.status,
    );
  const endRequest = async () => {
    if (!ride.request) return;
    setEnding(true);
    try {
      await cocowheelsApi(
        ride.request.status === "PENDING"
          ? `/api/rides/${encodeURIComponent(ride.rideId)}/request/cancel`
          : `/api/rides/${encodeURIComponent(ride.rideId)}/cancel`,
        { method: "POST" },
      );
      setEndPromptOpen(false);
      refresh();
    } catch {
      setEndPromptOpen(false);
      setEndError(true);
    } finally {
      setEnding(false);
    }
  };
  return (
    <>
      {endPromptOpen ? (
        <CancelPrompt
          busy={ending}
          request={ride.request?.status === "PENDING"}
          close={() => setEndPromptOpen(false)}
          confirm={endRequest}
        />
      ) : null}
      {endError ? (
        <div className="location-prompt-backdrop" role="presentation">
          <section
            className="location-prompt"
            role="dialog"
            aria-modal="true"
            aria-labelledby="activity-action-error-title"
          >
            <h2 id="activity-action-error-title">
              We couldn’t update this request.
            </h2>
            <div className="location-prompt-actions">
              <button
                type="button"
                className="primary"
                onClick={() => setEndError(false)}
              >
                OKAY
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <article className="activity-card">
        <span className="activity-role">
          <ActivityRoleIcon role={role} />
          {role === "DRIVER" ? "Driver" : "Rider"}
        </span>
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
        {role === "RIDER" && requestStatus ? (
          <div>
            <dt>Request status</dt>
            <dd
              className={
                unavailableRequest || withdrawn
                  ? "activity-status cancelled"
                  : ride.request?.status === "ACCEPTED"
                    ? "activity-status published"
                    : "activity-status"
              }
            >
              {requestStatus}
            </dd>
          </div>
        ) : null}
        <div className="activity-card-action">
          <dt>View</dt>
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
        {role === "RIDER" && requestStatus ? (
          <div className="activity-card-action">
            <dt>Action</dt>
            <dd>
              {canEndRequest ? (
                <button
                  type="button"
                  className="activity-request-end"
                  disabled={ending}
                  onClick={() => setEndPromptOpen(true)}
                >
                  {ride.request?.status === "PENDING"
                    ? "WITHDRAW"
                    : "CANCEL RIDE"}
                </button>
              ) : null}
            </dd>
          </div>
        ) : null}
      </dl>
      </article>
    </>
  );
}

function ActivityRoleIcon({ role }: { role: ActivityItem["role"] }) {
  return role === "DRIVER" ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 14.5h14l-1.45-4.35a2 2 0 0 0-1.9-1.36H7.35a2 2 0 0 0-1.9 1.36L4 14.5v3.25c0 .69.56 1.25 1.25 1.25h1.5c.69 0 1.25-.56 1.25-1.25V17h8v.75c0 .69.56 1.25 1.25 1.25h1.5c.69 0 1.25-.56 1.25-1.25V14.5Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M7.2 14.5h.01M16.8 14.5h.01"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.8"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="5" r="2.4" fill="currentColor" />
      <path
        d="M12 8.5v6m0-4-4 2.7m4-2.7 4 2.7m-4 1-3 5m3-5 3 5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}
