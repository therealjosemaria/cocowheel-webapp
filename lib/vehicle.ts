import {
  validVehicleSelection,
  validVehicleYear,
  type VehicleSelection,
} from "./vehicle-catalogue";

export type Vehicle = {
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
/** Spaces and hyphens are retained; this is input validation, not a registry check. */
export function validPlate(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9 -]{0,8}$/.test(value.trim());
}
export function checkedVehicle(value: unknown): Vehicle {
  if (!value || typeof value !== "object") throw new Error("INVALID_VEHICLE");
  const raw = value as Record<string, unknown>;
  const result = { ...emptyVehicle };
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
  if (raw.year !== undefined) {
    if (typeof raw.year !== "string") throw new Error("INVALID_VEHICLE_YEAR");
    result.year = raw.year.trim();
    if (result.year && !validVehicleYear(result.year))
      throw new Error("INVALID_VEHICLE_YEAR");
  }
  if (raw.selection !== undefined) {
    result.selection = raw.selection as VehicleSelection;
    if (!validVehicleSelection(result)) throw new Error("INVALID_VEHICLE");
    result.selection = { ...result.selection };
  }
  return result;
}
