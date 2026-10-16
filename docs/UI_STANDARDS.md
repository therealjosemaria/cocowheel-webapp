# Coco Wheels product and UI standards

Current decisions, 12 October 2026. Read this and [the visual-system token reference](DESIGN_TOKENS.md) before changing the UI. Keep these files updated when an agreed convention changes; do not treat older conversation notes as overriding newer decisions.

## Principles

- Route legends list Your route before Driver route. All ongoing status values use regular-weight text with the same near-black → grey → near-black pulse over three seconds and a restrained 3px, 20%-opacity shadow at its midpoint. No bold, strong glow, fading, movement or changing font weight. Reserve blue/orange for routes, not statuses. Status text can be activated to pause/resume animation and respects reduced-motion settings. Completed and all other terminal states remain static dark grey. Keep the wording visible; never communicate status by colour alone.
- Destination flags retain their true coordinates: driver orange ring, rider blue ring, matching the routes. Overlapping finish markers use the same transparency as overlapping car/person markers, never side-by-side displacement. Labels prefer their existing above-marker placement, choosing another side when needed to reduce collisions or edge clipping; shifted labels have subtle location connectors and retain the joined ETA/address design.
- Maps use shared route styles: rider blue, driver dark orange, both 7px with identical opacity; legends use the same CSS colour tokens. Car, person and checkered-finish markers are matching 32px black circles with 21px white symbols. Preserve labelled legends and overlapping-marker transparency.
- While awaiting pickup, show the shared pickup-code/verification panel directly below the map legend and above the details. Remove it after verification. PayID type and value stay closely grouped, with the Copy button alongside them for all PayID formats and both roles.
- Successful rider requests open that ride's details directly, not Activity. Details reuse the ride-selection map-first layout and route legend, with details and controls underneath and no redundant Ride Details heading. Activity opens this same shared view.
- Mobile first, desktop equally functional. Verify both layouts.
- Consistency: reuse shared screens, labels, icons, buttons and dialogs rather than building separate versions for each role.
- Non-blocking exploration: users can browse any offer, including their own. Poor fit is advice, not a prohibition. Server-enforced identity, permissions, one active role and one accepted rider remain mandatory.
- Minimal copy: avoid redundant headings, repeated statuses and explanatory filler. Never introduce layout-shifting error banners when an established modal is appropriate.
- Consider early traction in product structure: make onboarding clear and invite voluntary feedback without distracting from finding/offering rides. Prefer low-maintenance MVP mechanisms; distinguish intended engagement benefits from measured results. Do not add tracking or unsolicited outreach implicitly.

## Dialogs and actions

- Ordinary two-action confirmations: primary action first/top; dismiss second/bottom. Examples: CONTINUE / GO BACK, COMPLETE RIDE / GO BACK, USE CURRENT LOCATION / NOT NOW.
- Destructive confirmations are the exception: safe action first/top, destructive action second/bottom. Examples: KEEP IT / CANCEL RIDE or KEEP IT / WITHDRAW REQUEST. Use the existing danger treatment, not the normal primary colour.
- Buttons are stacked, full width, with equal sizing and consistent rounded corners on mobile and desktop. Ride-action and dialog buttons share 44px minimum height, 10px corners, padding, typography and shadow; equal grid rows accommodate wrapped labels. DOM and visual order must agree; do not use CSS ordering to invert keyboard navigation.
- Poor-fit and completion confirmations use the centred `cancel-prompt` shell. GPS permission uses the existing bottom-sheet `location-prompt` shell. Do not create a new one-off appearance.
- Keep one concise message, no redundant visible title. Cancellation retains the established buttons-only design. Give dialogs accessible names even without visible titles.
- Use GO BACK to dismiss a non-destructive confirmation: CANCEL could be mistaken for cancelling the ride.
- Single-action notices use OKAY. Busy actions prevent duplicate submissions and preserve the user's current context on failure.
- Existing legacy dialogs may still need accessibility work: keyboard focus containment/restoration and Escape handling should be verified when migrating them; do not assume `aria-modal` alone implements these behaviours.

## Navigation and layout

