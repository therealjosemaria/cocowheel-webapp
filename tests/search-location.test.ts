import test from "node:test";
import assert from "node:assert/strict";
import { rememberSearchLocation, searchLocation } from "../lib/search-location";

test("shared search preference is replaceable, short-lived and optional", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  let stored: string | null = null;
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; },
  } });
  try {
    assert.equal(searchLocation(), undefined);
    rememberSearchLocation({ latitude: 40, longitude: -74, countryCode: "us", label: "Not stored" });
    assert.equal(searchLocation()?.countryCode, "us");
    rememberSearchLocation({ latitude: -33, longitude: 151, countryCode: "au" });
    assert.equal(searchLocation()?.countryCode, "au");
    assert.equal(stored?.includes("Not stored"), false);
    stored = JSON.stringify({ pin: { latitude: 999, longitude: 1 }, expiresAt: Date.now() + 1000 });
    assert.equal(searchLocation(), undefined);
    stored = JSON.stringify({ pin: { latitude: 1, longitude: 1 }, expiresAt: Date.now() - 1 });
    assert.equal(searchLocation(), undefined);
    stored = "broken";
    assert.equal(searchLocation(), undefined);
    Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get() { throw Error("blocked"); } });
    assert.equal(searchLocation(), undefined);
    assert.doesNotThrow(() => rememberSearchLocation({ latitude: 1, longitude: 1 }));
  } finally {
    if (previous) Object.defineProperty(globalThis, "sessionStorage", previous);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
});

test("a selected search result persists only its country for seven days across new-tab location resets", async () => {
  const { storedCountryPreference } = await import("../lib/search-location");
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousSession = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const local = new Map<string, string>();
  let tabLocation: string | null = null;
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: {
    getItem: (key: string) => local.get(key) ?? null,
    setItem: (key: string, value: string) => local.set(key, value),
    removeItem: (key: string) => local.delete(key),
  } } });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: () => tabLocation, setItem: (_key: string, value: string) => { tabLocation = value; },
  } });
  try {
    const before = Date.now();
    rememberSearchLocation({ latitude: -33.92, longitude: 151.2, countryCode: "AU", label: "Private label not retained" });
    const saved = JSON.parse(local.get("cocowheels:country-preference:v1")!);
    assert.equal(saved.countryCode, "au");
    assert.ok(saved.expiresAt >= before + 7 * 86_400_000 && saved.expiresAt <= Date.now() + 7 * 86_400_000);
    assert.deepEqual(Object.keys(saved).sort(), ["countryCode", "expiresAt"]);
    tabLocation = null; // A new tab has no precise location preference.
    assert.equal(searchLocation(), undefined);
    assert.equal(storedCountryPreference(), "au");
    rememberSearchLocation({ latitude: 48.86, longitude: 2.35, countryCode: "fr" });
    assert.equal(storedCountryPreference(), "fr");
    Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get() { throw Error("blocked"); } });
    assert.doesNotThrow(() => rememberSearchLocation({ latitude: -33, longitude: 151, countryCode: "au" }));
    assert.equal(storedCountryPreference(), "au");
    for (const value of ["broken", JSON.stringify({ countryCode: "invalid", expiresAt: Date.now() + 1000 }), JSON.stringify({ countryCode: "au", expiresAt: Date.now() - 1 })]) {
      local.set("cocowheels:country-preference:v1", value);
      assert.equal(storedCountryPreference(), null);
    }
    Object.defineProperty(globalThis, "window", { configurable: true, value: { get localStorage() { throw Error("blocked"); } } });
    assert.equal(storedCountryPreference(), null);
    assert.doesNotThrow(() => rememberSearchLocation({ latitude: 1, longitude: 1, countryCode: "au" }));
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow); else Reflect.deleteProperty(globalThis, "window");
    if (previousSession) Object.defineProperty(globalThis, "sessionStorage", previousSession); else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
});
