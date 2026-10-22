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
