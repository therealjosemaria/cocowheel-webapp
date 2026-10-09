# Cocowheels physical trial checklist

Run this on two independent phones/browsers. Do not reuse the same guest session for both roles.

## Core path

- [ ] Driver places departure and destination pins, selects `Leave now`, enters `A$10`, and publishes.
- [ ] Rider places pickup/destination pins and sees the offer card with an anonymous name, fixed price, time, direction fit, and a redacted direction corridor only.
- [ ] Before acceptance, confirm the rider cannot infer or view the driver’s exact origin/final destination or PayID.
- [ ] Rider requests the offer; driver sees the anonymous rider, pickup, destination, requested time, fixed price, and direction fit.
- [ ] Driver accepts; a second pending request is immediately discarded and the offer no longer appears in a new rider search.
- [ ] Both phones use `SHARE FRESH LOCATION`; driver cannot begin until both server-accepted points are fresh.
- [ ] Driver begins the ride; rider sees the driver’s current/last-known location, and driver sees the rider’s current/last-known location.
- [ ] After acceptance, confirm PayID is visible only on the driver and accepted rider phones. At pickup, rider reads the four-digit code and driver enters it once.
- [ ] Complete using `PayID` and repeat with `Cash`. Confirm the app records only the selected handoff preference and never says payment is verified.
- [ ] Refresh both phones at each major state and verify the private guest session resumes the current item.

## Failure and privacy path

- [ ] Deny GPS on one phone. Confirm only that phone is prompted to retry or use its browser location setting; manual map pins still work before acceptance.
- [ ] Reject a rider request. Confirm the rider can make a new request and the driver offer remains searchable.
- [ ] Cancel before co-ride confirmation. Confirm locations are no longer available and the offer never reopens.
- [ ] Confirm that after co-ride confirmation there is no cancel action, only completion.
- [ ] Let a scheduled, unstarted offer become stale. Confirm it is not discoverable and is not revived.
- [ ] Disconnect one device during approach. Confirm `Trying to reconnect`/last-known location is shown rather than a stale dot presented as live, then reconnect.
- [ ] Inspect another browser session. Confirm it cannot retrieve ride state, active locations, rider pins, driver endpoints, code, or PayID.
