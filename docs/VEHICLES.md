# Vehicle details — 23 October 2026

## Implemented behaviour

One private vehicle per university account. GET /api/vehicle returns `{vehicle}`
(null if absent); POST replaces the account's four fields. Identity comes only
from the authenticated session, never a supplied account ID. Writes recheck the
session after reading JSON. Existing Origin, body-size and no-store rules apply.
Unauthenticated access is 401; invalid fields are 400. Missing fields become empty.
Plate is trimmed, uppercased, limited to 9 ASCII letters/digits/spaces/hyphens,
starting with a letter/digit; leading zeros remain. Optional make/model/colour
are trimmed, max 40 characters, rejecting control characters. These are basic
input checks, not registration, ownership, licence or identity verification.

## Nine-character refinement (23 October 2026)

Baseline 21d9af6. Nine is a pragmatic input cap, not a universal registry-format
claim: [WA's official custom-plate guidance](https://online.transport.wa.gov.au/webExternal/optionalplates/?type=custom)
allows up to nine characters including spaces for acrylic vehicle plates.
[NSW EPA's vehicle-report form](https://apps.epa.nsw.gov.au/mvreportingapp/noisyreporting.aspx)
asks for no spaces/hyphens, but this is an input convention, not proof that no
Australian plate displays separators. Per owner instruction, preserve existing
space/hyphen support rather than guessing a national prohibition. Other punctuation,
emoji and control characters remain rejected. Leading zeros and numeric-only plates
remain supported; letters become uppercase. Separators count toward the nine limit.

The same validPlate helper powers server writes and browser custom validity in
Profile and the acceptance modal. Invalid nonempty drafts show a native validation
message on submission and aria-invalid; no permanent helper or layout change.
Overlong paste remains visible and cannot submit, rather than silently truncating
to a different plate. Empty input keeps native required handling. No changes to
make/model/colour. No record migration: historical snapshots and previously saved
plates remain readable; acceptance using an unchanged legacy saved plate remains
compatible. New/edited plate writes must meet the new rule.

Verification: 154 isolated tests passed, including direct HTTP rejection in both
vehicle-save and acceptance endpoints, atomic rollback, preserved previous vehicle,
valid nine-character plates, separators, leading zeros and invalid symbols.
Lint and production build passed. With built frontend on loopback :3197:
`VEHICLE_CHECK_ORIGIN=http://127.0.0.1:3197 /tmp/gumwheel-pickup-check-env/bin/python scripts/check-vehicles.py`
passed at 320/390/1440px, using mocked APIs and blocking external traffic. Invalid
drafts cannot save/accept; corrected input clears validity; normal save, retry,
cancellation and accepted-rider display pass. Whole mobile prompt/rider and desktop
Profile screenshots reviewed: typography, spacing and hierarchy unchanged, no
overflow. Initial server startup on :3091 found that port occupied; used :3197
without stopping the existing process. Real-device Safari remains unverified.

Owner-approved API activation at 14:37:33 AEDT, 23 October: this tested change
series over 21d9af6. Zero accepted/active trips checked before online backup and
immediately before restarting only cocowheels-api. Private backup integrity/FKs
and ride count passed (0700 directory/0600 file). Post-restart service active,
local/public-proxy health ok, 127 rides retained, integrity ok and no FK violations.
No production test writes or plate/history migrations. Frontend push/deployment
is separate from API activation.

Saving vehicle details requires a plate; publication does not require one.
Blank saves return 409 VEHICLE_PLATE_REQUIRED without changing existing details.
This supersedes the initial blank-plate Profile save behaviour in 4bb8253.
PATCH /api/rides/:ride/requests/:request with ACCEPT uses acceptWithVehicle.
It validates role/state, uses the saved vehicle or saves an optional supplied plate,
then inserts the ride snapshot in one SQLite transaction. Missing plate returns
409 VEHICLE_PLATE_REQUIRED and rolls back acceptance, discarded requests, code,
events and any account change. Invalid/stale/unauthorized acceptance saves nothing.
DECLINE is unchanged. Trusted core/sample fixtures may call decideRequest directly;
all real HTTP acceptance uses the vehicle gate. Production sample rides stay off.

Additive account_vehicles (principal_id → guest_sessions) and ride_vehicles
(ride_id → rides) store JSON. No TTL, purge, additional encryption or deletion is
introduced. The ride snapshot is immutable and is never replaced by Profile edits.
Driver and accepted rider views include it, including retained history; public,
pending and discarded rider views do not. Old accepted rides without a snapshot
remain usable. This release does not require existing riders to re-pair.

Profile's collapsed Vehicle details accordion works independently of route saving.
Save vehicle details uses the same primary button as Save route. Only Number plate
is marked (required); Make, Model and Colour omit optional suffixes but remain optional.
Both acceptance entry points reuse the plate-only modal with focus containment,
Escape/Go back, busy protection and input-preserving errors. Accepted rider details
show the plate and supplied optional fields below pickup, outside messaging.
No fields or new friction at publication. Rider suggestion: “Hi! Where should we
meet?”; driver suggestion unchanged. Both remain editable and never auto-send.

## Verification

Source baseline 327c6f3 plus this change series. Synthetic databases and blocked
external requests only; no real trips, messages, emails or vehicle data used.

- `npm test`: 147/147 passed, including new service/HTTP validation, authorization,
  missing-plate rollback, immutable snapshots, other-rider privacy, old-trip reads,
  account isolation and legacy fare-migration fixtures.
- `npm run lint` and `npm run build`: passed. Standalone `tsc --noEmit` retains
  existing test-file type errors; production build type checking passes.
- `npm run test:security`: all 52 isolated HTTP checks passed.
- `npm run test:recovery`: final 25/25 passed, including concurrent acceptance
  and crash rollback. Two initial runs stopped after 19 passes because the old
  GPS fixture submitted a fix captured before acceptance. The existing
  acceptance-gated GPS rule correctly rejects it. Updated the synthetic timestamps
  to acceptance-or-later; no production GPS rule changed. Sanitized run evidence
  is retained below, including the failed baselines.
- With isolated Next on :3090 and all APIs mocked:
  `/tmp/gumwheel-pickup-check-env/bin/python scripts/check-vehicles.py` passed
  at 320/390/1440px: Profile save, collapsed default, cancellation without acceptance,
  uppercase input, server-error retry preserving plate, accepted-rider display,
  no horizontal overflow or page errors. Manual screenshot review covered the
  complete Profile, driver prompt and rider pickup screens, mobile and desktop.
- `scripts/check-message-entry.py` passed chooser/preview at 320/393/1440px:
  shortened starter, left alignment, equal padding, editable insertion and no send.

Initial failed fixtures were corrected: accepted offers have no public preview;
legacy fare-schema fixtures must initialize vehicle tables. Initial browser checks
had an incorrect accordion selector and a reload race; corrected selectors and
explicit navigation wait passed. No product change was needed for those failures.

Production API activation was initially pending; see the activation entry below.
Real-device Safari/keyboard checks and authenticated live-account walkthrough
remain unverified. A push is not a verified frontend deployment.

## Activation and Profile disclosures — 23 October 2026

The Profile error was reproduced against the old API: GET /api/vehicle returned
404 NOT_FOUND; service startup was 22 October 14:50:59 AEDT and both vehicle tables
were absent. After owner approval, rechecked zero accepted/active trips and created
a private consistent SQLite backup in the ignored data directory (directory mode
0700, file 0600). Backup integrity and foreign keys passed. Restarted only
cocowheels-api at 10:39:48 AEDT from backend revision 9715d9a.

Post-restart: health ok, both vehicle tables present, 121 rides retained,
integrity ok, zero FK violations. Local and www.gumwheel.com/api/vehicle now
return 401 UNIVERSITY_VERIFICATION_REQUIRED to anonymous requests, not 404.
No production account/ride writes or email sends were performed as tests.

Usual route now collapses independently of Vehicle details (drivers only), using
the same native disclosure. Route fields stay mounted, preserving unsaved edits.
Email matching links with a match parameter start with Usual route open. Vehicle
loading failure never prevents opening or editing the route section.

Disclosure follow-up checks: `npm test` (147 passed), `npm run lint` and
`npm run build` passed. With an isolated local frontend and mocked APIs,
`scripts/check-vehicles.py` passed at 320/390/1440px, including independent
collapse, preserved unfinished route edits, vehicle saving, acceptance retry and
rider vehicle display. `scripts/check-profile-route-polish.py` passed at
320/390/844/1440px for saved-route editing, swapping and schedule controls.
Expanded whole-Profile screenshots at 320/1440px were visually reviewed for
summary/icon consistency, padding, button emphasis and overflow. These browser
checks do not establish authenticated production behaviour or real-device Safari.

Follow-up to 4bb8253: simplified labels and primary Save vehicle details button
retested with 147 passing regressions and the same 320/390/1440px browser script.
Screenshots reviewed on mobile/desktop; blank vehicle saves now preserve prior
details and return VEHICLE_PLATE_REQUIRED. Publication still needs no plate.

### Dated sanitized reliability evidence

All runs: baseline `327c6f38b484e17c1c0e8f9a5999e6f0cd7224df` plus this uncommitted
vehicle change series, isolated loopback API/synthetic SQLite, no live providers.
Core SHA256: `967f9af065dd497d6f0a4cee58285dbeb1e28f41d968db0902fd01d8facf9f91`.

| UTC timestamp | Command | Result |
| --- | --- | --- |
| 2026-10-22 23:09:17 | npm run test:security | 52 passed, zero failed |
| 2026-10-22 23:10:14 | npm run test:recovery | 19 passed; interrupted at first GPS write assertion |
| 2026-10-22 23:11:48 | npm run test:recovery | 19 passed; same fixture failure reproduced |
| 2026-10-22 23:12:26 | npm run test:recovery | Fixture corrected; 25 passed, zero failed |

These do not establish new capacity limits or hardware failure tolerance. No load
campaign was run. The mixed-load fixture now supplies a synthetic plate so its
acceptance calls remain compatible; its capacity stages were not rerun.

## Owner walkthrough

1. Profile → Vehicle details: save plate, optionally make/model/colour; reload.
2. Driver with no plate: offer unchanged, then Accept rider → Go back leaves request
   pending; Save & accept supplies the plate and accepts together.
3. Driver with saved plate: Accept rider needs no extra prompt.
4. Accepted rider: check plate below pickup code; another/pending rider cannot see it.
5. Edit Profile vehicle: existing trip retains its original vehicle; next acceptance
   uses the updated details. Open empty rider chat and try the shorter suggestion.
