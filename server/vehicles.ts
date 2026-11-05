import type { Db } from "./core";
import { checkedVehicle, requirePassengerVehicle, type Vehicle } from "../lib/vehicle";

export function initializeVehicles(db: Db) {
  db.exec(`CREATE TABLE IF NOT EXISTS account_vehicles (
    principal_id TEXT PRIMARY KEY REFERENCES guest_sessions(id), body TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ride_vehicles (
    ride_id TEXT PRIMARY KEY REFERENCES rides(id), body TEXT NOT NULL
  );`);
}
export function readVehicle(db: Db, principal: string): Vehicle | null {
  const row = db
    .prepare("SELECT body FROM account_vehicles WHERE principal_id = ?")
    .get(principal) as { body: string } | undefined;
  return row ? JSON.parse(row.body) : null;
}
export function saveVehicle(
  db: Db,
  principal: string,
  input: unknown,
): Vehicle {
  const vehicle = checkedVehicle(input);
  requirePassengerVehicle(vehicle);
  db.prepare(
    "INSERT INTO account_vehicles(principal_id, body) VALUES (?, ?) ON CONFLICT(principal_id) DO UPDATE SET body=excluded.body",
  ).run(principal, JSON.stringify(vehicle));
  return vehicle;
}
/** Profile edits cannot change the car committed to a driver's ongoing journey. */
export function saveProfileVehicle(db: Db, principal: string, input: unknown): Vehicle {
  return db.transaction(() => {
    const paired = db.prepare(
      "SELECT 1 FROM rides WHERE driver_session_id=? AND status IN ('ACCEPTED','RIDE_ACTIVE','CO_RIDE_ACTIVE') LIMIT 1",
    ).get(principal);
    if (paired) throw new Error("VEHICLE_IN_USE");
    const checked = checkedVehicle(input);
    if (checked.type === "bicycle" && db.prepare(
      "SELECT 1 FROM rides WHERE driver_session_id=? AND status IN ('PUBLISHED','REQUESTED') AND price_aud>0 LIMIT 1",
    ).get(principal)) throw new Error("BICYCLE_PAID_POST");
    const now = new Date().toISOString();
    if (checked.type === "bicycle" && db.prepare(`
      SELECT 1 FROM rider_demand_proposals p
      JOIN rides r ON r.id=p.source_ride_id
      JOIN rider_demands d ON d.id=p.demand_id
      WHERE r.driver_session_id=? AND r.status IN ('PUBLISHED','REQUESTED')
        AND p.status='PENDING' AND d.status='OPEN' AND d.expires_at>?
        AND json_extract(p.body,'$.scheduledDepartureAt')>?
        AND json_extract(p.body,'$.priceAud')>0
        AND NOT EXISTS (SELECT 1 FROM rider_demand_offer_withdrawals w WHERE w.offer_id=p.id)
      LIMIT 1
    `).get(principal, now, now))
      throw new Error("BICYCLE_PAID_OFFER");
    return saveVehicle(db, principal, input);
  }).immediate();
}
export function snapshotVehicle(db: Db, rideId: string, vehicle: Vehicle) {
  db.prepare(
    "INSERT INTO ride_vehicles(ride_id, body) SELECT id, ? FROM rides WHERE public_id = ?",
  ).run(JSON.stringify(vehicle), rideId);
}
export function rideVehicle(db: Db, id: string): Vehicle | undefined {
  const row = db
    .prepare("SELECT body FROM ride_vehicles WHERE ride_id = ?")
    .get(id) as { body: string } | undefined;
  return row ? JSON.parse(row.body) : undefined;
}
