# Coco Wheels product and UI standards

Current decisions, 12 October 2026. Read this and [the visual-system token reference](DESIGN_TOKENS.md) before changing the UI. Keep these files updated when an agreed convention changes; do not treat older conversation notes as overriding newer decisions.

## Principles

Rider-posted requests: keep Post a ride request in Choose a ride's heading row
(below the heading on phones), outside ride choices and Save route. Keep Find
riders as a secondary text action beside/below Offer a ride's heading, available
before entering addresses. Neither action publishes without explicit review.
Reuse RouteFields, ScheduleFields, JourneyMap, RideFieldLabel, ParticipantName,
ContributionChoice, PaymentFields and the existing plate prompt. Driver browsing
uses independent Any date/time filters; actual offers require a future date/time.
Only one rider route is shown on the map at once; Show/Hide route remains separate
from Offer a ride. Activity owns request cancellation and offer acceptance/decline.
Use existing driver-request-buttons for equal 44px action targets, and the shared
20px modal action gap. Nested picker dialogs own focus above their parent dialog.
The empty-history message must not appear alongside posted-request activity.

25 October: [calendar-led setup](CALENDAR_SEARCH_2026-10-25.md) supersedes the
older Find/Offer address/departure rules below. Shared address sheets are full
screen on phones and centred dialogs on desktop, with Back/Escape/focus return.
Search after 500ms idle and three characters, never every keystroke. Choosing a
place returns to the form; Find requires its explicit action. Profile retains
its existing editor. Find/Offer swap sits between endpoints. Omit unsupported
trip/passenger/class menus. Keep form content compact and centred. Endpoints are
side by side, not stacked, at all widths. On phones remove enclosing vertical
borders/side inset, keeping horizontal separators and individual field outlines;
tablet/desktop retain the frame.
Date calendar uses Reset (Today) and Done; Back/Escape discards. Time is a separate
scrollable half-hour clock-time list below date, with explicit selection/Done.
Driver times must be future; rider Any time is allowed, Around means ±1 hour
within the selected date. No automatic opening of the next picker. Dates through
three calendar months; Sydney conversion regardless of browser timezone.
Departure at least 24 hours away shows date/time; shorter countdowns unchanged.
Find's calendar includes Any date above the months, confirmed with Done like a
specific day. Today remains the default and Reset target. Changing date never
resets time and vice versa; no Any date option in Offer. Keep the choice inside
the existing picker, not an extra form control.

Address search results float above the form, matching the field width, without
layout shift. Explicit Search remains unchanged. Reuse one shared portal panel
for Offer/Find/Profile, capped at 420px and available visual viewport height;
open above when the keyboard leaves insufficient room below. Selection, outside
pointer/focus and Escape dismiss; arrow keys navigate native result buttons.
This is a non-modal dropdown, not a focus-trapping dialog.

Browser tab and Apple touch icons reuse the original public header PNG. Matching
emails use the same artwork beside the wordmark, 15px square with 6px spacing,
using presentation tables for email compatibility. Keep readable brand text when
remote images are blocked. No per-user tracking URLs or new logo variants.

Profile uses three independent, initially collapsed native disclosures: Personal
details, Usual route and Vehicle details (drivers only). Personal details keeps
photo, username and owner-only email together, with Edit/Save/Cancel and only
Add photo/Update photo (no Remove). Match the existing ink labels, 12px field
gaps and content inset; public avatars are 24px circles, editor preview 96px.
Reuse identical summary typography, person/route/car
icons, inset, border and 44px targets. Usual route contains its addresses, editors
and matching alerts; collapsing never resets drafts or consent. Email-linked
alert preferences open Usual route and focus the existing alert control once.
Matching-ride links open Find's existing map/chooser instead, preselecting the
suggested available offer without requesting it. No extra Profile review step.
No rider/driver qualifier for Usual route, which serves both roles.

Vehicle details is a collapsed, single-purpose Profile accordion using the existing
disclosure, car icon, field and button styles. Number plate is required at rider
acceptance, not publication; make/model/colour are optional. Both the prompt
and Profile mark Number plate (required); omit optional suffixes on other fields.
Profile saving requires a plate and reuses the primary Save route button treatment.
The plate-only prompt
uses the shared modal and Save & accept / Go back, preserving input on failure.
Accepted riders see vehicle details just below their pickup panel, outside chat.
The rider message starter is “Hi! Where should we meet?”. Do not duplicate plate
questions in chat or imply these self-reported details are verified.

