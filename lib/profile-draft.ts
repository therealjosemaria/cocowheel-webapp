import type { Pin } from "./client-types";

export type ProfileDraft = {
  origin?: Pin;
  destination?: Pin;
  text: { origin: string; destination: string };
  days: number[];
  minute: string;
  alerts: boolean;
};
const prefix = "cocowheels:profile-route-draft:v1:";
const ttl = 30 * 60 * 1000;
const validPin = (pin: Pin | undefined) =>
  pin === undefined ||
  (Number.isFinite(pin.latitude) &&
    Math.abs(pin.latitude) <= 90 &&
    Number.isFinite(pin.longitude) &&
    Math.abs(pin.longitude) <= 180 &&
    (pin.label === undefined || typeof pin.label === "string"));
export function readProfileDraft(owner: string): ProfileDraft | null {
  try {
    const data = JSON.parse(sessionStorage.getItem(prefix + owner) ?? "null");
    if (
      !data ||
      !Number.isFinite(data.expiresAt) ||
      data.expiresAt <= Date.now() ||
      !validPin(data.origin) ||
      !validPin(data.destination) ||
      typeof data.text?.origin !== "string" ||
      typeof data.text?.destination !== "string" ||
      !Array.isArray(data.days) ||
      !data.days.every(
        (d: number) => Number.isInteger(d) && d >= 1 && d <= 7,
      ) ||
      typeof data.alerts !== "boolean" ||
      typeof data.minute !== "string" ||
      !/^(?:|(?:[01]\d|2[0-3]):[0-5]\d)$/.test(data.minute)
    )
      return null;
    return data;
  } catch {
    return null;
  }
}
export function writeProfileDraft(owner: string, draft: ProfileDraft) {
  try {
    sessionStorage.setItem(
      prefix + owner,
      JSON.stringify({ ...draft, expiresAt: Date.now() + ttl }),
    );
  } catch {
    /* Saving a route must still work when browser storage is blocked. */
  }
}
export function clearProfileDraft(owner: string) {
  try {
    sessionStorage.removeItem(prefix + owner);
  } catch {
    /* Storage is optional. */
  }
}
