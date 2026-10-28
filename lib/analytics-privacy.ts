import type { BeforeSendEvent } from "@vercel/analytics/next";

// Fail closed: new pages need a privacy review before joining this allowlist.
const publicPaths = new Set(["/", "/help", "/about", "/privacy", "/terms", "/activity", "/usual-route"]);

export function sanitizeAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  if (event.type !== "pageview") return null;
  try {
    const url = new URL(event.url);
    if (!/^https?:$/.test(url.protocol) || !publicPaths.has(url.pathname)) return null;
    // Rebuild rather than spreading extra event fields or retaining query/hash.
    return { type: "pageview", url: `${url.origin}${url.pathname}` };
  } catch {
    return null;
  }
}