Profile saved addresses stack Where from? then Where to? in one column, matching
edit order. Their labels match vehicle fields: ink, small/bold, directly above
regular-weight values without an added grid gap. Keep 12px between fields.
This Profile-only override does not change ride-detail captions or placeholders.
Heading-to-content spacing is 12px in both route and alert sections;
remove the saved summary's former cell padding/borders, scoped to Profile only.
Shared RouteFields includes a 44px secondary Swap addresses icon button beside
Use my location with an 8px gap, with its arrows centred inside, an accessible
name and title. Both sit below the origin input on mobile and before Search on
desktop. No separate swap row; this supersedes centred-between-fields placement.
It swaps draft text and
selected pins, not schedule/consent/fare, and never submits or advances Find.
Native schedule time fields show Choose a time when empty/unfocused; focus exposes
native time segments. Both new-route and Edit schedule use the same component.

Profile is preferences-only. Usual route shows its endpoint summary and an
Edit route secondary control matching Edit schedule. Editing expands shared
RouteFields with Save route/Cancel; cancellation discards edits, saving preserves
schedule, email and legacy payment choices. Use Matching ride alerts, not
Find/Offer a ride. No payment controls in Profile, including new-route setup;
fare and PayID belong in Offer a ride. Omit the Sydney time suffix from the
schedule summary without changing its timezone or midnight-crossing note.
No publish/departure controls
in Profile. Legacy email review links redirect to Find's matching-ride entry.
Omit the routine-privacy helper sentence; saved-route privacy is unchanged.
Usual route and Matching ride alerts both use RideFieldLabel in matching H2s,
with existing monochrome route/rider icons, equal sizing and icon/text gaps.

Find's Save route is a centred text-style button below Request to join in the
bottom action area, separate from ride results/empty-state messaging. No border,
fill or shadow; reuse small muted regular text and a minimum 44px tap target.
Same addresses become disabled Route saved on that
button, not a new toast. Different saved addresses require “Replace your saved
route?” with Replace / Cancel. Saving stays in Find; no Profile navigation.
If alerts are off and delivery available, follow successful save with “Would you
like to receive emails when matching rides become available?” Then a single line
break, not a paragraph gap, before “Change this anytime in Profile.” Use small,
muted regular helper text for that secondary guidance. Both save-route modals
are left-aligned, superseding the centred experiment. Use Notify me / Not now
in the shared modal shell.
Not now/Escape preserves the saved route and leaves emails off. Already-enabled
alerts skip consent. No permanent email helper text beside Save route.
Profile's Edit schedule uses existing day/time/checkbox/button tokens and no
replacement confirmation. New email choices start off, superseding preselection.

Home's active-ride link matches the CTA width/alignment, with wrapping addresses.
Driver-only Departure uses a normal detail cell directly below Estimated duration
in the left column, preserving stacked route endpoints on the right. Use minutes,
not seconds; remove after pickup/closure. Reuse countdown wording and normal
cell typography. Rider/public published/requested details reuse this same
planned-time/countdown display; departure-only colours follow below.

DepartureChoice replaces the two buttons with one secondary field opening a
scroll-snapping wheel, 30 minutes–24 hours in half-hour steps. Default 30 minutes.
Reuse the location-prompt shell: bottom sheet on mobile, centred on desktop.
Done commits, Go back/Escape discards; restore focus and contain keyboard focus.
Arrow/Home/End/Page keys and direct option taps supplement touch scrolling.
Show a compact dated Sydney-time preview; no seconds, new palette or dependency.
Both roles' Departure cells and emails include date/time for next-day clarity.
Intended times are flexible, not a mandatory waiting period.

Prioritise familiarity: prefer established interaction patterns and recognisable
language before inventing controls or terminology. Preserve accurate meaning,
accessibility and the shared visual system rather than copying decoration.
Discovery uses a departure-board line below pickup/arrival timing:
Departs in N min, Departing now for the scheduled minute, then Delayed. These
are schedule-based labels, not GPS-confirmed movement. From 22 October, departure
text alone is muted green above 10 minutes, dark amber at 10 minutes or less
through the first scheduled minute, and existing red from 60 seconds overdue.
This supersedes neutral departure colours, in discovery and driver Departure.
Keep wording, size and weight; no badges, backgrounds, glow or animation.
Later 22 October refinement: driver Departure keeps the planned Sydney time in
normal ink above the caption-size coloured countdown, within the same cell.
Both roles show Delayed N min using completed elapsed minutes after the existing
one-minute grace period. No dot separator. Discovery gains no extra time/row;
its arrival estimate stays unchanged. This is elapsed schedule time, not extra
waiting time or GPS-confirmed lateness.
Format departure durations below 60 minutes as N min; from 60 minutes use N hr
or N hr M min, omitting zero minutes. Apply equally to future and delayed times
in driver details and rider discovery. Avoid ambiguous colon notation such as
1:49 min. Future minutes round up; elapsed minutes round down as before.
Pickup minutes mean driving duration only, excluding departure wait.

