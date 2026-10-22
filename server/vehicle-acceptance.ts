import { decideRequest, type Db } from "./core";
import { requireUniversitySession } from "./university-auth";
import { readVehicle, saveVehicle, snapshotVehicle } from "./vehicles";
import { emptyVehicle } from "../lib/vehicle";

/** Acceptance, optional account update and immutable trip snapshot commit together. */
export function acceptWithVehicle(
  db: Db,
  token: string | null,
  rideId: string,
  requestId: string,
  plate?: unknown,
) {
  const owner = requireUniversitySession(db, token);
  return db.transaction(() => {
    // Authorize and validate the transition first; any later error rolls it back.
    const ride = decideRequest(db, token, rideId, requestId, "ACCEPT");
    let vehicle = readVehicle(db, owner.id);
    if (plate !== undefined)
      vehicle = saveVehicle(db, owner.id, {
        ...(vehicle ?? emptyVehicle),
        plate,
      });
    if (!vehicle?.plate) throw new Error("VEHICLE_PLATE_REQUIRED");
    snapshotVehicle(db, rideId, vehicle);
    return { ...ride, vehicle };
  })();
}
