import type { Pin } from "./client-types";
import {
  calendarDay,
  dateCaption,
  lastDepartureDate,
  scheduleDayBounds,
  sydneyDateTime,
  sydneyInstant,
  timeCaption,
} from "./ride-schedule";

export type DemandRoute = {
  origin: Pin;
  destination: Pin;
  date: string;
  time: string;
};
export type RiderDemand = DemandRoute & {
  id: string;
  alias: string;
  status: "OPEN" | "CANCELLED" | "FULFILLED" | "EXPIRED";
  expiresAt: string;
  createdAt: string;
};
export type DemandOffer = {
  id: string;
  demandId: string;
  rideId: string;
  driverAlias: string;
  departureAt: string;
  priceAud: number;
  origin: Pin;
  destination: Pin;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "UNAVAILABLE";
};
export type DemandActivity = {
  requests: Array<RiderDemand & { offers: DemandOffer[] }>;
  sent: DemandOffer[];
};
export function demandSchedule(route: Pick<DemandRoute, "date" | "time">) {
  return `${route.date === "any" ? "Any date" : dateCaption(route.date)} · ${route.time ? `Around ${timeCaption(route.time)}` : "Any time"}`;
}
export function checkedDemandRoute(
  value: unknown,
  now = new Date(),
): DemandRoute {
  if (!value || typeof value !== "object") throw new Error("INVALID_DEMAND");
  const body = value as Record<string, unknown>;
  const pin = (value: unknown): Pin => {
    if (!value || typeof value !== "object") throw new Error("INVALID_DEMAND");
    const p = value as Pin;
    if (
      typeof p.latitude !== "number" ||
      !Number.isFinite(p.latitude) ||
      Math.abs(p.latitude) > 90 ||
      typeof p.longitude !== "number" ||
      !Number.isFinite(p.longitude) ||
      Math.abs(p.longitude) > 180 ||
      (p.label !== undefined &&
        (typeof p.label !== "string" ||
          p.label.length > 160 ||
          /[\u0000-\u001f]/.test(p.label)))
    )
      throw new Error("INVALID_DEMAND");
    return {
      latitude: p.latitude,
      longitude: p.longitude,
      ...(p.label ? { label: p.label } : {}),
    };
  };
  if (
    typeof body.date !== "string" ||
    typeof body.time !== "string" ||
    (body.time !== "" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time))
  )
    throw new Error("INVALID_REQUEST_TIME");
  if (
    body.date !== "any" &&
    (!scheduleDayBounds(body.date) ||
      body.date < sydneyDateTime(now).date ||
      body.date > lastDepartureDate(now) ||
      (body.time && !sydneyInstant(body.date, body.time)))
  )
    throw new Error("INVALID_REQUEST_TIME");
  return {
    origin: pin(body.origin),
    destination: pin(body.destination),
    date: body.date,
    time: body.time,
  };
}
export function demandExpiry(route: DemandRoute, now = new Date()) {
  if (route.date === "any") return new Date(+now + 48 * 3600000).toISOString();
  const bounds = scheduleDayBounds(route.date)!;
  return new Date(
    route.time
      ? Math.min(
          Date.parse(bounds[1]),
          Date.parse(sydneyInstant(route.date, route.time)!) + 3600000,
        )
      : Date.parse(bounds[1]),
  ).toISOString();
}
/** Both searches and posted requests describe Sydney day-clipped +/- one-hour windows. */
export function demandWindows(
  route: Pick<DemandRoute, "date" | "time">,
  now = new Date(),
  expiresAt?: string,
): [number, number][] {
  const start = route.date === "any" ? sydneyDateTime(now).date : route.date;
  const end =
    route.date === "any"
      ? expiresAt
        ? sydneyDateTime(expiresAt).date
        : lastDepartureDate(now)
      : route.date;
  const windows: [number, number][] = [];
  for (let day = start; day <= end; day = calendarDay(day, 1)) {
    const bounds = scheduleDayBounds(day);
    if (!bounds) continue;
    const center = route.time ? sydneyInstant(day, route.time) : null;
    if (route.time && !center) continue;
    const low = Math.max(
      +now,
      Date.parse(bounds[0]),
      center ? Date.parse(center) - 3600000 : 0,
    );
    const high = Math.min(
      Date.parse(bounds[1]),
      expiresAt ? Date.parse(expiresAt) : Infinity,
      center ? Date.parse(center) + 3600000 : Infinity,
    );
    if (low < high) windows.push([low, high]);
  }
  return windows;
}