Shared address entry (22 October): Profile, Offer and Find reuse RouteFields,
not copies of its markup. Use Where from?/Where to? placeholders and accessible
names, 16px gaps, explicit Search and the shared scrollable results. Focus the
first empty address on entry only; never refocus on each keystroke. Choosing an
origin advances to an empty destination. Both filled: do not steal focus.
Where from includes Use my location in all three editors: below the input on
mobile, immediately left of Search from 700px. Reuse secondary-button and origin
icon styling, a 44px target and an 8px mobile gap. No automatic GPS/prefill or
destination GPS button. This supersedes the earlier removal of setup GPS buttons;
active-trip tracking remains acceptance-gated and unchanged.
Find retains its map/ride-selection flow after both valid selections. Editing
text clears the corresponding selected coordinates until a result is chosen.
Departure choices keep their accessible name without a visible Leaving legend
or the former flexibility sentence. Saved-route shortcut GPS remains unchanged.

Profile polish (22 October): Profile names the menu action and H1; My usual route
is the H2. The editor uses Where from? and Where to? as placeholders instead of
visible headings; explicit accessible names remain after typing. The native time
picker has the accessible name Usual departure time, without visible Around copy.
Saved-route address labels remain unchanged. Day buttons retain an accessible group name
without a visible legend. Remove redundant setup/requirements/window prose from
the editor, but retain validation messages and the delivery-unavailable notice.
New drafts leave matching email alerts off; saved preferences
are never changed by viewing. Confirm turning off with the existing dialog shell,
TURN OFF EMAILS / GO BACK, Escape and focus restoration. A saved mute persists only
after a successful response. This supersedes the earlier preselected-email draft.

Prefer shared components over copying markup whenever behavior is equivalent.
Offer a ride uses PaymentFields for consistent placeholders, keyboard
modes, limits and labels. Profile has no payment controls. Contributions
allow cents (maximum two decimal places), with $1–$10,000 bounds and server
validation. No redundant currency prefix in the input; summaries retain A$.

Free rides (21 October): new offers and newly saved routes default to zero fare.
Reuse the native disclosure pattern for Fare · Free / Fare · A$amount. Its
“Ask for a contribution” checkbox, not its open/closed state, determines payment
mode. Reveal existing fare/PayID controls only when checked. Existing paid saved
preferences stay paid until explicitly changed and saved. Free ride previews,
cards and history say Free and omit payment controls; pickup confirmation remains
mandatory. Both How it works paths end with Share the journey, not a payment step.

Usual routes (21 October): one private Profile destination, no additional main
tab. Reuse the activity panel/H1, place search, role icons, payment selectors,
departure selector and shared modal shell. Weekdays are multi-select buttons
with `aria-pressed`, a 44px target and visible selected state; one labelled time
input serves all selected days. Show the computed Sydney-time ±1-hour window.
Email consent is explicit, initially off, with Enable/Mute on the saved view.
Offer a ride / Ride offered replace participant-facing publish wording; internal
states remain unchanged. Saved-route details, rider alerts and offering are
separate sections. Do not imply a saved route is an active ride or public profile.

**Care in every detail:** review the whole interaction, including external
handoffs and prefilled messages, not just the app screen. Aim for effortless,
welcoming use through clear wording, restrained emphasis and deliberate spacing.
Keep short prefilled messages direct: the concern sentence followed by the
reference on the next line, without a greeting or blank line. Preserve exact
identifiers; add paragraph gaps only when the content needs separation. Do not trade readability
for compactness or add decorative clutter. Verify encoded line breaks and record
when the receiving app's mobile/desktop rendering remains untested.

**Single-purpose sections:** each section contains only information and controls
for its own task. Messaging contains conversation and messaging controls, not
ride actions or support links. Ride actions belong in Action; creator support
belongs once below ride details. Reuse shared implementations without duplicating
destinations across unrelated sections. Check this boundary on every UI review.

Request-to-message discovery uses one centred helper line above the existing
Request to join button (`--text-caption`, `--muted`, `--weight-regular`, 8px
separation). Preserve the button's label, size and hierarchy. Do not introduce
another competing action or an explanatory modal. Messages start collapsed for
both roles, including after requesting. Explicit unread-message navigation may
open its target. After opening an empty conversation, offer the role-specific
tap-to-insert starter with the shared secondary button; never auto-fill,
auto-scroll, auto-focus or auto-send the suggested draft.
Suggested-message text is left-aligned and vertically centred with equal 12px
padding on every side, for both roles; preserve natural wrapping and regular weight.

### Mutual rating controls (19 October 2026)

Use the shared completed-ride rating form below the map legend and above details.
Show only the role-specific heading and five native star buttons with 44px touch
targets and visible keyboard focus. Clicking/tapping or Enter/Space submits that
star's score immediately; focusing alone does not. No helper copy or separate
Submit rating button (supersedes the initial radio/select-then-submit design).
Heading uses section/semibold; colours and controls reuse existing tokens. Errors use the
existing Message modal. Never expose individual received scores or counts below
the threshold; use the shared RatingBadge for visible averages in chooser,
requests and profile. See [ratings](RATINGS.md) for eligibility/privacy rules.
Profile panel width also reserves space for the adjacent mobile menu button so
the panel stays within the 320px viewport; desktop remains capped at 280px.

