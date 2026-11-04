# Journey role artwork — 4 November 2026

## Transparent artwork cleanup — 5 November 2026

The standing-person light and dark surface WebPs now use v2 assets, cleaned using
image generation to remove the studio/checkerboard residue while retaining the
standing pose. The existing generic car is unchanged. The BYD Shark 6, Isuzu
D-Max and Toyota RAV4 six-colour sheets were also cleaned and prepared again;
their source images and original source references are recorded in the vehicle
catalogue manifest. Some other models retain subtle original shadows; this is
not a blanket rework of the entire catalogue.

Profile and shared map markers add `?background=2` to those three models' image
display URLs to avoid reusing cached older images. Server-supplied artwork paths
remain the existing strict allowlisted paths. All other display paths are unchanged.
This modifies presentation only, with no API or privacy change.

The cleaned standing-person source images are retained in the local generated
image archive as `exec-b6001ce1-b93a-445a-a23c-755a299fb3b1.png` (light) and
`exec-fde97822-0e1c-4fab-9dd7-f3cb9e77d21e.png` (dark). They were resized to
the existing 128×256 WebP slots. Image generation can change small details; the
before/after illustrations were reviewed against light and dark backgrounds.

On 5 November, `npm test` (253 tests), `npm run lint`, `npm run build`,
`scripts/check-journey-role-art.py` and `scripts/check-vehicle-map-consistency.py`
passed. The local synthetic-data checks covered 390px and 1440px screens; Home
and Find screenshots were visually reviewed with public OSM tiles. They cover the
white BYD and the generic car/person, not every model or real device. Production
appearance and deployment remain to be verified separately.

5 November: [personal vehicle illustrations](VEHICLE_CATALOGUE.md) initially extended
owner and accepted-pair driver map markers; the later [all-map extension](VEHICLE_MAPS_2026-11-05.md)
supersedes the Home/discovery-generic restriction. Generic car/person artwork
remains unchanged for semantic labels and missing/custom vehicle selections. Twenty
model silhouettes each have six paint states, with the same 48px map slot and
anchor. These static images introduce no heading/orientation/GPS animation.

## Original scope

The later [Home presence implementation](HOME_PRESENCE_2026-11-04.md) supersedes
the original homepage-preview-only boundary below; the existing artwork is reused.

Source baseline 38ea32a. The owner approved the generated graphite person/silver
car concept and explicitly selected **existing journey icons only**. The homepage
map screenshots remain proposals; no public inventory endpoint or homepage map is
introduced. No API, identity, GPS, permission, tracking, lifecycle or schema changes.

Shared RideFieldIcon renders the 3D car for driver and the 3D person for rider.
This reaches Home actions, Help steps, Activity/journey fields, review modals and
Vehicle details wherever those existing semantic icons are used. Search-result
cars and Activity card role headers also reuse that same component; the results
car loses its former blue circular surface and uses a 32px artwork slot.
Account/profile avatars remain identity photos/placeholders. Other action/location/status icons
retain their existing SVGs. Labels remain the accessible names; artwork is hidden
from assistive technology and never adds a keyboard stop.

Shared JourneyMap uses the same sprite/classes: driver is the car, departure and
pickup retain their existing person meaning. Role markers lose the black circular
background. Destination flags, route colours, controls, tooltips, popups, map
providers, public/private visibility and interactions retain their semantics.
Role markers have a 48px slot and [24,40] ground anchor; driver/pickup overlap uses
48px separation. Text/ETA labels sit above the taller model with appropriate side
clearance; destination separation stays 32px. Existing overlap dimming remains.

## Asset and sizing

Approved source: exec-573ec164-ecea-4508-92c3-82c396d084d6.png (1774x887 RGBA),
generated in this design conversation. It is a single-direction concept pair,
not a rotatable 3D model, sprite animation or source for reliable travel heading.
No new sensor data, model rotation or simulated movement is introduced.

Reproduce from that approved source with:

