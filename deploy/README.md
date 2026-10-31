# GUMWHEEL Pi deployment

31 October local-search ranking requires an API restart after backup/zero-underway
checks. No schema, credentials, provider endpoint, query limit or environment
change. The frontend separately persists country choices; see
../docs/LOCAL_SEARCH_2026-10-31.md for the release boundary.

30 October: five-minute unread journey reminders add journey_notifications and /api/notifications/reviewed. Existing provider key/from/public origin enable the worker independently of the route-alert flag. No new environment values are required. Back up and check zero accepted/active trips before restarting only cocowheels-api; see ../docs/JOURNEY_EMAIL_REMINDERS.md. No historical reminder backfill.

Public search ownership: optional frontend build variables `GOOGLE_SITE_VERIFICATION` and `BING_SITE_VERIFICATION` accept only provider token values, not full HTML tags. They emit public Google / msvalidate.01 metadata; blank values emit nothing. Redeploy the frontend after setting them, then verify in the provider dashboard. DNS verification needs neither variable. See [owner steps](../docs/SEARCH_SETUP.md). No API restart or email/login configuration change is involved.

Legacy `cocowheels` service names, paths and environment keys intentionally remain.
The current frontend is `https://www.gumwheel.com`, reached via `gumwheel.com`.
Keep both origins and the previous Vercel URL in the API allowlist during migration.
See the root [README](../README.md) for current architecture and behaviour.

The Pi runs the authoritative Cocowheels Node API and its dedicated SQLite database. The cloud frontend only forwards same-origin `/api/*` requests to a dedicated Cocowheels HTTPS tunnel; it never writes to SQLite.

## Initial preparation

```bash
npm ci
cp .env.example .env
npm run db:init
```

Set a distinct, random `COCOWHEELS_CODE_ENCRYPTION_KEY` before any production use. Set the frontend/public origins and the dedicated tunnel hostname in `.env`. Do not commit `.env`, share it with another project, or expose the tunnel target as `NEXT_PUBLIC_*`.

## Service

```bash
sudo cp deploy/cocowheels-api.service /etc/systemd/system/cocowheels-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now cocowheels-api
sudo systemctl status cocowheels-api
```

The supplied unit has an independent process name and permits writes only to Cocowheels’ `data` directory. It must not replace or reuse the Corridor service, database, port, cookie, or tunnel configuration.

## Dedicated Cloudflare Tunnel

Create a separate remotely managed tunnel named `cocowheels-api` in Cloudflare,
with the published hostname `cocowheels-api.santacruzprimero.com` forwarding to
`http://127.0.0.1:5060`. Do not use Cloudflare's generic `service install`
command: it can conflict with another project's Cloudflared service.

Store its connection token in the Pi-only root-owned file
`/etc/cocowheels/tunnel.token` as the raw token only (no variable name,
quotes, or command), then install the dedicated service:

```bash
sudo cp deploy/cocowheels-tunnel.service /etc/systemd/system/cocowheels-tunnel.service
sudo systemctl daemon-reload
sudo systemctl enable --now cocowheels-tunnel
sudo systemctl status cocowheels-tunnel
```

The token is a separate Cocowheels secret. Never add it to the repository,
the application `.env` file, a systemd environment variable, or another
project.

## Verification

Vehicle details (23 October): restart the API before using the new Profile
accordion. Startup adds account_vehicles and ride_vehicles without rewriting
existing rides. Back up first and confirm no accepted/active trips before restarting.
Acceptance now requires a plate; pre-existing accepted trips are grandfathered.
See [vehicle checks](../docs/VEHICLES.md). A frontend push alone is not activation.

Profile/contribution update (22 October) lowers the paid minimum to AUD 1 and
allows cents. Restart the tested API before releasing its frontend. The existing
transactional fare migration now handles both >=5 and free-or->=5 CHECKs, changing
them to free-or->=1 without converting existing fares. Back up first and verify
table preservation/integrity/FKs. See [checks](../docs/PROFILE_POLISH_2026-10-22.md).

Free-ride support requires the API before the free-default frontend. Startup
transactionally rebuilds legacy `rides` tables to permit fare 0 alongside the
existing >=5 constraint, preserving every column/row and explicit index/trigger.
Take a consistent private backup first; verify integrity, foreign keys and row
counts after activation. Do not restart during live rides without coordination.
See [free-ride migration checks](../docs/FREE_RIDES_2026-10-21.md). A frontend-only
deployment against the old API will reject free offers.

Usual routes require the new API/schema before frontend use. The additive
tables initialize at service restart; take the consistent backup described below.
Matching emails additionally require `COCOWHEELS_ROUTE_ALERTS_ENABLED=1` on the
API host (default off). Alert attempts have no app-wide hourly/daily cap and
share provider capacity with authentication; provider quotas still apply. Monitor
provider usage because alerts can consume capacity needed by login codes. Do not enable
real email delivery in synthetic tests. See [usual routes](../docs/USUAL_ROUTES.md)
and the dated verification guide for activation status and the manual checklist.

Sample rides are now opt-in through `createApiServer` test options; normal API
startup disables replenishment and retires available sample offers transactionally.
It retains history and records `SAMPLE_OFFER_RETIRED` / `SAMPLES_DISABLED`, discarding
pending requests. Real offers and accepted journeys are not cancelled. Existing
accepted sample simulations may finish without replacements. No environment,
cookie, provider or database-path changes are needed.

Frontend pushes and backend deployments are separate. After tested backend/env
changes, restart only the dedicated API and confirm health:

```bash
sudo systemctl restart cocowheels-api
systemctl is-active cocowheels-api
```

Then test the new domain's `/api` proxy and representative read-only requests,
including the correct browser Origin. Test search/reverse labels, authentication
and current-ride recovery on an authorized test account. Do not create or cancel
real user rides as a health check. A DNS/HTTPS success alone is not API verification.

The schema initializer applies compatibility changes at API startup. Before a
material schema change, take a consistent SQLite backup using SQLite's backup API
or an equivalent validated process; do not copy only the main database file while
WAL writes are active. Preserve the encryption key or existing encrypted pickup
codes may no longer be recoverable. Backups contain private data and need restricted
access. No automated backup/restore schedule is claimed by this documentation.

See [the isolated restore drill and proposed recovery procedure](../docs/BACKUP_RESTORE_TESTING.md).
The synthetic drill passed; an off-Pi production backup/key recovery remains
unverified (BAK-001). Do not treat a successful local drill as disaster protection
or restore a backup over the running production database.

If rolling back, check schema compatibility first. Do not delete the database or
reset production records to resolve a deployment problem. Inspect service logs
without copying tokens, payment identifiers or private locations into reports.

```bash
COCOWHEELS_API_URL=http://127.0.0.1:5060 ./deploy/health-check.sh
```


## First-visit country hint — 31 October 2026

The frontend dynamic /search-country route must remain outside the /api/* backend
rewrite. Vercel supplies VERCEL=1 automatically. Canonical Cloudflare-proxied
hosts require Cloudflare Network → IP Geolocation enabled so CF-IPCountry reaches
Vercel; missing/unknown hints return null, never Vercel’s proxy country. Direct
vercel.app aliases use Vercel’s own IP-country header. Do not cache this route:
private/no-store plus both CDN no-store headers prevent cross-visitor reuse.
Responses include noindex/nofollow, country only, no IP or account data. No new
secrets, env vars, database or schema changes. Verify production country/header
availability after deploy; absence must remain worldwide, not a default.
The server change explicitly sends Geoapify countrycode:none without a hint and
requires a conditional backed-up API restart. See docs/LOCAL_SEARCH_2026-10-31.md.
