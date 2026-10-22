import type { Pin } from "./client-types";

const key = "cocowheels:search-location:v1";
const ttl = 30 * 60 * 1000;

// Tab-local convenience state, never a restriction on the user's search.
export function searchLocation(): Pin | undefined {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (!value || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()) return;
    const pin = value.pin;
    if (!pin || !Number.isFinite(pin.latitude) || Math.abs(pin.latitude) > 90 ||
        !Number.isFinite(pin.longitude) || Math.abs(pin.longitude) > 180) return;
    return {
      latitude: pin.latitude, longitude: pin.longitude,
      ...(typeof pin.countryCode === "string" && /^[a-z]{2}$/i.test(pin.countryCode)
        ? { countryCode: pin.countryCode.toLowerCase() } : {}),
    };
  } catch { return; }
}

export function rememberSearchLocation(pin: Pin) {
  try {
    sessionStorage.setItem(key, JSON.stringify({
      pin: { latitude: pin.latitude, longitude: pin.longitude, countryCode: pin.countryCode },
      expiresAt: Date.now() + ttl,
    }));
  } catch { /* Search works without browser storage. */ }
}