- Route legends list Your route before Driver route. All ongoing status values use regular-weight text with the same near-black → grey → near-black pulse over three seconds and a restrained 3px, 20%-opacity shadow at its midpoint. No bold, strong glow, fading, movement or changing font weight. Reserve blue/orange for routes, not statuses. Status text can be activated to pause/resume animation and respects reduced-motion settings. Completed and all other terminal states remain static dark grey. Keep the wording visible; never communicate status by colour alone.
- Destination flags retain their true coordinates: driver orange ring, rider blue ring, matching the routes. Overlapping finish markers use the same transparency as overlapping car/person markers, never side-by-side displacement. Labels prefer their existing above-marker placement, choosing another side when needed to reduce collisions or edge clipping; shifted labels have subtle location connectors and retain the joined ETA/address design.
- Maps use shared route styles: rider blue, driver dark orange, both 7px with identical opacity; legends use the same CSS colour tokens. Car, person and checkered-finish markers are matching 32px black circles with 21px white symbols. Preserve labelled legends and overlapping-marker transparency.
- While awaiting pickup, show the shared pickup-code/verification panel directly below the map legend and above the details. Remove it after verification. Driver code entry uses four actual visible inputs (44×48px, 8px gap, centred), not a transparent overlay over display boxes. Each has an accessible digit label, numeric keyboard, visible focus and select-on-tap replacement; support advance, Backspace, arrow keys and paste without auto-submitting. PayID type and value stay closely grouped; Copy is rider-only, not shown beside the driver's own PayID.
- Successful rider requests open that ride's details directly, not Activity. Details reuse the ride-selection map-first layout and route legend, with details and controls underneath and no redundant Ride Details heading. Activity opens this same shared view.
- Mobile first, desktop equally functional. Verify both layouts.
- Consistency: reuse shared screens, labels, icons, buttons and dialogs rather than building separate versions for each role.
- Non-blocking exploration: users can browse any offer, including their own. Poor fit is advice, not a prohibition. Server-enforced identity, permissions, one active role and one accepted rider remain mandatory.
- Minimal copy: avoid redundant headings, repeated statuses and explanatory filler. Never introduce layout-shifting error banners when an established modal is appropriate.
- Consider early traction in product structure: make onboarding clear and invite voluntary feedback without distracting from finding/offering rides. Prefer low-maintenance MVP mechanisms; distinguish intended engagement benefits from measured results. Do not add tracking or unsolicited outreach implicitly.

## Dialogs and actions

- UniKey code sending preserves existing labels and appends ` in Ns` below one
  minute or rounded-up ` in N min` at 60 seconds or longer while
  unavailable (for example “Send code in 45s”). Disable only code-sending controls
  during that cooldown, never the code-entry verification action. Countdown lives
  inside the existing button, without another label, layout or automatic send.
  Use tabular numerals; check portrait, landscape and desktop wrapping.
  UniKey resend uses the shared bordered secondary button (the borderless experiment
  is superseded). Retain the touch target and native button semantics.
  This form uses 16px grid gaps with zero outer button
  margins, not stacked generic secondary margins. Verify/Cancel styling is unchanged.
  Disabled secondary controls in this dialog retain the same opaque border, shape
  and typography as enabled controls; use `--line` fill and `--muted` text instead
  of global opacity fading. No hover/pressed motion or shadow while disabled.

- API outage copy is shared: “We can’t reach the server. Please try again shortly.”
  User actions reuse existing dialogs; verification/profile keep errors in their
  existing surfaces. Background failures use one fixed neutral, non-interactive
  notice, not repeated modals. Preserve loaded details with explicit stale wording;
  do not present failed search as no results or stale GPS as live. Keep validation,
  permissions and provider errors distinct. See [API_FAILURES.md](API_FAILURES.md).

