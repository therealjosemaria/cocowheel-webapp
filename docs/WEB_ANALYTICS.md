# Web Analytics

Implemented 22 October 2026. Uses `@vercel/analytics` 2.0.1, matching the working
Lime Wheels integration in `/home/jmos0905/corridor/app/layout.tsx`.

The server root layout mounts one non-visual client wrapper using the Next.js
adapter. The SDK observes page loads/client navigation; it does not poll the Pi.
Development uses SDK development mode; production collection requires Vercel
project Web Analytics enabled and a deployment containing this integration.
Blocked analytics must not prevent login, searching or riding.

## Privacy boundaries

`lib/analytics-privacy.ts` allows only `/`, `/help`, `/privacy`, `/terms`,
`/activity` and `/usual-route`. All query strings and fragments are removed.
Ride-detail URLs, admin, APIs, unknown paths and custom events are dropped.
New routes require an explicit allowlist/privacy review. In-page Find/Offer
tabs remain Home page views, not separate feature/conversion measurements.
No account, form, chat, payment or GPS values are attached to events.
The global `origin` referrer policy limits subsequent browser referrers to the
origin rather than private paths; it also affects ordinary outgoing links.
An incoming external referrer remains subject to the referring site's policy
and Vercel's collection rules. The event callback only controls event URLs,
not all provider metadata. Vercel receives request metadata and derives browser,
device and approximate region statistics. This is not session replay.

## Verification and activation

Run `npx tsx --test tests/analytics-privacy.test.ts`, `npm test`, `npm run lint`
and `npm run build`. Browser-check Home and Privacy on mobile and desktop,
including with the analytics script blocked. Review outbound production page
events after deployment; do not send synthetic private user data to Vercel.
Confirm a real visit appears in the project's Analytics dashboard. A successful
build or push alone does not prove dashboard collection. No API restart needed.

References: [quickstart](https://vercel.com/docs/analytics/quickstart),
[URL filtering](https://vercel.com/docs/analytics/redacting-sensitive-data),
[provider privacy](https://vercel.com/docs/analytics/privacy-policy).

### Local results — 22 October 2026

Baseline `585c94b` plus this integration: 137/137 regression tests passed,
ESLint passed and Next production build passed. Initial sandbox test invocation
failed on tsx IPC permissions before running tests; the permitted rerun passed.
`/tmp/gumwheel-pickup-check-env/bin/python scripts/check-web-analytics.py`
against `npx next start --hostname 127.0.0.1 --port 3091` passed at 390px and
1440px. API responses were mocked and external traffic blocked: no production
records, emails or analytics events were created. Both Home and Privacy rendered,
the SDK mounted, origin referrer metadata was present, and no horizontal overflow
or uncaught browser errors occurred with analytics unavailable. Screenshots were
visually reviewed: existing header, buttons and typography remained consistent;
the new Privacy section uses existing heading/body spacing and emphasis.
Provider intake, dashboard configuration and live counts remain unverified.
The package installation reported 8 audit findings (7 high, 1 critical) in the
overall dependency tree; no broad dependency upgrades were attempted here.
