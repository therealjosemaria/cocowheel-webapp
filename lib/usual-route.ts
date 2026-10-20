import type { Pin, PayIdType } from "./client-types";

export type UsualRoute = {
  origin: Pin;
  destination: Pin;
  days: number[]; // ISO weekday: Monday 1 ... Sunday 7
  minute: number | null;
  alerts: boolean;
  priceAud: number;
  payId: string;
  payIdType: PayIdType;
};
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function clockLabel(minute: number) {
  const m = ((minute % 1440) + 1440) % 1440;
  return `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, "0")} ${m < 720 ? "am" : "pm"}`;
}
export function scheduleWindow(minute: number) {
  return `${clockLabel(minute - 60)}–${clockLabel(minute + 60)} · Sydney time${minute < 60 || minute >= 1380 ? " (crosses midnight)" : ""}`;
}
export function departureLabel(value: string) {
  return `Leaving around ${new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))}`;
}
