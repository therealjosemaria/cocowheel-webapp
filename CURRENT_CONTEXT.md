# Cocowheels current context

## Product invariant

Cocowheels is a guest-first scheduled, one-driver/one-rider carpool. The server owns lifecycle state. A fixed whole-dollar AUD price is set at publishing and is never recalculated. This MVP has no accounts, editable or public profiles, negotiation, fares, navigation, payment processing, or public activity.

Consistency and non-blocking exploration are product principles. Driver movement never closes a published offer or prevents a rider request. Poor route fit prompts a concise confirmation rather than prohibiting the request; self-joining and multiple accepted passengers remain prohibited.

While the browser is visible, the shared tracker samples GPS every 15 seconds and sends updates every 60 seconds stationary or 15 seconds moving. Two reliable displaced readings establish movement; three quiet readings restore stationary mode. Returning to the app refreshes GPS immediately. Published/requested offers expose the driver's latest position and capture time to riders. Labels show “Updated 2m ago” / “Last updated 2m ago”; no GPS reading is labelled “Published location.” Original departure is preserved. Accepted-ride coordinates remain participant-only. Background browser tracking is not guaranteed.

## Initial architecture

- Next.js phone-first web client, with Leaflet as a supporting map display.
- Standalone Node HTTP API and a dedicated SQLite database on the Pi.
- Cloud frontend proxies same-origin `/api/*` requests server-side to a dedicated tunnel; the tunnel hostname remains private configuration.
- Opaque guest session secrets are stored as hashes server-side and sent via an HttpOnly cookie with an Authorization fallback only where deployment requires it.

## Implementation sequence

1. Domain schema, sessions, lifecycle guards, privacy-safe views, and unit tests.
2. API boundary and integration tests.
3. Phone-first driver publish and rider search/request UI.
4. Acceptance, fresh GPS readiness, private live locations, and reconnect states.
5. One-time co-ride code, PayID visibility, completion, and private history.
6. Manual two-phone test checklist, service/tunnel deployment assets, and security review against Corridor patterns.

## Follow-up notes for review

- Confirm the pilot’s preferred scheduled-offer expiry window before external testing. Until then, implementation uses a conservative 30-minute stale-offer window and never silently revives an expired offer.
- Confirm whether address search is worth enabling for the pilot. Pins remain canonical and the first local build must work without any geocoder key or external address service.

## Completed initial vertical slice

- Driver publishing, rider discovery/request, acceptance/decline, atomic discard of competing requests, fresh location checks, private live-location exchange, one-time four-digit co-ride confirmation, payment handoff, cancellation rules, expiry, private history, and guest-session recovery are implemented.
- A guest session has one server-assigned anonymous alias and one open role at a time. Guests may browse every offer, but must end an active driver offer before requesting as a rider, or end an active rider request before publishing as a driver. The alias remains stable when switching roles.
- Driver endpoints and the latest driver location are available while an offer is open. PayID is private to the driver until acceptance, then is returned only to that accepted rider. Current live points are deleted at cancellation, completion, and expiry; no GPS trail table exists.
- Validated locally with unit and HTTP integration tests, lint, production build, a loopback same-origin proxy check, and the dedicated API health check.

## Future pilot checks

- Perform the acceptance path on two physical phones with real browser GPS permissions, denied-permission fallback, a refresh on each participant device, and an intentionally dropped API connection.
- Before external deployment, provision a named Cocowheels-only tunnel, set the production code-encryption key, set exact frontend origins, and review cookie behaviour through the deployed proxy.
