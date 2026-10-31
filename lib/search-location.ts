import type { Pin } from "./client-types";
import { normalizeCountryHint } from "./country-hint";

const key = "cocowheels:search-location:v1";
const ttl = 30 * 60 * 1000;
const countryPreferenceKey = "cocowheels:country-preference:v1";
const countryPreferenceTtlMs = 7 * 24 * 60 * 60 * 1_000;

export function storedCountryPreference() {
  if (typeof window === "undefined") return null;
  try {
    const value: unknown = JSON.parse(
      window.localStorage.getItem(countryPreferenceKey) ?? "null",
    );
    if (
      !value ||
      typeof value !== "object" ||
      !("countryCode" in value) ||
      !("expiresAt" in value) ||
      typeof value.countryCode !== "string" ||
      !/^[a-z]{2}$/i.test(value.countryCode) ||
      typeof value.expiresAt !== "number" ||
      value.expiresAt <= Date.now()
    ) {
      window.localStorage.removeItem(countryPreferenceKey);
      return null;
    }
    return value.countryCode.toLowerCase();
  } catch {
    return null;
  }
}
export function storeCountryPreference(countryCode?: string) {
  if (typeof window === "undefined" || typeof countryCode !== "string" || !/^[a-z]{2}$/i.test(countryCode)) return;
  try {
    window.localStorage.setItem(
      countryPreferenceKey,
      JSON.stringify({
        countryCode: countryCode.toLowerCase(),
        expiresAt: Date.now() + countryPreferenceTtlMs,
      }),
    );
  } catch {
    // Searching still works if local browser storage is unavailable.
  }
}

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
  storeCountryPreference(pin.countryCode);
  try {
    sessionStorage.setItem(key, JSON.stringify({
      pin: { latitude: pin.latitude, longitude: pin.longitude, countryCode: pin.countryCode },
      expiresAt: Date.now() + ttl,
    }));
  } catch { /* Search works without browser storage. */ }
}

// Country only, once per document. Never persist an inferred hint as a selection.
let ipCountryRequest: Promise<string | null> | undefined;
export function ipCountryHint(): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  return ipCountryRequest ??= fetch("/search-country", {
    cache: "no-store", credentials: "omit", signal: AbortSignal.timeout(1500),
  }).then(async response => {
    if (!response.ok) return null;
    const value: unknown = await response.json();
    return value && typeof value === "object" && "countryCode" in value
      ? normalizeCountryHint(value.countryCode) : null;
  }).catch(() => null);
}
