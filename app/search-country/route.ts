import { hostingCountryHint } from "@/lib/country-hint";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const countryCode = hostingCountryHint(request.headers, new URL(request.url).hostname, process.env.VERCEL === "1");
  return Response.json({ countryCode }, { headers: {
    "Cache-Control": "private, no-store, max-age=0",
    "CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
  } });
}
