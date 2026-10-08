import type { Pin } from "./core";

type GeoapifyFeature = {
  properties?: {
    name?: unknown;
    address_line1?: unknown;
    formatted?: unknown;
  };
};
type GeoapifyResult = NonNullable<GeoapifyFeature["properties"]>;
type GeoapifyResponse = {
  results?: GeoapifyResult[];
  features?: GeoapifyFeature[];
};

function conciseLabel(properties: GeoapifyFeature["properties"]) {
  if (!properties) return null;
  const candidates = [
    properties.name,
    properties.address_line1,
    properties.formatted,
  ];
  const label = candidates.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.trim().length > 0,
  );
  return label ? label.trim().slice(0, 96) : null;
}

export async function reversePlaceLabel(
  pin: Pin,
  apiKey = process.env.COCOWHEELS_GEOAPIFY_KEY,
  fetcher: typeof fetch = fetch,
) {
  if (!apiKey) throw new Error("PLACE_LOOKUP_UNAVAILABLE");
  const url = new URL("https://api.geoapify.com/v1/geocode/reverse");
  url.searchParams.set("lat", String(pin.latitude));
  url.searchParams.set("lon", String(pin.longitude));
  url.searchParams.set("format", "json");
  url.searchParams.set("apiKey", apiKey);
  let response: Response;
  try {
    response = await fetcher(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4_000),
    });
  } catch {
    throw new Error("PLACE_LOOKUP_UNAVAILABLE");
  }
  if (!response.ok) throw new Error("PLACE_LOOKUP_UNAVAILABLE");
  const payload = (await response.json()) as GeoapifyResponse;
  return conciseLabel(
    payload.results?.[0] ?? payload.features?.[0]?.properties,
  );
}

export async function searchPlaces(
  text: string,
  apiKey = process.env.COCOWHEELS_GEOAPIFY_KEY,
  fetcher: typeof fetch = fetch,
): Promise<Pin[]> {
  if (!apiKey || text.trim().length < 3) return [];
  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  url.searchParams.set("text", text.trim().slice(0, 160));
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("apiKey", apiKey);
  try {
    const response = await fetcher(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(4_000) });
    if (!response.ok) return [];
    const payload = (await response.json()) as { results?: Array<{ lat?: unknown; lon?: unknown; formatted?: unknown; address_line1?: unknown }> };
    return (payload.results ?? []).flatMap((place) =>
      typeof place.lat === "number" && typeof place.lon === "number"
        ? [{ latitude: place.lat, longitude: place.lon, label: conciseLabel(place as GeoapifyFeature["properties"]) ?? undefined }]
        : [],
    );
  } catch {
    return [];
  }
}
