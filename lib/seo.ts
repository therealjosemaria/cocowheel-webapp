import type { Metadata } from "next";

// The public domain redirects to www. Keep discovery URLs free of user data.
export const SITE_URL = "https://www.gumwheel.com";
export const SITE_TITLE = "Sydney Carpooling | GUMWHEEL";
export const SITE_DESCRIPTION =
  "Find a ride, post a journey or request one. Share journeys in Sydney for free or an agreed contribution, directly in your browser.";
export const PUBLIC_SEARCH_PATHS = ["/", "/help", "/about", "/privacy", "/terms"] as const;

export function publicPageMetadata(
  path: (typeof PUBLIC_SEARCH_PATHS)[number],
  title: string,
  description: string,
): Metadata {
  const url = new URL(path, SITE_URL).href;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      siteName: "GUMWHEEL",
      locale: "en_AU",
      url,
      title,
      description,
      images: [{ url: `${SITE_URL}/brand/gumwheel-original.png`, width: 1254, height: 1254, alt: "GUMWHEEL" }],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [`${SITE_URL}/brand/gumwheel-original.png`],
    },
  };
}

export function homePageMetadata(match: unknown): Metadata {
  // Email suggestions contain a private match key. Do not index or canonicalize it.
  if (typeof match === "string" && match.length > 0) {
    return { title: "Matching journey | GUMWHEEL", robots: { index: false, follow: false } };
  }
  if (Array.isArray(match) && match.some(value => typeof value === "string" && value.length > 0)) {
    return { title: "Matching journey | GUMWHEEL", robots: { index: false, follow: false } };
  }
  return publicPageMetadata("/", SITE_TITLE, SITE_DESCRIPTION);
}
