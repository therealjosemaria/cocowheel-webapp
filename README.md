# Cocowheels

Cocowheels is a guest-first, scheduled one-driver/one-rider carpool web app.

The MVP keeps the journey simple: a driver publishes a fixed-price ride, a rider requests to join a compatible direction, both parties share private live location after acceptance, and they confirm pickup with a short-lived four-digit code before completing a PayID or cash handoff.

This repository is intentionally independent from other projects: it has its own API, SQLite database, guest-session cookies, deployment configuration, tunnel target, and environment variables.

## Status

The first local vertical slice is implemented and verified. It is not externally deployed.

## Local development

Use two terminals:

```bash
npm install
npm run db:init
PORT=5060 npm run start:api
```

```bash
COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:5060 npm run dev
```

The web client calls same-origin `/api/*`; Next.js forwards those requests to the API target without exposing it in browser configuration.

## Verification

```bash
npm test
npm run lint
npm run build
COCOWHEELS_API_URL=http://127.0.0.1:5060 ./deploy/health-check.sh
```

See [the Pi deployment notes](deploy/README.md), [the physical trial checklist](TRIAL_CHECKLIST.md), and [the current implementation context](CURRENT_CONTEXT.md).
