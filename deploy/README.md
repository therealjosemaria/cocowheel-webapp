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

## Verification

```bash
COCOWHEELS_API_URL=http://127.0.0.1:5060 ./deploy/health-check.sh
```
