import type { Db } from "./core";
import { checkedVehicle, type Vehicle } from "../lib/vehicle";

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
  if (!vehicle.plate) throw new Error("VEHICLE_PLATE_REQUIRED");
  db.prepare(
    "INSERT INTO account_vehicles(principal_id, body) VALUES (?, ?) ON CONFLICT(principal_id) DO UPDATE SET body=excluded.body",
  ).run(principal, JSON.stringify(vehicle));
  return vehicle;
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
