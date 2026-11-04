# Vehicle catalogue — 5 November 2026

## Agreed scope and research

20 make/model combinations total, six colours, typed alternatives always supported.
The owner added Year and then explicitly removed the proposed five/ten-year age
limit. Year options follow each illustration's researched body-era coverage;
the sales-ranking year never supplies a user's vehicle year. See the
[individual model/body/year audit](VEHICLE_MODEL_YEARS.md).
Use the latest complete calendar year (2025), not an incomplete 2026 ranking.
This measures **new-vehicle sales**, not Australia's entire registered fleet or
student ownership. It intentionally favours current SUVs/utes; a common older car
outside this list can still be entered using Other and receives the generic icon.
Camry is not in this top 20; Corolla is. No automatic annual catalogue replacement.

The complete table is reported by [Chasing Cars, 29 January 2026](https://www.chasingcars.com.au/news/car-industry/top-100-most-popular-cars-in-australia-in-2025-best-selling-vehicles/), combining FCAI and Electric Vehicle Council figures.
[Primary FCAI release, 6 January 2026](https://www.fcai.com.au/australias-new-vehicle-market-remains-resilient/)
confirms the major models but is not itself a complete top-20 table and omits
D-Max in its short leading-model sentence. Its 1,209,808 VFACTS total differs
from the combined report's 1,241,037; do not treat those totals as interchangeable.
The top ten were cross-checked against [RACV's annual report](https://www.racv.com.au/royalauto/transport/cars/australian-new-car-sales-2025.html).
CarsGuide's separate full-year table has inconsistent Prado/Model Y counts;
use the values below, which agree with Chasing Cars and RACV.

| Rank | Make/model | 2025 sales |
| --- | --- | --- |
| 1 | Ford Ranger | 56,555 |
| 2 | Toyota RAV4 | 51,947 |
| 3 | Toyota HiLux | 51,297 |
| 4 | Isuzu D-Max | 26,839 |
| 5 | Ford Everest | 26,161 |
| 6 | Toyota LandCruiser Prado | 26,106 |
| 7 | Hyundai Kona | 22,769 |
| 8 | Mazda CX-5 | 22,742 |
| 9 | Mitsubishi Outlander | 22,459 |
| 10 | Tesla Model Y | 22,239 |
| 11 | Chery Tiggo 4 Pro | 20,149 |
| 12 | Hyundai Tucson | 20,145 |
| 13 | MG ZS | 20,000 |
| 14 | GWM Haval Jolion | 19,413 |
| 15 | Kia Sportage | 19,137 |
| 16 | Toyota Corolla | 18,968 |
| 17 | Mitsubishi Triton | 18,900 |
| 18 | BYD Shark 6 | 18,073 |
| 19 | Nissan X-Trail | 15,708 |
| 20 | Isuzu MU-X | 15,458 |

Six standard colours: **White, Black, Silver, Blue, Grey, Red**.
[Budget Direct's 25 June 2025 owner survey](https://www.budgetdirect.com.au/car-insurance/research/car-ownership-habits-survey-statistics.html)
surveyed over 950 Australian adults and reports these at 30%, 16%, 15%, 13%, 12%
and 10% respectively. These rounded survey percentages are not national
registration counts or manufacturer paint availability. Colour names describe
generic paint; this catalogue does not claim that every real model/trim offers
every depicted colour. Other permits any valid existing 40-character colour.

## Implemented selection and storage

Profile retains its shared Vehicle details disclosure, plate validation, Save
button and errors. Native Make, Model, Year and Colour selects offer Other followed by
a manual input. Model options follow the explicitly selected make; Year options
follow the illustrated body era, newest supported year first. Changing make
clears model/year and their selections; changing model clears year. Choosing or typing Other preserves custom details
but removes that field's catalogue selection. All optional fields can still be
left empty; saving still requires a valid plate. No extra publication gate.

Account vehicle JSON gains an optional year and optional selection fields: make is the canonical make
name, model is a stable catalogue/body id, colour is the canonical colour name,
and year is the explicitly selected supported year. The API
validates every supplied selection against the text and dependency; malformed,
unknown or mismatched selections return 400 INVALID_VEHICLE with the existing
“Check your vehicle details and try again.” recovery. Invalid saves preserve the
previous vehicle. Omitted selection means generic art, even when text matches a
catalogue entry exactly. All four selections must match. Partial selections persist but also use generic art.
Manual years use four digits from 1800 through the upcoming model year; no rolling
age restriction. Invalid years return 400 INVALID_VEHICLE_YEAR and the shared
“Choose your vehicle’s year, or enter a valid four-digit year.” instruction;
the manual input uses the same validity instruction and numeric keyboard hint.
No inference/backfill from legacy text and no schema migration/new table/TTL.

Owner Profile previews use the current draft. An unpaired driver's private view
uses their current saved vehicle; after acceptance the existing immutable vehicle
snapshot controls both participants' maps and rider vehicle details. Editing
Profile never changes an accepted or historical snapshot. Legacy closed journeys
without snapshots do not acquire today's vehicle. Both acceptance paths retain
the existing transactional snapshot gate.

Home, discovery lists/maps, semantic role icons and other users' pending previews
keep the existing generic car. No vehicle make/model/colour/selection is added to
the anonymous Home feed or search/discovery responses. This privacy boundary was
explicitly confirmed by the owner. No new GPS, orientation, movement or tracking.

## Artwork and preparation

Original generated 3D illustrations, matching the approved generic car's high
front three-quarter camera, charcoal glazing/wheels and soft studio finish. Each
model is tied to a researched body era, not an exact trim, registration or identity
check; some sales families include several bodies/generations. The
Corolla uses a hatchback; utes use dual-cab open-tray bodies. Model options name
these distinctions. Paint never recolours
windows/wheels. Manufacturer photos/logos are not copied or bundled. AI generation
does not establish exclusive legal rights in vehicle designs or guarantee output
exclusivity; the implementation makes no such ownership claim.

Built-in image generation produced one 3x2 six-state transparent PNG sheet per
model: White/Black/Silver on top, Blue/Grey/Red below. The retained prompt template,
model-specific descriptors, source filenames, research ranks and counts are in
[the source manifest](assets/vehicle-catalogue-sources.json). The source filenames
refer to this workstation's generated-image archive, not public URLs.

Rebuild final assets with:

`node scripts/prepare-vehicle-catalogue.mjs docs/assets/vehicle-catalogue-sources.json`

Preparation only crops equal cells, finds the largest connected opaque subject
to ignore faint generated grid marks, retains a small edge margin, contains to a
384x288 slot and encodes WebP quality 90 / alpha quality 100. No hand recolouring,
SVG substitution, inversion or stretching. 120 final WebP files ship under
public/brand/vehicles/v1, with versioned static URLs derived only from validated
catalogue ids. Only the chosen image is loaded; no 120-image preload. Existing
48px map anchors/overlap handling and map credits stay unchanged. A 144x108px
owner preview retains 12px form spacing. Vehicle text/plate remain authoritative.
Keep model ids and existing versioned artwork meanings stable; add a new entry/id
for a different generation instead of reassigning an accepted snapshot's id.

## Verification and activation

Source baseline b6769a2 plus this change series. `npm test`: 249 passed; lint
and production build passed. The added catalogue regression also iterates every
enabled body-era year and colour combination, verifies shipped files, and checks
typed/legacy/mismatched selections and unsupported years. Existing isolated HTTP
tests cover owner-only details, pending-rider/search/Home privacy, invalid-save
preservation and immutable acceptance snapshots. Year error copy is shared across
browser and backend-error mapping. No production vehicle/account writes or emails.

With built Next on loopback :3201 and all application APIs mocked:

- `GUMWHEEL_TEST_TILES=1 /tmp/gumwheel-notification-check-env/bin/python scripts/check-vehicle-catalogue.py`
  passes at 320/390/844/1440px: explicit selections, saved reload, all four manual
  fallbacks (including matching text), make/model/year dependency, year rejection,
  both participant map views, generic Home and no overflow/runtime errors.
- `VEHICLE_CHECK_ORIGIN=http://127.0.0.1:3201 /tmp/gumwheel-notification-check-env/bin/python scripts/check-vehicles.py`
  passes at 320/390/1440px for existing plate errors/save, acceptance cancellation,
  backend failure/retry and accepted-rider vehicle details.
- All 120 assets decode as 384x288 WebP with alpha; only the selected image loads.
  Ten body designs received reference-guided corrections and the complete colour
  contact sheet was visually reviewed. The preparation measures the opaque body
  core at alpha 224 to avoid faint generated grid/shadow padding changing scale.
- Whole Profile and driver/rider detail screens were visually reviewed on phone
  and desktop for hierarchy, font weights, field/button spacing, black-car map
  contrast, label clearance and retained bottom-left credits. Read-only OSM tiles
  were allowed only for synthetic endpoints; all other external traffic blocked.
  React review checked unconditional hooks, validity effects, private props and
  selected-only asset loading; no new runtime dependency or sensor permission.

Initial browser runs caught an ambiguous accessible dropdown label (fixed with
explicit accessible names). A later fixture incorrectly expected selecting the
same make to fire a native change; it now actually changes make before asserting
the reset. The image check now awaits decode instead of racing the download.
An ended isolated frontend session was restarted after connection refusal. Final
checks pass; these were not production account/trip failures.

Physical-device Safari/native-picker behaviour and an authenticated production
account walkthrough remain unverified. The drawings are stylised body-era
illustrations; they do not certify exact trim, wheel or manufacturer paint codes.
API activation and exact frontend deployment are recorded separately below.

### API activation — 5 November 2026

Implementation revision a640291 activated at 03:29 AEDT. Immediately before the
restart, the live database had zero ACCEPTED/RIDE_ACTIVE/CO_RIDE_ACTIVE journeys.
SQLite online backup completed into an ignored private directory (0700; file
0600); backup integrity, foreign keys and all 136 trip records verified. A second
underway check remained zero. Only cocowheels-api was restarted. Local health
returned ok; unauthenticated GET /api/vehicle returned 401. Post-restart database
integrity and foreign keys passed, with all 136 trip records retained. No schema
migration, production account save or acceptance was performed. Frontend push
and deployment verification remain separate from this API activation.
