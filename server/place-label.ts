import type { Db, Pin } from "./core";
import { searchInputError } from "../lib/input-validation";
import { cachePlaceLookup, cachedPlaceLookup } from "./provider-cache";

type GeoapifyFeature = {
  properties?: {
    name?: unknown;
    address_line1?: unknown;
    formatted?: unknown;
    country_code?: unknown;
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
  database?: Db,
) {
  return (await reversePlaceDetails(pin, apiKey, fetcher, database)).label;
}

export async function reversePlaceDetails(
  pin: Pin,
  apiKey = process.env.COCOWHEELS_GEOAPIFY_KEY,
  fetcher: typeof fetch = fetch,
  database?: Db,
) {
  const cached = cachedPlaceLookup(database, pin);
  if (cached) return cached;
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
  const properties = payload.results?.[0] ?? payload.features?.[0]?.properties;
  const countryCode = properties?.country_code;
  const place = {
    label: conciseLabel(properties),
    countryCode:
      typeof countryCode === "string" && /^[a-z]{2}$/i.test(countryCode)
        ? countryCode.toLowerCase()
        : null,
  };
  cachePlaceLookup(database, pin, place);
  return place;
}

export async function searchPlaces(
  text: string,
  bias?: Pin,
  countryCode?: string,
  apiKey = process.env.COCOWHEELS_GEOAPIFY_KEY,
  fetcher: typeof fetch = fetch,
): Promise<Pin[]> {
  if (searchInputError(text)) throw new Error("INVALID_SEARCH_TEXT");
  if (!apiKey || text.trim().length < 3) return [];
  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  url.searchParams.set("text", text.trim());
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "10");
  if (countryCode && /^[a-z]{2}$/i.test(countryCode))
    url.searchParams.set("filter", `countrycode:${countryCode.toLowerCase()}`);
  if (bias)
    url.searchParams.set(
      "bias",
      `proximity:${bias.longitude},${bias.latitude}`,
    );
  url.searchParams.set("apiKey", apiKey);
  try {
    const response = await fetcher(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as {
      results?: Array<{
        lat?: unknown;
        lon?: unknown;
        formatted?: unknown;
        address_line1?: unknown;
      }>;
    };
    return (payload.results ?? []).flatMap((place) =>
      typeof place.lat === "number" && typeof place.lon === "number"
        ? [
            {
              latitude: place.lat,
              longitude: place.lon,
              label:
                typeof place.formatted === "string"
                  ? place.formatted.slice(0, 96)
                  : (conciseLabel(place as GeoapifyFeature["properties"]) ??
                    undefined),
            },
          ]
        : [],
    );
  } catch {
    return [];
  }
}
