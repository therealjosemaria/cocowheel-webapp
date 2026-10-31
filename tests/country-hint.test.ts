import test from "node:test";
import assert from "node:assert/strict";
import { hostingCountryHint, normalizeCountryHint } from "../lib/country-hint";
import { GET } from "../app/search-country/route";

test("country hints reject missing, unknown and malformed values without a default", () => {
  for (const value of [null, undefined, "", "USA", "XX", "ZZ", "T1", "au,us", 123])
    assert.equal(normalizeCountryHint(value), null);
  assert.equal(normalizeCountryHint("AU"), "au");
  assert.equal(normalizeCountryHint("gb"), "gb");
});

test("Cloudflare domain hints do not fall back to the Vercel proxy country", () => {
  const headers = new Headers({ "cf-ipcountry": "AU", "x-vercel-ip-country": "US" });
  assert.equal(hostingCountryHint(headers, "www.gumwheel.com", true), "au");
  headers.delete("cf-ipcountry");
  assert.equal(hostingCountryHint(headers, "www.gumwheel.com", true), null);
  headers.set("cf-ipcountry", "XX");
  assert.equal(hostingCountryHint(headers, "gumwheel.com", true), null);
  assert.equal(hostingCountryHint(headers, "localhost", false), null);
  assert.equal(hostingCountryHint(headers, "unknown.example", true), null);
});

test("direct Vercel aliases use Vercel hints and ignore Cloudflare values", () => {
  const headers = new Headers({ "cf-ipcountry": "FR", "x-vercel-ip-country": "GB" });
  assert.equal(hostingCountryHint(headers, "example.vercel.app", true), "gb");
  assert.equal(hostingCountryHint(headers, "example.vercel.app", false), null);
});

test("country endpoint returns country only and prohibits shared/browser caching", async () => {
  const previous = process.env.VERCEL;
  process.env.VERCEL = "1";
  try {
    const response = GET(new Request("https://www.gumwheel.com/search-country", { headers: {
      "cf-ipcountry": "AU", "x-vercel-ip-country": "US", "cf-connecting-ip": "192.0.2.1",
    } }));
    assert.deepEqual(await response.json(), { countryCode: "au" });
    assert.match(response.headers.get("cache-control")!, /private.*no-store/);
    assert.equal(response.headers.get("cdn-cache-control"), "no-store");
    assert.equal(response.headers.get("vercel-cdn-cache-control"), "no-store");
    assert.match(response.headers.get("x-robots-tag")!, /noindex/);
    const unknown = GET(new Request("https://www.gumwheel.com/search-country", { headers: { "x-vercel-ip-country": "US" } }));
    assert.deepEqual(await unknown.json(), { countryCode: null });
  } finally {
    if (previous === undefined) delete process.env.VERCEL; else process.env.VERCEL = previous;
  }
});