- Ordinary two-action confirmations: primary action first/top; dismiss second/bottom. Examples: CONTINUE / GO BACK, COMPLETE RIDE / GO BACK, USE CURRENT LOCATION / NOT NOW.
- Destructive confirmations are the exception: safe action first/top, destructive action second/bottom. Examples: KEEP IT / CANCEL RIDE or KEEP IT / WITHDRAW REQUEST. Use the existing danger treatment, not the normal primary colour.
- Buttons are stacked, full width, with equal sizing and consistent rounded corners on mobile and desktop. Ride-action and dialog buttons share 44px minimum height, 10px corners, padding, typography and shadow; equal grid rows accommodate wrapped labels. DOM and visual order must agree; do not use CSS ordering to invert keyboard navigation.
- Poor-fit and completion confirmations use the centred `cancel-prompt` shell. GPS permission uses the existing bottom-sheet `location-prompt` shell. Do not create a new one-off appearance.
- Keep one concise message, no redundant visible title. Cancellation retains the established buttons-only design. Give dialogs accessible names even without visible titles.
- Missing-route warnings in Find, Offer and ride preview share RouteRequiredPrompt,
  reusing Message: “Choose ‘Where from’ and ‘Where to’ to continue.” plus OKAY,
  no visible heading. Quoted sentence-case field names identify the controls;
  keep the whole sentence regular-weight and retain the shared 20px action gap.
  Use the same sentence if one or both endpoints are missing. Find/Offer remain
  enabled before entry; incomplete submission preserves the form without opening
  a picker or making a search/publication request. Escape/OKAY restores focus.
- Use GO BACK to dismiss a non-destructive confirmation: CANCEL could be mistaken for cancelling the ride.
- Single-action notices use OKAY. Busy actions prevent duplicate submissions and preserve the user's current context on failure.
- Always wrap notice buttons in the existing modal action group, including a
  single OKAY: cancel-prompt-actions supplies the 20px message-to-actions gap,
  8px between actions and shared button sizing. Do not put a bare button directly
  after the message. This fixes Message/route warnings and location-switch errors
  without moving centred notices or intentional bottom-sheet/picker layouts.
- Existing legacy dialogs may still need accessibility work: keyboard focus containment/restoration and Escape handling should be verified when migrating them; do not assume `aria-modal` alone implements these behaviours.

## Navigation and layout

- The shared Profile trigger uses the saved account photo when available, with
  the existing person icon beneath as loading/error/signed-out fallback. Preserve
  its dimensions, accessible name, focus ring, popover behaviour and unread badge.
  Crop only the image to a circle; never clip the enclosing notification badge.

- Profile navigation links and account buttons share one action group: 12px
  above/between controls, equal full widths/heights and shared secondary styling.
  Button-styled links must use a block/flex box, never inline padding that can
  overlap preceding ratings. Review the entry popover as well as the destination
  whenever adding navigation, including both driver/rider missing-rating labels.

- Profile ride notifications extend the one existing active-ride link, never add
  duplicate destinations. Show a compact neutral unread-count badge and regular
  update copy below the existing status. Driver notice text is exactly “New rider
  request ↓”; reuse secondary-button styling without a backdrop, close button,
  focus lock or layout shift. No rider body notice. Newly seen driver request
  cards fade from surface-subtle to white once over two seconds; reduced motion
  disables the fade. Never scroll on an incoming update; navigation requires a
  tap/click. Read acknowledgement requires visible content, not opening Profile.

- Footer navigation contains only Privacy and Terms, centred beneath copyright; no duplicate main menu or large site-map footer. Text remains small with 44px-tall tap targets and visible focus. Public legal pages share the standard panel/H1, 18px H2 hierarchy, readable line length and revision date. Preserve Home footer visibility when adding footer rows. Legal copy must describe real behaviour, not invent guarantees or imply legal certification.
- Main menu order on mobile and desktop: Home, How it works, Activity, Find a ride, Offer a ride; authorised admin access follows near Profile. At 1000px and above, desktop items retain equal 106px widths on a single row, including Admin. Below 1000px use the existing drawer rather than wrapping the menu.
- How it works (`/help`) is public and uses the shared enclosing panel and page heading, with four single regular-weight actions per role and no explanatory text after each action. Numbers also remain regular-weight; reserve stronger emphasis for section headings. Rider step two is “Request to join a ride.” Step three mirrors “Meet your driver.” and “Meet your rider.” Keep required pickup-code verification and PayID explanations in the FAQs and relevant ride screens; simplifying the overview does not change verification requirements.
- Help starts with the role instructions, with no sign-in/eligibility introduction. Show “For University of Sydney students only.” directly above Verify UniKey in the signed-out Profile popover; preserve its existing controls and mobile menu. Existing authorised testing exceptions are unaffected.
- The FAQ uses `--surface-subtle`; Help role cards use 6% rider-blue/driver-orange tints mixed with white, corresponding coloured icons and dark text. Keep identical 16px padding and 10px corners, with no shadows or animation. Suggestions remain white. Preserve the larger H1 and matching H2 hierarchy; titles/icons identify roles without relying on colour alone.
- Help role headings reuse `RideFieldLabel` rider/person and driver/car SVGs at the existing 18px field-icon size, matching 18px H2 text, with an 8px gap and vertical centring; no emoji or icon backgrounds. Keep 12px below headings, 8px between the concise numbered steps and 24px between sections. The earlier 16px step gap suited longer explanations and is superseded. Preserve the actual PayID disclosure gate; PayID remains the only offered payment method.
- Help structure: Find a ride and Offer a ride paths with four numbered steps each directly below the page heading. Rider comes first in DOM/reading order; stack below 1000px and show two columns at desktop widths, with a 24px gap between tinted cards. Use matching section H2 tokens and concise regular-weight actions; no role tabs hiding instructions. Below both paths, keep four full-width FAQ accordions using native `details`/`summary` (initially closed, independently expandable with keyboard/touch), followed by a separate Have a suggestion? section. Reuse text/colour tokens, 44px targets and visible focus. Email us opens `jose@gumwheel.com` via `mailto`, not an in-app form; future QR payments must be described as planned, not available.
- Home uses “Going your way”, equally sized FIND A RIDE and OFFER A RIDE buttons; Find is first/top and dark with white text, Offer is second/below and light. DOM and keyboard order match visual order. Menus also place Find before Offer. The logo is not a Home link.
- Desktop shell width is roughly two thirds of the viewport, bounded between 960px and 1360px (from the 1000px breakpoint). Home buttons are centred, 360px wide maximum and at least 64px high from 700px; mobile remains full width. Hero typography is unchanged.
- Active menu treatment is grey background, not an active shadow or competing call-to-action treatment.
- Keep equivalent heading sizes, spacing below the header divider and enclosing panels across non-Home screens, including ride details. Keep the Home footer visible without unnecessary overflow.
- Current ride access belongs on Home and Profile. Profile identifies the signed-in user; admin visibility and access are restricted server-side to the authorised account.
- Preserve route form values when returning from a preview. Empty destination entry receives focus via either Home or menu navigation; search is explicit, not intrusive autocomplete. Long result lists must scroll without clipping.

