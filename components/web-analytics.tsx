"use client";

import { Analytics } from "@vercel/analytics/next";
import { sanitizeAnalyticsEvent } from "@/lib/analytics-privacy";

export default function WebAnalytics() {
  return <Analytics beforeSend={sanitizeAnalyticsEvent} />;
}
