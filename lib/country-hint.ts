/** Approximate search hint only; never identity, eligibility or authorization. */
export function normalizeCountryHint(value: unknown): string | null {
  if (typeof value !== "string" || !/^[a-z]{2}$/i.test(value)) return null;
  const country = value.toLowerCase();
  return country === "xx" || country === "zz" ? null : country;
}

export function hostingCountryHint(headers: Headers, hostname: string, hosted: boolean): string | null {
  if (!hosted) return null;
  // The public domain is Cloudflare-proxied. Vercel may geolocate its proxy,
  // so do not substitute that country if Cloudflare's visitor hint is missing.
  if (["gumwheel.com", "www.gumwheel.com"].includes(hostname))
    return normalizeCountryHint(headers.get("cf-ipcountry"));
  if (hostname.endsWith(".vercel.app"))
    return normalizeCountryHint(headers.get("x-vercel-ip-country"));
  return null;
}