## Ride information

- Rider/public published/requested details put Departure beside Estimated duration,
  below the identity/endpoints rows and before Fare. Reuse the driver's planned
  time/countdown component, colours and minute/hour formatting, superseding
  Leaving around wording. Keep the shared departure icon; no floating schedule hint
  above messages. Existing visibility gates and driver countdown are unchanged.
  A lone Fare cell before full-width Payment spans both columns, like a lone
  cell before Action; do not leave an empty half-row.

- Opening a driver pending request estimates an Extra driving cell below Requested,
  alongside Request status. Reuse the clock field icon, label/value typography and
  grid spacing. Multiple cards can stay open; Show route / Hide route independently
  displays at most one rider route and resets the previous button when switching.
  No automatic scroll, selection colour, ranking or acceptance gate. Loading and
  unavailable states are explicit. Use About N min, hours/minutes from 60 minutes,
  or Less than 1 min. Closing/reopening retries without changing map selection.
  Rider views remain unchanged. See EXTRA_DRIVING_2026-10-23.md for limitations.

- Use Where from?, Where to?, Fare and Google Maps. Directions include the existing navigation icon.
- Ride details reuse the shared preview. Keep origin/pickup then destination/drop-off
  in the right column, with identity/status and timing on the left. Driver Fare
  and Your PayID share a row; Action spans both columns at the bottom (supersedes
  the former Fare/Action pairing). Preserve rider payment privacy and Copy rules.
  Long identifiers wrap without widening the grid. A genuinely unpaired final
  field spans both columns, including one immediately before full-width Action.
  Prioritise the accepted rider's pickup/drop-off for the driver; do not repeat
  the driver's own identity unnecessarily.
- Rider requests form a labelled section with 8px heading/card spacing and 12px
  padding. Each pending request is a native independent accordion, initially
  collapsed, with rider icon/UniKey, regular caption status and disclosure marker.
  Keep existing fields/actions/chat inside; addresses stack on the right,
  identity/timing on the left, then Extra driving and Request status sharing a row,
  followed by full-width Action.
  Notification navigation opens the relevant accordion before scrolling; incoming
  updates do not open, collapse or scroll requests. Several may remain open.
  Keep support after the whole section, never inside individual accordions.
- Ordinary views hide administrative route ID, departure, expiry, fit and acceptance/request timestamps where previously agreed; retain the underlying records/admin information. Do not restore the old discovery matrix: ride selection uses the map and compact selectable ride cards.
- Keep summaries succinct: driver, pickup estimate, arrival estimate and fare where relevant. Ride details use estimated duration to avoid stale planned arrival times.
- Maps share driver/rider route colours, identifiable icons and compact address labels. The pickup minute badge is flush beside the address, not surrounded by another visible shell. Do not show pickup ETA after pickup or in history. Preserve required attribution, and keep it below navigation overlays.
- Ride-detail maps frame driver and pickup during approach, zooming closer as they converge (maximum automatic zoom 16). Manual interaction pauses approach framing. After verified pickup, follow each shared-position update. Manual pan or zoom pauses following until seven seconds after the last interaction, then resumes at the latest position while preserving the user's zoom. Initially use zoom 14 for accelerated samples and 16 for real journeys unless the user already chose a zoom.
- Revealed rider-facing PayID values have the shared Copy button, including history. Driver-facing own PayID has no Copy button (supersedes the earlier both-role convention, 19 October 2026). Copy the exact value; show “PayID copied.” in the existing Coco Wheels dialog shell with one OKAY button, no extra heading or bespoke toast. Use the same dialog for a concise manual-copy fallback on failure. Do not reveal private PayID early to provide copying.
- Every UI change includes a consistency check across mobile/desktop, Activity and ride details: reuse dialogs and button styles, hide Action cells when there is no available action, label the activity link DETAILS, and span a lone final detail cell across both columns. Keep Details as an explicit button rather than making the whole card clickable.

