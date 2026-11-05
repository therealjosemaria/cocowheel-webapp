import {
  validVehicleSelection,
  validVehicleYear,
  type VehicleSelection,
} from "./vehicle-catalogue";

export type Vehicle = {
  type?: "car" | "bicycle";
  passengerReady?: boolean;
  plate: string;
  make: string;
  model: string;
  colour: string;
  year?: string;
  selection?: VehicleSelection;
};
export const emptyVehicle: Vehicle = {
  plate: "",
  make: "",
  model: "",
  colour: "",
};
export const PLATE_ERROR =
  "Use up to 9 letters, numbers, spaces or hyphens, starting with a letter or number.";
export const VEHICLE_YEAR_ERROR =
  "Choose your vehicle’s year, or enter a valid four-digit year.";
export const VEHICLE_IN_USE_MESSAGE =
  "You can update your vehicle after your current journey ends.";
/** Spaces and hyphens are retained; this is input validation, not a registry check. */
export function validPlate(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9 -]{0,8}$/.test(value.trim());
}
export function checkedVehicle(value: unknown): Vehicle {
  if (!value || typeof value !== "object") throw new Error("INVALID_VEHICLE");
  const raw = value as Record<string, unknown>;
  const result = { ...emptyVehicle };
  if (raw.type !== undefined && raw.type !== "car" && raw.type !== "bicycle")
    throw new Error("INVALID_VEHICLE");
  if (raw.type !== undefined) result.type = raw.type;
  if (raw.passengerReady !== undefined && typeof raw.passengerReady !== "boolean")
    throw new Error("INVALID_VEHICLE");
  if (raw.type === "bicycle") {
    if (raw.passengerReady !== true) throw new Error("BICYCLE_SEAT_REQUIRED");
    result.passengerReady = true;
  } else if (raw.passengerReady !== undefined) throw new Error("INVALID_VEHICLE");
  for (const key of ["plate", "make", "model", "colour"] as const) {
    if (raw[key] !== undefined && typeof raw[key] !== "string")
      throw new Error("INVALID_VEHICLE");
    const text = ((raw[key] as string | undefined) ?? "").trim();
    if (
      (key !== "plate" && text.length > 40) ||
      /[\u0000-\u001f\u007f]/.test(text)
    )
      throw new Error("INVALID_VEHICLE");
    result[key] = key === "plate" ? text.toUpperCase() : text;
  }
  if (result.plate && !validPlate(result.plate))
    throw new Error("INVALID_VEHICLE_PLATE");
  if (result.type === "bicycle" && result.plate) throw new Error("INVALID_VEHICLE");
  if (raw.year !== undefined) {
    if (typeof raw.year !== "string") throw new Error("INVALID_VEHICLE_YEAR");
    result.year = raw.year.trim();
    if (result.year && !validVehicleYear(result.year))
      throw new Error("INVALID_VEHICLE_YEAR");
  }
  if (raw.selection !== undefined) {
    if (result.type === "bicycle") throw new Error("INVALID_VEHICLE");
    result.selection = raw.selection as VehicleSelection;
    if (!validVehicleSelection(result)) throw new Error("INVALID_VEHICLE");
    result.selection = { ...result.selection };
  }
  return result;
}

/** Legacy saved records are cars; bicycle eligibility is explicitly declared. */
export function requirePassengerVehicle(vehicle: Vehicle | null | undefined): asserts vehicle is Vehicle {
  if (vehicle?.type === "bicycle") {
    if (vehicle.passengerReady !== true) throw new Error("BICYCLE_SEAT_REQUIRED");
  } else if (!vehicle?.plate) throw new Error("VEHICLE_PLATE_REQUIRED");
}
