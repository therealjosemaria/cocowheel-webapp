/** Original 20 Australian models, followed by the 2026 luxury selection.
 * Selection is explicit; matching free text never opts a vehicle into artwork.
 * Research, generations and asset preparation: docs/VEHICLE_CATALOGUE.md.
 */
export const VEHICLE_MODELS = [
  {
    id: "ford-ranger",
    make: "Ford",
    year: "2025",
    yearFrom: 2022,
    yearTo: 2025,
    model: "Ranger",
  },
  {
    id: "toyota-rav4",
    make: "Toyota",
    year: "2019",
    yearFrom: 2019,
    yearTo: 2025,
    model: "RAV4",
  },
  {
    id: "toyota-hilux",
    make: "Toyota",
    year: "2024",
    yearFrom: 2024,
    yearTo: 2025,
    model: "HiLux",
  },
  {
    id: "isuzu-dmax",
    make: "Isuzu",
    year: "2024",
    yearFrom: 2024,
    yearTo: 2025,
    model: "D-Max",
  },
  {
    id: "ford-everest",
    make: "Ford",
    year: "2025",
    yearFrom: 2022,
    yearTo: 2025,
    model: "Everest",
  },
  {
    id: "toyota-prado",
    make: "Toyota",
    year: "2025",
    yearFrom: 2025,
    yearTo: 2025,
    model: "LandCruiser Prado",
  },
  {
    id: "hyundai-kona",
    make: "Hyundai",
    year: "2025",
    yearFrom: 2023,
    yearTo: 2025,
    model: "Kona",
  },
  {
    id: "mazda-cx5",
    make: "Mazda",
    year: "2025",
    yearFrom: 2022,
    yearTo: 2025,
    model: "CX-5",
  },
  {
    id: "mitsubishi-outlander",
    make: "Mitsubishi",
    year: "2025",
    yearFrom: 2025,
    yearTo: 2025,
    model: "Outlander",
  },
  {
    id: "tesla-modely",
    make: "Tesla",
    year: "2025",
    yearFrom: 2025,
    yearTo: 2025,
    model: "Model Y",
  },
  {
    id: "chery-tiggo4",
    make: "Chery",
    year: "2024",
    yearFrom: 2024,
    yearTo: 2025,
    model: "Tiggo 4 Pro",
  },
  {
    id: "hyundai-tucson",
    make: "Hyundai",
    year: "2025",
    yearFrom: 2025,
    yearTo: 2025,
    model: "Tucson",
  },
  {
    id: "mg-zs",
    make: "MG",
    year: "2026",
    yearFrom: 2025,
    yearTo: 2026,
    model: "ZS",
  },
  {
    id: "gwm-jolion",
    make: "GWM",
    year: "2024",
    yearFrom: 2021,
    yearTo: 2025,
    model: "Haval Jolion",
  },
  {
    id: "kia-sportage",
    make: "Kia",
    year: "2024",
    yearFrom: 2022,
    yearTo: 2024,
    model: "Sportage",
  },
  {
    id: "toyota-corolla",
    make: "Toyota",
    year: "2018",
    yearFrom: 2018,
    yearTo: 2022,
    model: "Corolla",
  },
  {
    id: "mitsubishi-triton",
    make: "Mitsubishi",
    year: "2025",
    yearFrom: 2024,
    yearTo: 2025,
    model: "Triton",
  },
  {
    id: "byd-shark6",
    make: "BYD",
    year: "2025",
    yearFrom: 2025,
    yearTo: 2025,
    model: "Shark 6",
  },
  {
    id: "nissan-xtrail",
    make: "Nissan",
    year: "2025",
    yearFrom: 2023,
    yearTo: 2025,
    model: "X-Trail",
  },
  {
    id: "isuzu-mux",
    make: "Isuzu",
    year: "2025",
    yearFrom: 2025,
    yearTo: 2025,
    model: "MU-X",
  },
  { id: "lexus-nx", make: "Lexus", model: "NX", year: "2022", yearFrom: 2022, yearTo: 2026 },
  { id: "bmw-x3", make: "BMW", model: "X3", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "bmw-x1", make: "BMW", model: "X1", year: "2023", yearFrom: 2023, yearTo: 2026 },
  { id: "mercedes-glc", make: "Mercedes-Benz", model: "GLC", year: "2023", yearFrom: 2023, yearTo: 2026 },
  { id: "landrover-defender", make: "Land Rover", model: "Defender", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "mercedes-gla", make: "Mercedes-Benz", model: "GLA", year: "2024", yearFrom: 2024, yearTo: 2026 },
  { id: "bmw-x5", make: "BMW", model: "X5", year: "2023", yearFrom: 2023, yearTo: 2026 },
  { id: "audi-q5", make: "Audi", model: "Q5", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "volvo-xc40", make: "Volvo", model: "XC40", year: "2023", yearFrom: 2023, yearTo: 2026 },
  { id: "mini-cooper", make: "MINI", model: "Cooper", year: "2024", yearFrom: 2024, yearTo: 2026 },
  { id: "audi-q3", make: "Audi", model: "Q3", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "lexus-rx", make: "Lexus", model: "RX", year: "2023", yearFrom: 2023, yearTo: 2026 },
  { id: "mini-countryman", make: "MINI", model: "Countryman", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "mercedes-aclass", make: "Mercedes-Benz", model: "A-Class", year: "2024", yearFrom: 2024, yearTo: 2026 },
  { id: "audi-a3", make: "Audi", model: "A3", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "bmw-x2", make: "BMW", model: "X2", year: "2024", yearFrom: 2024, yearTo: 2026 },
  { id: "volvo-ex30", make: "Volvo", model: "EX30", year: "2024", yearFrom: 2024, yearTo: 2026 },
  { id: "mercedes-glccoupe", make: "Mercedes-Benz", model: "GLC Coupe", year: "2024", yearFrom: 2024, yearTo: 2026 },
  { id: "ferrari-purosangue", make: "Ferrari", model: "Purosangue", year: "2024", yearFrom: 2024, yearTo: 2026 },
  { id: "lamborghini-urus", make: "Lamborghini", model: "Urus SE", year: "2025", yearFrom: 2025, yearTo: 2026 },
] as const;

