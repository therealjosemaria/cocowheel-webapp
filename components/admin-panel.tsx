"use client";

import { useCallback, useEffect, useState } from "react";

type Row = Record<string, string | number | null>;
type Dashboard = {
  counts: { status: string; count: number }[];
  rides: Row[];
  total: number;
};
type Inspector = {
  ride: Row;
  requests: Row[];
  locations: Row[];
  events: Row[];
};
const statuses = [
  "PUBLISHED",
  "REQUESTED",
  "ACCEPTED",
  "RIDE_ACTIVE",
  "CO_RIDE_ACTIVE",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
];
const label = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());
const names: Record<string, string> = {
  public_id: "Route ID",
  driver_alias: "Driver",
  origin_label: "Where from",
  destination_label: "Where to",
  price_aud: "Price",
  offer_expires_at: "Offer expires",
  is_sample: "Sample",
  rider_alias: "Rider",
  pickup_label: "Where from",
};
function Fields({ row }: { row: Row }) {
  return (
    <dl className="admin-fields">
      {Object.entries(row).map(([key, value]) => (
        <div key={key}>
          <dt>{names[key] ?? label(key)}</dt>
          <dd>
            {value === null
              ? "—"
              : key === "is_sample"
                ? value
                  ? "Yes"
                  : "No"
                : key === "price_aud"
                  ? `A$${value}`
                  : key.endsWith("_at")
                    ? new Date(value).toLocaleString()
                    : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/admin/${path}`, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Request": "1",
          },
          body: JSON.stringify(body),
        }),
  });
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}
export default function AdminPanel() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [inspector, setInspector] = useState<Inspector | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("Overview");
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const clear = useCallback(() => {
    setAuthenticated(false);
    setDashboard(null);
    setInspector(null);
    setSelected("");
  }, []);
  const failure = useCallback(
    (reason: unknown) => {
      if (reason instanceof Error && reason.name === "AbortError") return;
      if (reason instanceof Error && ["401", "403"].includes(reason.message)) {
        clear();
        window.location.replace("/");
      } else setError("Unable to load. Please try again.");
    },
    [clear],
  );
  useEffect(() => {
    const controller = new AbortController();
    api<Dashboard>("dashboard", undefined, controller.signal)
      .then((data) => {
        setDashboard(data);
        setAuthenticated(true);
      })
      .catch((reason) => {
        failure(reason);
      })
      .finally(() => setReady(true));
    return () => controller.abort();
  }, [failure]);
  useEffect(() => {
    if (!authenticated) return;
    const controller = new AbortController();
    let running = false;
    const load = async () => {
      if (document.hidden || running) return;
      running = true;
      try {
        if (tab === "Trip inspector" && selected) {
          const data = await api<Inspector>(
            `rides/${encodeURIComponent(selected)}`,
            undefined,
            controller.signal,
          );
          setInspector(data);
        } else {
          const data = await api<Dashboard>(
            `dashboard?page=${page}&status=${encodeURIComponent(status)}`,
            undefined,
            controller.signal,
          );
          setDashboard(data);
        }
      } catch (reason) {
        failure(reason);
      } finally {
        running = false;
      }
    };
    void load();
    const timer = setInterval(() => void load(), 15000);
    document.addEventListener("visibilitychange", load);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [authenticated, tab, selected, page, status, failure]);
  const inspect = (id: string) => {
    setInspector(null);
    setSelected(id);
    setTab("Trip inspector");
  };
  return (
    <section className="page-content">
      <div className="admin-panel">
        <header className="admin-heading">
          <h1>Admin</h1>
        </header>
        {!ready || !authenticated ? null : (
          <>
            <p className="admin-muted">Read-only</p>
            <nav className="admin-tabs" aria-label="Admin sections">
              {["Overview", "Trips", "Trip inspector"].map((item) => (
                <button
                  key={item}
                  aria-current={tab === item ? "page" : undefined}
                  onClick={() => {
                    setTab(item);
                    setError("");
                  }}
                >
                  {item}
                </button>
              ))}
            </nav>
            {tab === "Overview" && dashboard && (
              <>
                <div className="admin-stats">
                  {[
                    { name: "Available", states: ["PUBLISHED", "REQUESTED"] },
                    {
                      name: "Accepted / underway",
                      states: ["ACCEPTED", "RIDE_ACTIVE", "CO_RIDE_ACTIVE"],
                    },
                    { name: "Completed", states: ["COMPLETED"] },
                    { name: "Closed", states: ["CANCELLED", "EXPIRED"] },
                  ].map((item) => (
                    <div key={item.name}>
                      <strong>
                        {dashboard.counts
                          .filter((row) => item.states.includes(row.status))
                          .reduce((sum, row) => sum + row.count, 0)}
                      </strong>
                      <span>{item.name}</span>
                    </div>
                  ))}
                </div>
                <p className="admin-muted">
                  All-time records, including samples. Refreshes every 15
                  seconds while visible.
                </p>
                <button className="secondary" onClick={() => setTab("Trips")}>
                  View trips
                </button>
              </>
            )}
            {tab === "Trips" && dashboard && (
              <>
                <label className="admin-filter">
                  Status
                  <select
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="">All statuses</option>
                    {statuses.map((item) => (
                      <option key={item} value={item}>
                        {label(item)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="admin-records">
                  {dashboard.rides.map((ride) => (
                    <article key={String(ride.public_id)}>
                      <Fields
                        row={Object.fromEntries(
                          [
                            "public_id",
                            "status",
                            "driver_alias",
                            "price_aud",
                            "origin_label",
                            "destination_label",
                            "created_at",
                            "is_sample",
                          ].map((key) => [key, ride[key]]),
                        )}
                      />
                      <button
                        className="secondary"
                        onClick={() => inspect(String(ride.public_id))}
                      >
                        Inspect
                      </button>
                    </article>
                  ))}
                  {dashboard.rides.length === 0 && <p>No trips found.</p>}
                </div>
                <div className="admin-pagination">
                  <button
                    className="secondary"
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    {page + 1} / {Math.max(1, Math.ceil(dashboard.total / 25))}
                  </span>
                  <button
                    className="secondary"
                    disabled={(page + 1) * 25 >= dashboard.total}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </button>
                </div>
              </>
            )}
            {tab === "Trip inspector" &&
              (!selected ? (
                <p>Select a trip to inspect.</p>
              ) : (
                inspector && (
                  <div className="admin-records">
                    <article>
                      <h2>Route · {selected.replace(/^COCO-/, "")}</h2>
                      <Fields row={inspector.ride} />
                    </article>
                    <article>
                      <h2>Rider requests</h2>
                      <p className="admin-muted">Latest 200</p>
                      {inspector.requests.map((row, i) => (
                        <Fields key={i} row={row} />
                      ))}
                      {!inspector.requests.length && <p>No requests.</p>}
                    </article>
                    <article>
                      <h2>Latest locations</h2>
                      <p className="admin-muted">
                        Last reported positions, not a full GPS history.
                      </p>
                      {inspector.locations.map((row, i) => (
                        <Fields key={i} row={row} />
                      ))}
                      {!inspector.locations.length && (
                        <p>No retained locations.</p>
                      )}
                    </article>
                    <article>
                      <h2>Event history</h2>
                      <p className="admin-muted">Latest 200 · newest first</p>
                      {inspector.events.map((row, i) => (
                        <Fields key={i} row={row} />
                      ))}
                    </article>
                  </div>
                )
              ))}
          </>
        )}
        {error && (
          <p role="alert" className="admin-message">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
