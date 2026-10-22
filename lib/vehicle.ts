export type Vehicle = {
  plate: string;
  make: string;
  model: string;
  colour: string;
};
export const emptyVehicle: Vehicle = {
  plate: "",
  make: "",
  model: "",
  colour: "",
};
export function checkedVehicle(value: unknown): Vehicle {
  if (!value || typeof value !== "object") throw new Error("INVALID_VEHICLE");
  const raw = value as Record<string, unknown>;
  const result = { ...emptyVehicle };
  for (const key of Object.keys(result) as (keyof Vehicle)[]) {
    if (raw[key] !== undefined && typeof raw[key] !== "string")
      throw new Error("INVALID_VEHICLE");
    const text = ((raw[key] as string | undefined) ?? "").trim();
    if (
      text.length > (key === "plate" ? 12 : 40) ||
      /[\u0000-\u001f\u007f]/.test(text)
    )
      throw new Error("INVALID_VEHICLE");
    result[key] = key === "plate" ? text.toUpperCase() : text;
  }
  if (result.plate && !/^[A-Z0-9][A-Z0-9 -]*$/.test(result.plate))
    throw new Error("INVALID_VEHICLE_PLATE");
  return result;
}