## Lifecycle and privacy

- Guest login: entering `guest` (case-insensitive) uses a separate account named `guest`; `mosciarobusiness@gmail.com` is only its code-delivery address. The existing Gmail account and its history remain separate. `test` is no longer accepted. Guest codes expire after ten minutes and are single-use; sessions last up to 30 days. All guest sessions share one identity, history and the one-active-role restriction, without admin privileges.

- Pickup verification (13 October 2026): GPS proximity is audit-only, never a gate. Atomically retain both latest reported GPS fixes, capture/receipt times, accuracy, verification time and measured separation in an admin-only immutable pickup snapshot. Within 250 metres is Yes/No when both fixes exist, Unknown otherwise; stale or inaccurate fixes are not proof of physical proximity. Snapshots survive live-location cleanup. No retrospective evidence is fabricated for historical rides.
- Pickup codes have no independent time expiry. They remain valid while awaiting pickup until replaced by the rider, consumed once, or the ride closes. Keep wrong-code attempt limits and renewal throttling. Existing ride inactivity expiry remains unchanged; this policy does not apply to email verification codes.

- Ride offered (formerly Published) is the driver's available offer; a pending request does not change the public offer into an accepted ride.
- Participant labels: Request pending → Awaiting pickup → Ride in progress → Completed. ACCEPTED and legacy RIDE_ACTIVE mean Awaiting pickup; only verified pickup (CO_RIDE_ACTIVE) means Ride in progress. Cancellation, withdrawal, decline and expiry retain distinct outcomes.
- Acceptance issues the rider's four-digit pickup code. Only the driver verifies it. Before verification, riders may see the PayID preference but not private PayID values/types. Server responses enforce this, not CSS. Paid offers require PayID (Mobile, Email or Other/ABN); free offers do not store or reveal payment details. There is no new cash option. Historical cash records are retained.
- Either participant can cancel. Complete is hidden and server-blocked until the driver verifies the pickup code; no override bypasses this. After verification, either participant can complete. A fresh accurate position from either device near rider drop-off avoids an arrival warning; otherwise a concise confirmation permits completion. Completion does not verify payment.
- Accepted-trip GPS alternates device slots with single-device fallback; browsers must be open/available. Always retain actual capture age rather than imply stale GPS is live.
- Published/requested offers show fixed route endpoints, not live driver GPS or
  a driver-updated timestamp. Begin live collection only after acceptance; only
  the accepted rider sees the driver's live position. Enforce on server responses
  and writes, not just map visibility. Public previews defensively ignore GPS.
- Keep completed, cancelled, expired, declined and withdrawn history. New ordinary offers expire six hours after scheduled departure; existing stored expiries stay unchanged. Test samples renew on 24-hour cycles. Never delete history just because an offer expires.

## Current fit calculation — limitations are intentional to document

`server/core.ts`, `directionFit`, assigns GOOD only if **all** hold:

1. Rider pickup is at most 1,500 metres from the straight-line segment between the driver's original origin and destination.
2. Rider destination is at most 2,500 metres from that same segment.
3. Requested departure is on/before offer expiry (inclusive). A rider may request
   a future offer now; the stored requested time is no earlier than the driver's
   scheduled departure. This supersedes the former lower-bound timing rejection.

Otherwise it assigns POOR. This is a coarse geometric/time heuristic. It does **not** compare road polylines, traffic, real detour distance/time, pickup-before-drop-off order, or the driver's latest GPS. Reversed journeys or geographic barriers can therefore be misclassified. Do not describe GOOD as guaranteed compatibility or POOR as impossible. Road-following map geometry is separate. Changing these thresholds or the algorithm needs an explicit product decision and tests.

## Verification and maintenance

Home order correction (22 October 2026, baseline `025abcb`):
`/tmp/gumwheel-pickup-check-env/bin/python scripts/check-home-order.py` passed
at 320/390/844/1440px against the local :3090 frontend with all APIs mocked and
external requests blocked. Checked DOM/vertical/keyboard order, retained dark/light
colours, no horizontal overflow, both role destinations and no browser exceptions.
Whole-screen 390/1440px screenshots visually reviewed: hero hierarchy, button
spacing/sizing, header and footer unchanged. Targeted home-client ESLint passed.
No backend changes; physical phones and production deployment remain unverified.