export const VEHICLE_MAKES = [
  ...new Set(VEHICLE_MODELS.map((item) => item.make)),
].sort();
export const VEHICLE_COLOURS = [
  "White",
  "Black",
  "Silver",
  "Blue",
  "Grey",
  "Red",
] as const;
const MODEL_LABELS: Record<string, string> = {
  "ford-ranger": "Ranger (dual cab)",
  "toyota-hilux": "HiLux (SR5 dual cab)",
  "isuzu-dmax": "D-Max (dual cab)",
  "hyundai-kona": "Kona (petrol/hybrid)",
  "tesla-modely": "Model Y (2025 refresh)",
  "gwm-jolion": "Haval Jolion (petrol)",
  "toyota-corolla": "Corolla (hatchback)",
  "mitsubishi-triton": "Triton (dual cab)",
  "byd-shark6": "Shark 6 (dual cab)",
  "mercedes-glc": "GLC (SUV)",
  "landrover-defender": "Defender (110)",
  "mini-cooper": "Cooper (3-door petrol)",
  "mercedes-aclass": "A-Class (hatchback)",
  "audi-a3": "A3 (Sportback)",
  "volvo-ex30": "EX30 (standard)",
};
export function vehicleModelLabel(
  model: (typeof VEHICLE_MODELS)[number],
): string {
  return MODEL_LABELS[model.id] ?? model.model;
}
export type VehicleSelection = {
  make?: string;
  model?: string;
  colour?: string;
  year?: string;
};
type VehicleDescription = {
  make: string;
  model: string;
  colour: string;
  year?: string;
  selection?: VehicleSelection;
};

// Each illustration is tied to a researched body era. Do not silently expand
// that era to another facelift/body with the same make/model name.
export function validVehicleYear(value: string): boolean {
  return (
    /^(18|19|20)\d{2}$/.test(value) &&
    Number(value) <= new Date().getUTCFullYear() + 1
  );
}
export function vehicleYearOptions(modelId?: string) {
  const model = VEHICLE_MODELS.find((item) => item.id === modelId);
  return model
    ? Array.from({ length: model.yearTo - model.yearFrom + 1 }, (_, index) =>
        String(model.yearTo - index),
      )
    : [];
}

/** Validate stored selection against canonical text, including partial selections. */
export function validVehicleSelection(vehicle: VehicleDescription): boolean {
  const choice = vehicle.selection;
  if (!choice || typeof choice !== "object" || Array.isArray(choice))
    return false;
  if (
    Object.keys(choice).some(
      (key) => !["make", "model", "colour", "year"].includes(key),
    )
  )
    return false;
  if (
    choice.make !== undefined &&
    (!VEHICLE_MAKES.some((make) => make === choice.make) ||
      vehicle.make !== choice.make)
  )
    return false;
  if (choice.model !== undefined) {
    const model = VEHICLE_MODELS.find((item) => item.id === choice.model);
    if (
      !model ||
      choice.make !== model.make ||
      vehicle.make !== model.make ||
      vehicle.model !== model.model
    )
      return false;
  }
  if (
    choice.colour !== undefined &&
    (!VEHICLE_COLOURS.some((colour) => colour === choice.colour) ||
      vehicle.colour !== choice.colour)
  )
    return false;
  if (
    choice.year !== undefined &&
    (typeof choice.year !== "string" ||
      !validVehicleYear(choice.year) ||
      choice.year !== vehicle.year ||
      !vehicleYearOptions(choice.model).includes(choice.year))
  )
    return false;
  return true;
}

/** Returns only a static local URL; never interpolates arbitrary user text. */
export function vehicleArtwork(
  vehicle?: VehicleDescription,
): string | undefined {
  if (!vehicle || !validVehicleSelection(vehicle)) return;
  const choice = vehicle.selection!;
  if (
    !choice.make ||
    !choice.model ||
    !choice.colour ||
    !choice.year ||
    !vehicleYearOptions(choice.model).includes(choice.year)
  )
    return;
  return `/brand/vehicles/v1/${choice.model}-${choice.colour.toLowerCase()}.webp`;
}

const artworkPaths = new Set(VEHICLE_MODELS.flatMap(model =>
  VEHICLE_COLOURS.map(colour => `/brand/vehicles/v1/${model.id}-${colour.toLowerCase()}.webp`)));
/** Public projections can carry only one of our shipped artwork paths. */
export function isVehicleArtworkPath(value: unknown): value is string {
  return typeof value === "string" && artworkPaths.has(value);
}

/** Refresh corrected artwork without changing the allowlisted API paths. */
export function vehicleArtworkDisplayPath(path: string): string {
  return /^\/brand\/vehicles\/v1\/(byd-shark6|isuzu-dmax|toyota-rav4)-/.test(path)
    ? `${path}?background=2`
    : path;
}
