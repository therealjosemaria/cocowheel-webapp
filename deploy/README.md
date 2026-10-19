# GUMWHEEL Pi deployment

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