Menu follow-up (same date, baseline `f006490`): the same browser command now
also checks Find-before-Offer in desktop/mobile navigation, correct destinations
and the rider active state. All four widths passed; 390/1440px whole-screen menu
captures reviewed for unchanged spacing, typography and active styling. Navigation
ESLint passed. No CSS, permissions, backend or main-menu items were changed.

Before committing or pushing, review git status, the full diff and the staged
diff against the requested scope. Check each hunk for unintended changes,
especially authentication, permissions, payment, providers and production
configuration. Passing tests do not replace this review. Public contact copy
must remain separate from account identities and verification-email routing.

Every UI/copy edit requires a whole-screen aesthetic review on mobile and desktop:
check competing text weights, heading/body hierarchy, icon prominence, colour
and spacing. Shortening copy can invalidate its previous emphasis; remove bold
lead-ins when they become the entire body. Preserve useful emphasis on headings
and interactive controls instead of flattening everything. Automated checks
complement, but do not replace, visual inspection of the changed screen.

### Automatic test samples (12 October 2026)

Superseded for production on 19 October 2026: samples are disabled by default,
available offers closed without deleting history, and no replacement offers are
created. The following describes explicitly enabled isolated tests only.

The three server-created samples use the normal rider-facing presentation, without sample badges or extra explanatory copy, per the owner's testing preference. Admin/internal sample flags remain. A request stays pending for five seconds, then the simulated driver accepts. The driver moves in a straight line to the saved rider pickup over 20 seconds, verifies the code automatically, then moves to the saved rider destination over 40 seconds and completes. These timings are demonstrations, not real driving estimates. The browser does not collect GPS for sample journeys, and shared sample tracking uses only the simulated driver. The server timer continues without an open browser; persisted timestamps preserve progress after restart. Cancel/withdraw stops the sequence, terminal records remain in history, and a new sample becomes available. Real drivers never auto-accept, auto-verify or auto-complete. No Start sample button is needed.

Samples reserve their offer immediately while pending. Faster sample polling does not request new road routes for each moving position.

Sample payments: Town Hall uses Mobile `0491 570 006` (an [ACMA fictional-use number](https://www.acma.gov.au/phone-numbers-use-tv-shows-films-and-creative-works)); Airport uses Email `driver@example.com`; Newtown uses Other/ABN `00 000 000 000` (deliberately invalid, display-only). These are never real payment destinations. They appear through the normal PayID view after pickup verification, without additional sample wording. Existing live samples and future renewals receive these fixtures; historical and real rides are not rewritten.

- Test both roles, mobile and desktop, pending/accepted/picked-up/terminal states and missing/stale data for relevant changes.
- Keep status wording in `lib/ride-status.ts`; reuse `PoorFitPrompt`, `CancelPrompt` and journey controls.
- Run relevant tests, lint and build. Commit and push requested changes, and report actual deployment status rather than assuming a successful push means deployment completed.
# Private messages — 20 October 2026 addition

Concern links use a small decorative monochrome Bootstrap WhatsApp icon to the left of the
text. Keep messaging summaries unchanged, with their disclosure arrow only;
do not add a competing chat icon. Support retains its 44px touch target, left
alignment and no border/badge. Place it last below all participant details and
driver request cards, with zero outside vertical margin; the tap target provides
breathing room. Keep identical placement rules for both roles.

Request-scoped chat uses a native expandable section and existing small text,
surface/line/radius tokens. Body text stays regular; only the summary is semibold.
It is
placed before its associated detail grid in both roles. Pending driver cards
put chat immediately after their parent summary; fields/actions are siblings
below it, never nested inside messaging.
Messages are plain text; no read receipts, typing animations or extra colour
palette. Send message is the sole composer action, using the shared primary
button with a 44px minimum target. No ride-action navigation inside chat; Report a concern via WhatsApp appears once below ride details/actions, never in conversations.
Keep 12px above the enclosing ride-details panel. Shared map legends retain
caption size and role colours: location copy uses “Updated”, not “Last updated”,
and minutes use “min”. Below 600px, location age occupies its own centred row;
route names remain unbroken with non-shrinking swatches. Wider legends can wrap
whole items rather than shrink text.
The former Stop messaging button/dialog is removed. Messaging closes with the
request/ride lifecycle; previously stopped conversations remain stopped.
Existing cancellation/error modals retain their layout with keyboard focus
containment, idle Escape dismissal and focus return to the trigger.
No automatic page scrolling on arrival; only an explicit Profile/anchor action navigates. Use the accurate
“University email verified”, not “Verified driver/student”. See MESSAGING.md.
