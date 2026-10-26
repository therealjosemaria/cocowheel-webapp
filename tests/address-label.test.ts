import { test } from "node:test";
import assert from "node:assert/strict";
import { compactAddressLabel } from "../lib/address-label";

test("compact selected addresses retain street and suburb without Australian administrative suffixes", () => {
  for (const [label, expected] of [
    ["20 King Street, Newtown NSW 2042, Australia", "20 King Street, Newtown"],
    ["20 King Street, Newtown, New South Wales, 2042, Australia", "20 King Street, Newtown"],
    ["Bondi Beach, NSW 2026, Australia", "Bondi Beach"],
    ["University of Sydney, NSW, Australia", "University of Sydney"],
    ["58,60,62 Mallett Street, Camperdown, NSW 2050, Australia", "58, 60, 62 Mallett Street, Camperdown"],
    ["Unit 4, 20 King Street, Newtown, NSW, Australia", "Unit 4, 20 King Street, Newtown"],
    ["Coolangatta, Queensland 4225, Australia", "Coolangatta"],
    ["20 Main Street, Port Victoria, SA 5573, Australia", "20 Main Street, Port Victoria"],
    ["University of Sydney", "University of Sydney"],
    ["Paris, Île-de-France, France", "Paris, Île-de-France, France"],
    ["Washington, WA 98001, USA", "Washington, WA 98001, USA"],
  ]) {
    const pin = Object.freeze({ latitude: -33.9, longitude: 151.2, label });
    assert.equal(compactAddressLabel(pin), expected);
    assert.equal(pin.label, label);
  }
});

test("compact labels handle missing labels and preserve ambiguous labels", () => {
  assert.equal(compactAddressLabel({ latitude: -33.9, longitude: 151.2 }), "-33.90000, 151.20000");
  assert.equal(compactAddressLabel({ latitude: 0, longitude: 0, label: "Australia" }), "Australia");
  assert.equal(compactAddressLabel({ latitude: 0, longitude: 0, label: "20 King Street, Newtown 2042", countryCode: "au" }), "20 King Street, Newtown");
});