- Main menu order on mobile and desktop: Home, How it works, Activity, Offer a ride, Find a ride; authorised admin access follows near Profile. At 1000px and above, desktop items retain equal 106px widths on a single row, including Admin. Below 1000px use the existing drawer rather than wrapping the menu.
- How it works (`/help`) is public and uses the shared enclosing panel and page heading, with a short numbered list: bold action lead-ins and regular explanatory text. Keep its UniKey, request, pickup-code and PayID instructions aligned with actual behaviour.
- Help structure: pilot/UniKey introduction, four steps, then four FAQ accordions using native `details`/`summary` (initially closed, independently expandable with keyboard/touch), followed by a separate Have a suggestion? section. Reuse text/colour tokens, 44px targets and visible focus. Email us opens the university contact inbox via `mailto`, not an in-app form; future QR payments must be described as planned, not available.
- Home uses “Going your way”, equally sized FIND A RIDE and OFFER A RIDE buttons; Find is dark with white text, Offer is light. The logo is not a Home link.
- Desktop shell width is roughly two thirds of the viewport, bounded between 960px and 1360px (from the 1000px breakpoint). Home buttons are centred, 360px wide maximum and at least 64px high from 700px; mobile remains full width. Hero typography is unchanged.
- Active menu treatment is grey background, not an active shadow or competing call-to-action treatment.
- Keep equivalent heading sizes, spacing below the header divider and enclosing panels across non-Home screens, including ride details. Keep the Home footer visible without unnecessary overflow.
- Current ride access belongs on Home and Profile. Profile identifies the signed-in user; admin visibility and access are restricted server-side to the authorised account.
- Preserve route form values when returning from a preview. Empty destination entry receives focus via either Home or menu navigation; search is explicit, not intrusive autocomplete. Long result lists must scroll without clipping.

## Ride information

- Use Where from?, Where to?, Fare and Google Maps. Directions include the existing navigation icon.
- Ride details reuse the shared preview. Keep pickup/drop-off in the same column where possible, Fare and Action on the same row. Prioritise the accepted rider's pickup/drop-off for the driver; do not repeat the driver's own identity unnecessarily.
- Ordinary views hide administrative route ID, departure, expiry, fit and acceptance/request timestamps where previously agreed; retain the underlying records/admin information. Do not restore the old discovery matrix: ride selection uses the map and compact selectable ride cards.
- Keep summaries succinct: driver, pickup estimate, arrival estimate and fare where relevant. Ride details use estimated duration to avoid stale planned arrival times.
- Maps share driver/rider route colours, identifiable icons and compact address labels. The pickup minute badge is flush beside the address, not surrounded by another visible shell. Do not show pickup ETA after pickup or in history. Preserve required attribution, and keep it below navigation overlays.
- Ride-detail maps frame driver and pickup during approach, zooming closer as they converge (maximum automatic zoom 16). Manual interaction pauses approach framing. After verified pickup, follow each shared-position update. Manual pan or zoom pauses following until seven seconds after the last interaction, then resumes at the latest position while preserving the user's zoom. Initially use zoom 14 for accelerated samples and 16 for real journeys unless the user already chose a zoom.
- Revealed PayID values always have the shared Copy button, for driver and rider views including history. Copy the exact value; show “PayID copied.” in the existing Coco Wheels dialog shell with one OKAY button, no extra heading or bespoke toast. Use the same dialog for a concise manual-copy fallback on failure. Do not reveal private PayID early to provide copying.
- Every UI change includes a consistency check across mobile/desktop, Activity and ride details: reuse dialogs and button styles, hide Action cells when there is no available action, label the activity link DETAILS, and span a lone final detail cell across both columns. Keep Details as an explicit button rather than making the whole card clickable.

## Lifecycle and privacy

- Guest login: entering `guest` (case-insensitive) uses a separate account named `guest`; `mosciarobusiness@gmail.com` is only its code-delivery address. The existing Gmail account and its history remain separate. `test` is no longer accepted. Guest codes expire after ten minutes and are single-use; sessions last up to 30 days. All guest sessions share one identity, history and the one-active-role restriction, without admin privileges.

