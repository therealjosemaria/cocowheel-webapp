import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import {
  initializeCoreSchema,
  createGuestSession,
  publishRide,
  requestRide,
  getRide,
  findSession,
  decideRequest,
} from "../server/core";
import { acceptWithVehicle } from "../server/vehicle-acceptance";
import { readVehicle, saveVehicle } from "../server/vehicles";
import { checkedVehicle } from "../lib/vehicle";
process.env.COCOWHEELS_CODE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
  "base64",
);

test("vehicle validation preserves plate text and rejects malformed fields", () => {
  assert.equal(checkedVehicle({ plate: " 001abc " }).plate, "001ABC");
  assert.equal(checkedVehicle({}).plate, "");
  for (const input of [
    null,
    { plate: 123 },
    { plate: "A".repeat(13) },
    { plate: "<script>" },
    { colour: "x\nwhite" },
    { make: "x".repeat(41) },
  ])
    assert.throws(() => checkedVehicle(input));
});

test("saved vehicle acceptance, immutable snapshot, other-rider privacy and legacy compatibility", () => {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  initializeCoreSchema(db);
  const account = (name: string) => {
    const guest = createGuestSession(db);
    db.prepare("INSERT INTO university_accounts VALUES (?,?,?)").run(
      name,
      guest.session.id,
      new Date().toISOString(),
    );
    const token = `verified-${name}`;
    db.prepare("INSERT INTO university_sessions VALUES (?,?,?,?)").run(
      createHash("sha256").update(token).digest("hex"),
      name,
      guest.session.id,
      "2099-01-01T00:00:00Z",
    );
    return { token, session: findSession(db, token)! };
  };
  try {
    const driver = account("driv1234"),
      rider = account("ride1234"),
      other = account("othe1234");
    const origin = { latitude: -33.88, longitude: 151.18 },
      destination = { latitude: -33.88, longitude: 151.28 };
    const offer = publishRide(db, driver.token, {
      origin,
      destination,
      scheduledDepartureAt: new Date().toISOString(),
      priceAud: 0,
    });
    const id = offer.ride.rideId;
    const join = (token: string) =>
      requestRide(db, token, id, {
        pickup: origin,
        destination,
        requestedDepartureAt: new Date().toISOString(),
      }).ride.request!.requestId;
    const req = join(rider.token),
      otherReq = join(other.token);
    const vehicle = saveVehicle(db, driver.session.id, {
      plate: "ABC123",
      make: "Toyota",
      model: "Corolla",
      colour: "White",
    });
    assert.equal(getRide(db, id, rider.session).vehicle, undefined);
    const accepted = acceptWithVehicle(db, driver.token, id, req);
    assert.deepEqual(accepted.vehicle, vehicle);
    assert.deepEqual(getRide(db, id, rider.session).vehicle, vehicle);
    assert.equal(getRide(db, id, other.session).vehicle, undefined);
    saveVehicle(db, driver.session.id, { plate: "NEW123" });
    assert.deepEqual(getRide(db, id, rider.session).vehicle, vehicle);
    assert.throws(() =>
      acceptWithVehicle(db, driver.token, id, otherReq, "BAD999"),
    );
    assert.equal(readVehicle(db, driver.session.id)?.plate, "NEW123");
    assert.equal((db.prepare("SELECT count(*) n FROM ride_vehicles").get() as { n: number }).n, 1);
    // Pre-feature accepted rides have no snapshot and remain readable.
    db.prepare("DELETE FROM ride_vehicles").run();
    assert.equal(getRide(db, id, rider.session).vehicle, undefined);
    assert.equal(getRide(db, id, rider.session).status, "ACCEPTED");
    assert.throws(() => decideRequest(db, driver.token, id, req, "ACCEPT"));
    assert.deepEqual(db.pragma("foreign_key_check"), []);
  } finally {
    db.close();
  }
});