`node scripts/prepare-journey-icons.mjs /path/to/approved-concept.png light`

`node scripts/prepare-journey-icons.mjs /path/to/approved-on-dark-concept.png dark`

The existing sharp dependency resizes the complete composition to 532x266 and
encodes WebP quality 90 / alpha quality 100. The dark-surface source is a
colour-only image-generation edit requested by the owner’s contrast correction:
pale silver clothing/white car, same framing. The edited source is
exec-57bed0f2-7411-4a1c-8cd7-88eefe6c64fe.png (1774x887 RGBA).
The light-surface public/brand/journey-roles-3d-v1.webp is 25,016 bytes;
the on-dark sibling retains the same bounds and alpha. CSS displays proportional
windows of the matching surface variant; neither subject is stretched. Version the filename when the approved art changes.

CSS bounds refer to the original composition: person x225/y60/w390/h795,
car x800/y135/w930/h700. Within a 48px slot, person is 46px high and car is 44px
wide, with a 1px bottom inset. The same normalized geometry scales to labels
(20px) and Home CTAs (28px). These are optical sizes, not literal physical scale.
Home’s dark action and existing primary surfaces select the white/silver sibling
through CSS; light surfaces retain the graphite/silver source. There is no colour
inversion, glow or new application dark mode. The explicit journey-role-art-on-dark
class is available for a known dark surface. This is background-dependent, not
based on the operating system theme.
No SVG/image-font dependency or new third-party asset host is required.

## Verification

Run `npm test`, `npm run lint`, `npm run build`, then the isolated preview with
all application APIs mocked: `python scripts/check-home-order.py`,
`python scripts/check-request-maps.py`, `python scripts/check-request-details.py`,
and `python scripts/check-journey-role-art.py`.
Record results and full-screen mobile/desktop visual evidence below. Inspect
Home, Help, Profile/Vehicle, Activity, driver/rider results and detail maps for
spacing, wrapping, hierarchy, contrast, asset decoding and marker/label overlap.
Synthetic fixtures must not create real journeys, accounts, emails or GPS data.
No API restart is required for this frontend-only change. A push alone is not
verified deployment; check the exact Vercel revision and public asset after push.

### Verified local checks

All 237 regression tests pass; lint and the final contrast-aware production build
pass. Browser checks pass at 320/390/844/1440px for Home/menu alignment, keyboard
order, role navigation, driver/rider search maps, request details and mixed
Activity spacing (nine cards, equal 10px gaps). The dedicated art check passes at
390/1440px across Home, Help, Profile/Vehicle, Activity and driver-detail screens:
both 532x266 assets decode, actual dark/light background selection is correct,
artwork remains decorative, map model slots are 48px and transparent, and there
are no runtime errors, unexpected writes or horizontal overflow.

The on-dark asset is 24,798 bytes; both variants together are 49,814 bytes.
Application APIs and road paths were mocked, with no live account/journey/message,
email, GPS or acceptance writes. The art-specific visual check allowed read-only
public OpenStreetMap tiles for synthetic Sydney endpoints; other external traffic
was blocked. Other browser suites block all external providers.

Whole affected screens were visually reviewed on phone and desktop: Home light
and dark buttons; Help role headings; expanded Vehicle details; Activity role
badges/fields; rider search cards; and map/route-detail layouts. Typography, action
hierarchy, wrapping and controls remain consistent. The new white/silver person
is visible on the ink Home button, without a glow/inversion or enclosing badge.
Physical phones, unusual browser image-blocking settings and directional icon
rotation are not verified; directional rotation is outside this change.

Earlier browser fixtures had stale discovery controls (Edit search/heading versus
current Back/region), missing pending-request/sent-offer endpoints and selectors
for Activity's superseded separate wrappers. Those synthetic checks initially
failed; fixtures were corrected to the current API/unified Details layout and
rerun successfully. No production behavior was changed to satisfy those fixtures.
React review found no new hooks, dependencies, duplicated actions or permission
changes; the old standalone result/Activity role glyphs now reuse RideFieldIcon.