- Pickup verification (13 October 2026): GPS proximity is audit-only, never a gate. Atomically retain both latest reported GPS fixes, capture/receipt times, accuracy, verification time and measured separation in an admin-only immutable pickup snapshot. Within 250 metres is Yes/No when both fixes exist, Unknown otherwise; stale or inaccurate fixes are not proof of physical proximity. Snapshots survive live-location cleanup. No retrospective evidence is fabricated for historical rides.
- Pickup codes have no independent time expiry. They remain valid while awaiting pickup until replaced by the rider, consumed once, or the ride closes. Keep wrong-code attempt limits and renewal throttling. Existing ride inactivity expiry remains unchanged; this policy does not apply to email verification codes.

- Published is the driver's available offer; a pending request does not change the public offer into an accepted ride.
- Participant labels: Request pending → Awaiting pickup → Ride in progress → Completed. ACCEPTED and legacy RIDE_ACTIVE mean Awaiting pickup; only verified pickup (CO_RIDE_ACTIVE) means Ride in progress. Cancellation, withdrawal, decline and expiry retain distinct outcomes.
- Acceptance issues the rider's four-digit pickup code. Only the driver verifies it. Before verification, riders may see the PayID preference but not private PayID values/types. Server responses enforce this, not CSS. New offers require PayID (Mobile, Email or Other/ABN); there is no cash option. Historical cash records are retained.
- Either participant can cancel. Complete is hidden and server-blocked until the driver verifies the pickup code; no override bypasses this. After verification, either participant can complete. A fresh accurate position from either device near rider drop-off avoids an arrival warning; otherwise a concise confirmation permits completion. Completion does not verify payment.
- Accepted-trip GPS alternates device slots with single-device fallback; browsers must be open/available. Always retain actual capture age rather than imply stale GPS is live.
- Keep completed, cancelled, expired, declined and withdrawn history. Ordinary offers last six hours; test samples renew on 24-hour cycles. Never delete history just because an offer expires.

## Current fit calculation — limitations are intentional to document

`server/core.ts`, `directionFit`, assigns GOOD only if **all** hold:

1. Rider pickup is at most 1,500 metres from the straight-line segment between the driver's original origin and destination.
2. Rider destination is at most 2,500 metres from that same segment.
3. Requested departure is on/after the driver's scheduled departure and on/before offer expiry (inclusive).

Otherwise it assigns POOR. This is a coarse geometric/time heuristic. It does **not** compare road polylines, traffic, real detour distance/time, pickup-before-drop-off order, or the driver's latest GPS. Reversed journeys or geographic barriers can therefore be misclassified. Do not describe GOOD as guaranteed compatibility or POOR as impossible. Road-following map geometry is separate. Changing these thresholds or the algorithm needs an explicit product decision and tests.

## Verification and maintenance

### Automatic test samples (12 October 2026)

The three server-created samples use the normal rider-facing presentation, without sample badges or extra explanatory copy, per the owner's testing preference. Admin/internal sample flags remain. A request stays pending for five seconds, then the simulated driver accepts. The driver moves in a straight line to the saved rider pickup over 20 seconds, verifies the code automatically, then moves to the saved rider destination over 40 seconds and completes. These timings are demonstrations, not real driving estimates. The browser does not collect GPS for sample journeys, and shared sample tracking uses only the simulated driver. The server timer continues without an open browser; persisted timestamps preserve progress after restart. Cancel/withdraw stops the sequence, terminal records remain in history, and a new sample becomes available. Real drivers never auto-accept, auto-verify or auto-complete. No Start sample button is needed.

Samples reserve their offer immediately while pending. Faster sample polling does not request new road routes for each moving position.

Sample payments: Town Hall uses Mobile `0491 570 006` (an [ACMA fictional-use number](https://www.acma.gov.au/phone-numbers-use-tv-shows-films-and-creative-works)); Airport uses Email `driver@example.com`; Newtown uses Other/ABN `00 000 000 000` (deliberately invalid, display-only). These are never real payment destinations. They appear through the normal PayID view after pickup verification, without additional sample wording. Existing live samples and future renewals receive these fixtures; historical and real rides are not rewritten.

- Test both roles, mobile and desktop, pending/accepted/picked-up/terminal states and missing/stale data for relevant changes.
- Keep status wording in `lib/ride-status.ts`; reuse `PoorFitPrompt`, `CancelPrompt` and journey controls.
- Run relevant tests, lint and build. Commit and push requested changes, and report actual deployment status rather than assuming a successful push means deployment completed.
