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
  { id: "toyota-yaris", make: "Toyota", model: "Yaris", year: "2024", yearFrom: 2024, yearTo: 2026 },
  { id: "toyota-yaris-cross", make: "Toyota", model: "Yaris Cross", year: "2024", yearFrom: 2024, yearTo: 2026 },
  { id: "toyota-corolla-cross", make: "Toyota", model: "Corolla Cross", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "toyota-camry", make: "Toyota", model: "Camry", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "mazda-mazda2", make: "Mazda", model: "Mazda2", year: "2023", yearFrom: 2023, yearTo: 2026 },
  { id: "mazda-mazda3", make: "Mazda", model: "Mazda3", year: "2024", yearFrom: 2024, yearTo: 2026 },
  { id: "mazda-cx-3", make: "Mazda", model: "CX-3", year: "2024", yearFrom: 2024, yearTo: 2026 },
  { id: "mazda-cx-30", make: "Mazda", model: "CX-30", year: "2024", yearFrom: 2024, yearTo: 2026 },
  { id: "suzuki-swift", make: "Suzuki", model: "Swift", year: "2024", yearFrom: 2024, yearTo: 2026 },
  { id: "suzuki-fronx", make: "Suzuki", model: "Fronx", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "suzuki-jimny", make: "Suzuki", model: "Jimny", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "hyundai-i30-sedan", make: "Hyundai", model: "i30", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "hyundai-venue", make: "Hyundai", model: "Venue", year: "2023", yearFrom: 2023, yearTo: 2026 },
  { id: "kia-picanto", make: "Kia", model: "Picanto", year: "2024", yearFrom: 2024, yearTo: 2026 },
  { id: "kia-k4", make: "Kia", model: "K4", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "kia-stonic", make: "Kia", model: "Stonic", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "kia-seltos", make: "Kia", model: "Seltos", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "mg-mg3", make: "MG", model: "MG3", year: "2024", yearFrom: 2024, yearTo: 2026 },
  { id: "mg-mg4", make: "MG", model: "MG4 EV Urban", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "mg-hs", make: "MG", model: "HS", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "chery-tiggo-7", make: "Chery", model: "Tiggo 7", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "chery-tiggo-8-super-hybrid", make: "Chery", model: "Tiggo 8 Super Hybrid", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "byd-atto-1", make: "BYD", model: "Atto 1", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "byd-atto-2", make: "BYD", model: "Atto 2", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "byd-atto-3", make: "BYD", model: "Atto 3 Evo", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "byd-dolphin", make: "BYD", model: "Dolphin", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "byd-sealion-6", make: "BYD", model: "Sealion 6", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "gwm-haval-h6", make: "GWM", model: "Haval H6", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "gwm-ora-5", make: "GWM", model: "Ora 5", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "geely-ex5", make: "Geely", model: "EX5", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "geely-ex2", make: "Geely", model: "EX2", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "jaecoo-j5", make: "Jaecoo", model: "J5", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "jaecoo-j7", make: "Jaecoo", model: "J7", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "gac-emzoom", make: "GAC", model: "Emzoom", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "gac-aion-ut", make: "GAC", model: "Aion UT", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "mahindra-xuv-3xo", make: "Mahindra", model: "XUV 3XO", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "nissan-qashqai", make: "Nissan", model: "Qashqai", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "mitsubishi-asx", make: "Mitsubishi", model: "ASX", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "subaru-crosstrek", make: "Subaru", model: "Crosstrek", year: "2023", yearFrom: 2023, yearTo: 2026 },
  { id: "honda-hr-v", make: "Honda", model: "HR-V", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "ferrari-12cilindri", make: "Ferrari", model: "12Cilindri", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "ferrari-amalfi", make: "Ferrari", model: "Amalfi", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "ferrari-296-speciale", make: "Ferrari", model: "296 Speciale", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "ferrari-f80", make: "Ferrari", model: "F80", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "lamborghini-revuelto", make: "Lamborghini", model: "Revuelto", year: "2024", yearFrom: 2024, yearTo: 2026 },
  { id: "lamborghini-temerario", make: "Lamborghini", model: "Temerario", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "aston-martin-vanquish", make: "Aston Martin", model: "Vanquish", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "aston-martin-db12", make: "Aston Martin", model: "DB12", year: "2024", yearFrom: 2024, yearTo: 2026 },
  { id: "aston-martin-vantage", make: "Aston Martin", model: "Vantage", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "aston-martin-dbx707", make: "Aston Martin", model: "DBX707", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "bentley-continental-gt", make: "Bentley", model: "Continental GT", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "bentley-flying-spur", make: "Bentley", model: "Flying Spur", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "bentley-bentayga", make: "Bentley", model: "Bentayga", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "rolls-royce-spectre", make: "Rolls-Royce", model: "Spectre", year: "2024", yearFrom: 2024, yearTo: 2026 },
  { id: "rolls-royce-ghost", make: "Rolls-Royce", model: "Ghost", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "rolls-royce-cullinan", make: "Rolls-Royce", model: "Cullinan", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "rolls-royce-phantom", make: "Rolls-Royce", model: "Phantom", year: "2023", yearFrom: 2023, yearTo: 2026 },
  { id: "mclaren-750s", make: "McLaren", model: "750S", year: "2024", yearFrom: 2024, yearTo: 2026 },
  { id: "mclaren-artura", make: "McLaren", model: "Artura", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "mclaren-w1", make: "McLaren", model: "W1", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "mclaren-gts", make: "McLaren", model: "GTS", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "porsche-911", make: "Porsche", model: "911", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "porsche-taycan", make: "Porsche", model: "Taycan", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "porsche-panamera", make: "Porsche", model: "Panamera", year: "2024", yearFrom: 2024, yearTo: 2026 },
  { id: "porsche-cayenne", make: "Porsche", model: "Cayenne", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "mercedes-amg-gt-coupe", make: "Mercedes-Benz", model: "AMG GT", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "mercedes-benz-g-class", make: "Mercedes-Benz", model: "G-Class", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "mercedes-maybach-s-class", make: "Mercedes-Benz", model: "Maybach S-Class", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "mercedes-amg-sl", make: "Mercedes-Benz", model: "AMG SL", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "bmw-xm", make: "BMW", model: "XM", year: "2023", yearFrom: 2023, yearTo: 2026 },
  { id: "bmw-i7", make: "BMW", model: "i7", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "audi-rs6-avant", make: "Audi", model: "RS6 Avant", year: "2025", yearFrom: 2025, yearTo: 2025 },
  { id: "audi-rs7-sportback", make: "Audi", model: "RS7 Sportback", year: "2025", yearFrom: 2025, yearTo: 2025 },
  { id: "audi-rs-q8", make: "Audi", model: "RS Q8", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "audi-rs-e-tron-gt", make: "Audi", model: "RS e-tron GT", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "maserati-mcpura", make: "Maserati", model: "MCPura", year: "2026", yearFrom: 2026, yearTo: 2026 },
  { id: "maserati-granturismo", make: "Maserati", model: "GranTurismo", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "lotus-emira", make: "Lotus", model: "Emira", year: "2025", yearFrom: 2025, yearTo: 2026 },
  { id: "koenigsegg-jesko", make: "Koenigsegg", model: "Jesko", year: "2025", yearFrom: 2025, yearTo: 2025 },
  { id: "pagani-utopia", make: "Pagani", model: "Utopia", year: "2025", yearFrom: 2025, yearTo: 2025 },
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
  "toyota-yaris": "Yaris (hatchback)",
  "mazda-mazda2": "Mazda2 (hatchback)",
  "mazda-mazda3": "Mazda3 (hatchback)",
  "suzuki-jimny": "Jimny (3-door)",
  "hyundai-i30-sedan": "i30 (sedan)",
  "kia-k4": "K4 (hatchback)",
  "ferrari-12cilindri": "12Cilindri (coupe)",
  "ferrari-amalfi": "Amalfi (coupe)",
  "ferrari-296-speciale": "296 Speciale (coupe)",
  "bentley-continental-gt": "Continental GT (coupe)",
  "rolls-royce-ghost": "Ghost (Series II)",
  "rolls-royce-cullinan": "Cullinan (Series II)",
  "rolls-royce-phantom": "Phantom (Series II)",
  "mclaren-750s": "750S (coupe)",
  "mclaren-artura": "Artura (coupe)",
  "porsche-911": "911 (Turbo S coupe)",
  "porsche-taycan": "Taycan (sedan)",
  "porsche-cayenne": "Cayenne (SUV)",
  "mercedes-amg-gt-coupe": "AMG GT (coupe)",
  "mercedes-amg-sl": "AMG SL (roadster)",
  "audi-rs6-avant": "RS6 Avant (performance)",
  "audi-rs7-sportback": "RS7 Sportback (performance)",
  "maserati-mcpura": "MCPura (coupe)",
  "maserati-granturismo": "GranTurismo (coupe)",
  "koenigsegg-jesko": "Jesko (Attack)",
  "pagani-utopia": "Utopia (coupe)",
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
