# Cocowheels Pi deployment

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

```bash
COCOWHEELS_API_URL=http://127.0.0.1:5060 ./deploy/health-check.sh
```
