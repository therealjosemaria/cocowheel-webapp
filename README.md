# Cocowheels

Cocowheels is a guest-first, scheduled one-driver/one-rider carpool web app.

The MVP keeps the journey simple: a driver publishes a fixed-price ride, a rider requests to join a compatible direction, both parties share private live location after acceptance, and they confirm pickup with a short-lived four-digit code before completing a PayID or cash handoff.

This repository is intentionally independent from other projects: it has its own API, SQLite database, guest-session cookies, deployment configuration, tunnel target, and environment variables.

## Status

The first local vertical slice is implemented and verified. It is not externally deployed.

## Local development

```bash
cd /home/jmos0905/COCOWHEEL
npm install
npm run dev
```

This one command starts the local API and web client together, then stops both when you press `Ctrl+C`. The web client calls same-origin `/api/*`; Next.js forwards those requests to the local authoritative API without exposing its target in browser configuration.

## Vercel frontend preview

The frontend can be deployed independently before the Pi API is public. In Vercel, import `therealjosemaria/cocowheel-webapp`, leave the root directory at the repository root, and use the detected Next.js preset. Do not set `COCOWHEELS_API_PROXY_TARGET` for this frontend-only preview: the page will load safely, while server-dependent ride actions remain unavailable until the dedicated API tunnel is configured.

Connect the `initial-mvp` branch for a preview deployment. Keep `main` as the future production branch. Once the permanent Cocowheels API tunnel is ready, set `COCOWHEELS_API_PROXY_TARGET` in Vercel as a server-side environment variable to that HTTPS hostname. Never expose it as `NEXT_PUBLIC_*`.

## Verification

```bash
npm test
npm run lint
npm run build
COCOWHEELS_API_URL=http://127.0.0.1:5060 ./deploy/health-check.sh
```

See [the Pi deployment notes](deploy/README.md), [the physical trial checklist](TRIAL_CHECKLIST.md), and [the current implementation context](CURRENT_CONTEXT.md).
