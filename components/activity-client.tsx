"use client";

import { participantStatusLabel } from "@/lib/ride-status";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ApiError, cocowheelsApi } from "@/lib/api-client";
import type { Ride } from "@/lib/client-types";
import CancelPrompt from "./cancel-prompt";
import RideFieldLabel from "./ride-field-label";

type History = { driver: Ride[]; rider: Ride[] };
type ActivityItem = { ride: Ride; role: "DRIVER" | "RIDER" };

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
    let refreshMs = 8_000;
    let timer: ReturnType<typeof setTimeout>;
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
          refreshMs = openItems.currents.some((item) => item.ride.isSample)
            ? 2_000
            : 8_000;
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
        if (!cancelled) timer = setTimeout(() => void load(), refreshMs);
      }
    };
    void load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [revision]);

  const activity = useMemo<ActivityItem[]>(() => {
    if (!history) return [];
    return [
      ...history.driver.map((ride) => ({ ride, role: "DRIVER" as const })),
      ...history.rider.map((ride) => ({ ride, role: "RIDER" as const })),
    ].sort(
      (a, b) =>
        new Date(
          b.ride.request?.decidedAt ??
            b.ride.completedAt ??
            b.ride.cancelledAt ??
            b.ride.expiredAt ??
            0,
        ).getTime() -
        new Date(
          a.ride.request?.decidedAt ??
            a.ride.completedAt ??
            a.ride.cancelledAt ??
            a.ride.expiredAt ??
            0,
        ).getTime(),
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
              <p className="intro">
                Completed, cancelled, and expired rides will appear here.
              </p>
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
  const status = participantStatusLabel(
    ride.status,
    role === "RIDER" ? ride.request?.status : undefined,
  );
  const showStatus = status !== "Published";
  const statusClass = [
    "Cancelled",
    "Declined",
    "Withdrawn",
    "Unavailable",
  ].includes(status)
    ? "activity-status cancelled"
    : status === "Expired"
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
  const canEndRequest =
    role === "RIDER" &&
    Boolean(ride.request) &&
    (ride.request?.status === "PENDING" ||
      ride.request?.status === "ACCEPTED") &&
    !["COMPLETED", "CANCELLED", "EXPIRED"].includes(ride.status);
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
            <dt>
              <RideFieldLabel icon={showStatus ? "status" : "price"}>
                {showStatus ? "Status" : "Fare"}
              </RideFieldLabel>
            </dt>
            <dd className={showStatus ? statusClass : undefined}>
              {showStatus ? status : `A$${ride.priceAud}`}
            </dd>
          </div>
          <div>
            <dt>
              <RideFieldLabel icon="from">Where from?</RideFieldLabel>
            </dt>
            <dd>{locationText(route?.origin)}</dd>
          </div>
          <div>
            <dt>
              <RideFieldLabel icon="driver">Driver</RideFieldLabel>
            </dt>
            <dd>{ride.driverAlias}</dd>
          </div>
          <div>
            <dt>
              <RideFieldLabel icon="to">Where to?</RideFieldLabel>
            </dt>
            <dd>{locationText(route?.destination)}</dd>
          </div>
          {showStatus ? (
            <div>
              <dt>
                <RideFieldLabel icon="price">Fare</RideFieldLabel>
              </dt>
              <dd>A${ride.priceAud}</dd>
            </div>
          ) : null}
          <div className="activity-card-action">
            <dt>
              <RideFieldLabel icon="view">View</RideFieldLabel>
            </dt>
            <dd>
              <Link
                className="activity-open"
                href={href}
                aria-label={`View ride from ${locationText(route?.origin)} to ${locationText(route?.destination)}`}
              >
                VIEW
              </Link>
            </dd>
          </div>
          {canEndRequest ? (
            <div className="activity-card-action">
              <dt>
                <RideFieldLabel icon="action">Action</RideFieldLabel>
              </dt>
              <dd>
                {canEndRequest ? (
                  <button
                    type="button"
                    className="activity-request-end"
                    disabled={ending}
                    onClick={() => setEndPromptOpen(true)}
                  >
                    {ride.request?.status === "PENDING"
                      ? "WITHDRAW REQUEST"
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
