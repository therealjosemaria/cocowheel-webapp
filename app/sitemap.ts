import type { MetadataRoute } from "next";
import { PUBLIC_SEARCH_PATHS, SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_SEARCH_PATHS.map(path => ({ url: new URL(path, SITE_URL).href }));
}