### Verified production activation

Implementation 05205b4f6311f8005d17c34ed7d0d90db00ed429 was committed and pushed.
Vercel production deployment dpl_DYGjrLdsgBvjjbRJ9zSWpUGTrwkd is READY for that exact
revision and aliased to www.gumwheel.com. Fresh guest Chromium checks against the
public homepage pass at 390/1440px: both WebPs decode at 532x266, the dark CTA
selects the white/silver source and the light CTA the graphite/silver source,
Home has no added map, no horizontal overflow and no runtime errors. The rendered
live mobile screen was also visually inspected. These checks performed no
journey/account/message writes, GPS access or test emails. Authenticated maps and
Activity were verified with synthetic local APIs, not with live participant data.
The API was not restarted; no backend configuration or data changes were needed.


## Standing rider refinement

4 November 2026: the owner's stationary/waiting correction supersedes the walking
person above. Both feet are planted, legs relaxed and arms at the sides. The
original car WebPs and driver sprite coordinates are unchanged byte for byte;
only rider backgrounds use new transparent 128x256 assets:

- public/brand/journey-person-standing-v1.webp (7,294 bytes)
- public/brand/journey-person-standing-v1-on-dark.webp (8,066 bytes)

Built-in image generation edited the approved style into a 1774x887 transparent
pair, source exec-21342ee6-10ff-47f4-ab16-6b6ce878ab00.png. Final prompt: change the
faceless person's pose to standing still waiting, both feet planted, relaxed
straight legs and arms at sides; preserve polished monochrome 3D materials,
clothing, high three-quarter camera and lower-right facing direction; render
matching graphite and off-white people side by side on transparent alpha with
no car, text, circle or pedestal. No model or tracking behavior was added.

Reproduce web preparation with:

`node scripts/prepare-standing-person.mjs /path/to/approved-standing-pair.png`

The helper splits the two halves, trims empty margins, fits each proportionally
inside 128x256 transparent pixels and encodes WebP quality90/alpha100. CSS fits
these inside the existing rider window. The car still uses its original sprites;
label/Home/map slots, ground anchor and dark-surface rules remain unchanged.
Validation on 4 November: npm run build, npm run lint and all 237 npm tests pass.
Reproducible browser checks (using /tmp/gumwheel-notification-check-env/bin/python):

- scripts/check-journey-role-art.py: 390/1440px, correct role/surface asset,
  four WebPs decode, decorative semantics, 48px transparent map model, no errors,
  overflow or writes. Home, Help, Profile, Activity and driver detail captured.
- scripts/check-home-order.py: 320/390/844/1440px, button alignment, keyboard
  order, navigation, spacing and responsive layout pass.
- scripts/check-request-details.py: all four widths pass for synthetic rider
  request/detail/status/recovery flows; its map uses generic endpoint dots.

Whole Home, Help, Profile and Activity screens were visually reviewed at 390/1440px;
Home's pale rider is clear on ink and the graphite rider on light surfaces. The
standing pose reads clearly without competing with labels; car, typography, gaps
and action hierarchy remain unchanged. Driver map/detail was also reviewed.
APIs were mocked, no live accounts/trips/GPS/email writes; art checks permit only
read-only public tiles for synthetic endpoints. Physical phones and authenticated
production trips remain unverified.

Production activation: implementation b3c905ddeb0071c1e75e9920154b35fa6537a668
is pushed and deployment dpl_3gKu1C7DuVGcrgFfhxcKpYiZuCGN is READY and aliased to
www.gumwheel.com. Fresh guest Chromium checks at 390/1440px pass: standing-person
and original car assets decode, Home chooses the correct surface variants, no
added map, overflow or runtime errors. The live phone viewport was visually
reviewed. Read-only public Home/assets only; no API restart or backend changes.
