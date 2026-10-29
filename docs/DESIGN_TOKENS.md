# Coco Wheels visual system

29 October Home session gate introduces no visual tokens. Keep the hero, CTA spacing/icons and existing authenticated reconnect message styles unchanged; review both successful and failed account states.

29 October Sydney guide and 404 recovery: reuse activity-page/activity-panel/page-title/help-section/help-email; no new spacing, typography, colour or artwork tokens. Check whole pages at phone/tablet/desktop widths.

29 October About/Help refinement introduces no visual tokens. Reuse activity-page,
activity-panel/page-title, help-section, help-faq and help-email. Keep explanatory
body regular-weight and the existing 24px section spacing, 44px link/summary
hit targets and visible focus. The Home noscript fallback reuses the shared panel
and body padding; enabled-JavaScript Home typography/spacing remain unchanged.

29 October Home's “Share your journey.” reuses home-hero and the existing hero
scale, weight, letter spacing, centred alignment and button spacing. No subtitle,
new palette or additional type role. Review wrapping at phone and desktop widths.

28 October admin sign-in reuses activity-panel/page-title, university-form and
primary/secondary buttons; cap the inline panel at the existing dialog width of
420px. Menu removal introduces no replacement icon, spacing or colour token.

28 October: --status-active aliases --departure-scheduled (#166534), the existing
dark green (7.13:1 against white). Available, Open, Awaiting reply and ongoing ride
statuses use this text colour only. Font size/weight and transparent background
are unchanged. Existing ongoing shadow animation no longer changes text colour;
pause/reduced-motion behaviour remains. Offer summaries use activity-open DETAILS;
withdrawal uses activity-request-end inside the shared detail layout.

Activity's unified list retains demand-activity's 10px gaps. WITHDRAW OFFER uses
activity-request-end: the same border, danger colour, background, radius,
caption typography, padding and focus treatment as WITHDRAW REQUEST. No new tokens.

Request discovery selection shares `.ride-option.selected` styling: ink border,
subtle surface and 3px inset marker. Identity headers reuse 14px/bold, 12px inset,
24px participant photos and the existing 6px photo/name gap, with a 44px minimum
native button. Its extended tap area excludes the separate action buttons.

27 October request results reuse ride-selection-page/map/back/options/list tokens:
the existing responsive 310px-minimum map and 31svh list cap (240px desktop).
Request cards use the list's 8px gaps, not the old discovery 16px card margins;
12px top inset separates them from the map/legend. Shared card fonts, icons and
44px paired controls remain. Activity's 260px request map is unchanged.

27 October: rider contribution review reuses contribution-choice/body and field
tokens, the existing decimal input and regular modal error copy. Offered
contribution cells use the existing price icon, caption and value typography.
Discovery's four cells form two rows; only an odd final demand cell spans both
columns. Modal cells remain single-column. No new colour, spacing or font tokens.

Modal alignment (26 October 2026): shared dialog shells explicitly left-align
copy. Journey review cells remove their nested horizontal padding, retaining
vertical spacing and icons; their left edge matches the message and action group.
Shell padding remains 22px for confirmations/location prompts, 24px for sign-in,
and 16px for desktop search sheets (12px horizontal on mobile, with vertical
safe-area handling). Intentional centred picker/button content is unchanged.

Audited 12 October 2026. Source of truth: `app/globals.css` `:root` tokens and shared semantic selectors. Read alongside `UI_STANDARDS.md` before extending any screen.

## Audit findings

The stylesheet had one explicit UI font stack (Arial, Helvetica, sans-serif), four family declarations including inheritance, 99 size declarations with 38 distinct written values, five numeric weights, and 26 distinct text-colour expressions. These are source counts, not 38 independently rendered fonts. Browser defaults also supply monospace for `code` and heading weights. Offer a Ride's “You receive” inherited body size while “Your PayID” explicitly used 0.78rem.

All existing font-size declarations now reference the scale below. Equivalent form labels and summary-cell labels/values share semantic rules. Inputs use 16px so mobile focus does not require smaller text. PayID values use the UI family rather than the browser's code font. Keep “You receive” (present tense).

## Typography

26 October requested-journey summary/detail refinement: reuse activity-card-fields,
activity-card-action/activity-open and status/endpoint/departure/view icons.
Four summary cells form two rows; View spans the last row on the Activity list.
Detail Back is an inline-flex text-button with a 44px minimum target and 16px
bottom gap to clear the existing card role label. RequestRouteMap and existing
offer/withdraw action groups stay unchanged; no new palette or font scale.

26 October request-map refinement: reuse the 260px demand-map viewport in
discovery and Activity, with its map-shell filling the viewport so attribution
and controls remain visible. Existing route legend, colours, card fields and
two-column driver-request-buttons are reused; no new palette or typography.
Address sheets retain the existing header row with Back only; date/time headings
are unaffected. Route-failure helper and Try again use existing note/text-button
tokens rather than a new alert banner.

26 October Profile/navigation refinement supersedes the grouped-card description
below: Profile has one secondary Your journeys link using existing
profile-active-ride and regular small update-copy styling. No new icon, accordion
or palette. Map Back reuses text-button typography and the existing white map
control surface/border/shadow, control radius, 8px/12px padding and at least 44px
height/width, replacing its circular arrow. Shared date/time picker headers use
the existing text-button Back control with unchanged spacing and 44px targets.

Profile's Your rides region groups existing active-ride/post links with a 12px
grid gap. Post cards reuse the rider icon and existing notification caption;
no new border, palette or heading. Save route precedes Request this journey
in the existing wrapping secondary action row (left/right when on one row).

Rider-demand screens reuse the existing typography and map palette. Header
secondary actions use 14px text with 44px targets; paired actions reuse
driver-request-buttons (12px labels, 44px minimum height, 8px gap, no primary
shadow). Request cards have 16px separation; modal route summaries stack to avoid
crowding narrow screens. Existing line/surface/radius tokens remain unchanged.
Discovery's back action stacks above the heading at all widths, left-aligned,
with an 8px gap and the existing 14px text / 44px target. DOM order matches display.
Find riders now reuses the quiet centred save-search-route action wrapper below
Post a journey (scoped 12px top padding, regular text, 44px target). Standalone save-route
wrappers retain their 4px padding. The discovery view uses a concise Search button
under its descriptive heading. Save route and Request this journey share a centred,
wrapping secondary row below Request to join: 12px top/horizontal gap, regular
text, equal 44px minimum targets and 8px/12px button padding. Saved-request links
retain the same target. No duplicate wrapper padding or list placement.
Switching uses existing safe/danger modal
buttons and body typography, not a new heading or palette.

Personal details reuses Profile's 14px ink/bold labels and regular values, 12px
field/content spacing and existing primary/secondary controls. Photo previews
are 96px circles; compact participant avatars are 24px with a 6px name gap,
using the subtle surface/line tokens. Names wrap rather than forcing overflow.
No new palette or typography scale for public profiles.

One UI family: `--font-ui`, Arial, Helvetica, sans-serif. No new web fonts. Root browser size remains 16px; respect user zoom.

| Role | Token | Size |
| --- | --- | --- |
| Cell labels, compact buttons, helper text, route legend | `--text-caption` | 12px |
| Panel/cell values, form labels, ride names | `--text-small` | 14px |
| Body, inputs, ordinary H3 | `--text-body` | 16px |
| Ordinary H2 / section heading | `--text-section` | 18px |
| Emphasised subsection / larger control | `--text-subheading` | 20px |
| Pickup digits, dialog display heading | `--text-code` | 24px |
| Admin metric | `--text-admin-metric` | 32px |
| Page H1 | `--text-page` | responsive 30.4–44px |
| Home hero only | `--text-hero` | existing responsive 58.4–89.6px |
| Existing small-screen display exception | `--text-display-small` | 57.6px |
| Map MIN unit only | `--text-map-unit` | 7.36px; never use for ordinary text |

Use 400 (`--weight-regular`) for body/status, 600 (`--weight-semibold`) for restrained emphasis, and 700 (`--weight-bold`) for headings, labels and buttons. Do not introduce 750/800 or animate weight. H1 page titles and the home hero are deliberately different; do not make every semantic H1 hero-sized. Keep existing sentence case; established primary action labels remain uppercase.

## Colour roles

| Role | Token / value |
| --- | --- |
| Primary text and dark buttons | `--ink` #111827 |
| Secondary labels and supporting text | `--muted` #64748b |
| Surface / subtle surface | `--surface` #ffffff / `--surface-subtle` #f8fafc |
| Dividers and neutral borders | `--line` #e2e8f0 |
| Destructive action | `--danger` #b42318 |
| Departure >10 minutes | `--departure-scheduled` #166534 |
| Departure ≤10 minutes / departing now | `--departure-soon` #854d0e |
| Departure delayed (≥60 seconds overdue) | `--departure-delayed` #b42318 |
| Rider / driver routes | `--route-rider` blue / `--route-driver` dark orange |
| Finished status | `--status-finished` #444444 |
| Active status | `--status-active` → `--departure-scheduled` #166534 |

Prefer these tokens. Existing map/provider imagery, focus rings, admin semantic indicators and translucent shadows are intentional contextual colours, not new brand palettes. Historical compatibility aliases `--ocean`, `--coral`, `--sun`, `--mint`, `--paper` are not permission to introduce extra brand colours. New exceptions need a documented semantic purpose and contrast checks.

## Icons, controls and spacing

- Journey update markers reuse active-ride-update text below DETAILS with a 4px
  gap and regular weight. Activity highlighting reuses request-arrived and its
  neutral two-second animation/reduced-motion rule; no new colour or badge style.

- Home journey CTAs reuse RideFieldLabel with --icon-label set to --icon-field
  (18px) and an 8px gap. Existing rider/car paths and stroke weight are unchanged.
  Centre the whole group; use currentColor (white on dark, ink on white), with
  unchanged button dimensions, typography, shadows and focus/pressed states.

- Activity uses 10px between cards, including post-to-history boundaries.
  No separate Posts and offers heading or reserved heading margin.
  Posts and sent offers reuse activity-role (caption/bold, 16px icon, 6px gap)
  and the normal 18px card top inset. Posts are always open; no summary arrow.

- Single-action Message and location-error dialogs use cancel-prompt-actions,
  matching existing confirmations: 20px above actions, 8px between buttons and
  shared 44px-minimum action sizing. Preserve the centred 420px-max shell with
  22px inset and 18px viewport gutters. No new spacing or positioning values.

- Find's Any date calendar choice reuses secondary-button geometry, regular text and a 44px
  minimum target, with 12px below it. Selected uses existing ink/surface colours,
  matching selected calendar days. No new palette or main-form row.

- Calendar-led Find/Offer setup (25 October) uses a centred 680px-max form and
  side-by-side endpoints with Swap between them. Below 700px remove only the
  enclosing panel's vertical borders, corner radius and horizontal inset;
  retain horizontal separators and field outlines, with 8px outer gutters.
  Mobile endpoints share an edge; a 32px visible swap circle overlaps that join
  inside its 44px touch target, reserving inner field padding. Tablet/desktop
  keep the frame. It uses existing page headings, secondary fields and primary final action. Swap is
  44px, between endpoints; date/time have the existing departure/clock icons.
  Search sheets are 560px-max/85dvh on desktop, full visual viewport below 700px,
  with 16px/12px insets, existing ink/surface/line and control radius. Calendar
  uses seven equal columns, 4px gaps and 44px-high day targets; selected dates/times
  use ink with white text. Actions stay outside scroll areas. No new palette,
  font or dependency. This supersedes the relative departure wheel and floating
  address dropdown for Find/Offer; Profile retains its prior treatment.

- Header Profile photos fill the existing 42px circular button's inner box,
  object-fit cover and 50% radius. Keep the existing 20px person icon as fallback,
  unchanged border/focus ring and unread badge above the photo. No new palette.

- Address results use the existing surface/line/shadow dropdown treatment,
  fixed to the field bounds through a body portal, 5px gap, 420px maximum height
  constrained to the visual viewport. Results retain 12px padding and minimum
  44px targets. No inline-results reflow; no page/heading/button resizing.
- Email brand icon uses a zero-line-height cell with 3px bottom padding for an
  approximately 1.5px optical lift toward the capital-letter centre. Original
  15px artwork, 6px horizontal gap and wordmark typography remain unchanged.

- Matching-email HTML repeats the existing palette inline for email clients:
  ink, muted, surface, surface-subtle and line; Arial, 20px semibold title,
  16px body/CTA, 14px support and 12px preference link. One 560px-max column,
  24px inner and 16px horizontal outer padding, dark rounded 10px CTA.
  No tracking image, extra colour or external font. Plain-text fallback retained.
  The brand row includes the original header PNG at 15×15px, 6px gap after the
  16px bold wordmark (0.08em tracking), vertically centred using table cells.
  Serve the original without recompression; empty alt avoids duplicate branding.

- Profile disclosures share contribution-choice and profile-disclosure: 16px
  outer inset/gaps, 12px inner padding, 14px semibold summaries with existing
  monochrome icons. The usual-route body has no second horizontal inset; headings
  inside remain section-sized. The driver-only qualifier shares summary styling.

- Vehicle details reuses the contribution disclosure border, radius and 44px
  summary target, with the existing car icon. Fields use the shared 16px inputs,
  12px related gaps and regular body copy. Pickup vehicle summary uses 14px text,
  12px padding and 4px value gaps, existing neutral border/radius; no new palette.
  Save vehicle details uses primary, matching Save route; other vehicle actions
  keep their existing styles.

- Profile body uses 12px related-content gaps; saved address summary is one column
  with 12px between fields and no inset/border. Other ride grids are unchanged.
  Saved address dt labels use --ink, --text-small and --weight-bold, matching
  vehicle form labels; the label/value grid gap is zero. Values stay regular.
  Shared route swap uses the secondary control border/radius, 44px square target,
  18px monochrome two-arrow SVG beside Use my location with an 8px gap.
  Grid place-items centres the icon on both axes. Group uses inline-flex with
  centred alignment; mobile below origin, desktop before Search. No standalone
  row or negative margins. The two address fields retain their 16px grid gap.
  Time hints use body/muted tokens, inset 12px and centred vertically; native input
  dimensions, keyboard semantics and focus appearance remain unchanged.

- Extra driving is a normal pending-request cell below Requested, next to Request
  status. Reuse RideFieldLabel's clock icon at 14px, caption/muted label and normal
  14px regular ink value, standard grid padding and 4px label/value gap. No bespoke
  CSS, selection colour, badge or animation. Action remains full width.

- Profile's Edit route matches the existing Edit schedule secondary control.
  Its expanded editor reuses RouteFields and primary Save route / secondary
  Cancel controls; preferences headings retain the existing section typography.
  No new spacing, colour or typography tokens are introduced.

- Find's Save route reuses text-button left of Request this journey below Request to join,
  in the 12px-spaced secondary row described above, with a minimum 44px tap target,
  no border/fill/shadow and regular text.
  It remains outside results. Consent/replacement reuse cancel-prompt,
  left-aligned body text; the Profile note uses small/muted/regular tokens after
  a single line break, with no extra paragraph gap.
  Keep regular paragraphs and stacked equal actions. Profile schedule editing reuses
  existing checkbox, weekday and native time controls; no new tokens.

- Home active-ride cards use the same min(100%, 360px) width/centering as CTAs
  above 700px; do not resize the Profile version. Driver Departure reuses the
  detail grid, departure icon and body-value tokens, without animated emphasis.

- DepartureChoice uses a full-width secondary control with regular body text.
  Its location-prompt sheet contains a 220px scroll viewport and 44px option rows,
  two rows of end padding to centre boundary choices, ink/subtle selected state,
  and a small/muted dated preview with 12px separation. Existing Done/Go back
  action styles remain; desktop centres the same sheet. No PayID styling changes.

- Discovery's departure line uses the existing timing caption size, departure colour
  and inherited weight, in the third grid row beneath pickup/arrival. Fare and
  PayID retain their right-column rows. No badge or new font. Departure tokens
  also apply to the driver countdown, not general ride statuses or map routes.
  Contrast on white: green 7.13:1, amber 6.85:1, red 6.57:1; on surface-subtle:
  6.81:1, 6.55:1, 6.28:1. Text always communicates the state without colour.
  Driver and rider-detail Departure stack normal-ink planned time and caption/regular coloured
  status with a 4px gap, in the existing cell. Discovery retains its single
  departure caption. Delayed N min has no separator or added emphasis.

- Shared RouteFields uses a single minmax(0, 1fr) grid with 16px gaps, zero
  nested PlaceSearch margins and the existing input/Search/results tokens.
  Ordinary Offer/Find give the section 16px bottom spacing; Profile's parent
  grid supplies its spacing. No new typography, colour or button style.
  Origin's Use my location secondary action has a 44px minimum target, caption
  text and shared origin icon. Below 700px it sits 8px below the input; wider
  layouts place it directly left of Search. Only the visible responsive control
  participates in keyboard navigation. Search remains on the right.

- Profile's route editor uses placeholders and accessible names instead of visible
  origin/destination/time labels; Usual route retains section/semibold and uses
  the same RideFieldLabel icon sizing/gap as Matching ride alerts.
  Native time inputs and their grid parents have min-width: 0;
  time inputs use border-box and 100%/max-width:100% to contain mobile intrinsic
  sizing. The editor uses an explicit minmax(0, 1fr) grid track; time controls
  reset native appearance and WebKit edit padding without replacing the picker.
  Keep native pickers and 16px input text. Profile no longer includes payment
  controls; Offer retains PaymentFields and its existing spacing/selectors.

- Contribution settings reuse a native details/summary accordion: surface/line,
  control radius, 12px inset/gap, small text and semibold summary with a 44px
  target. The explicit checkbox reuses the usual-route email checkbox sizing.
  Body remains regular; fare and PayID retain shared label/input tokens. Closing
  the disclosure does not change the checkbox. No new palette or animation.

- Usual-route settings reuse the 680px compact panel, standard page title,
  16px field gaps and 12px related-content gaps. Role headings use section/
  semibold, helpers small/muted. Day buttons wrap with 8px gaps, minimum 44px
  targets, and ink/surface selected state; four equal columns on phones and seven
  from 600px avoid a single oversized Sunday button. No new palette or animation.

- Pending request accordions use the shared surface/line/control radius, 12px
  section and summary padding, 8px section gap, 14px semibold identity and 12px
  regular muted status. Native disclosure markers and 44px minimum summary targets
  remain keyboard accessible. Ride Action spans both columns; driver PayID shares
  the Fare row and wraps long values. No new fonts, colours or shadows.
- Cell-label and Copy icons: `--icon-label`, 14px; field/location icons: `--icon-field`, 18px.
- Help role headings scope `--icon-label` to `--icon-field` (18px) beside the 18px H2 text, with an 8px gap and centred alignment. This does not resize ordinary field labels. Help spacing: 12px heading-to-list, 8px between concise steps (superseding 16px for the former longer explanations), 24px between sections; keep wrapped lines within each step closer than neighbouring steps.
- Help role cards reuse route colours via `--help-role-accent`: 6% accent mixed with `--surface` for backgrounds, full accent for decorative icons, `--ink` for text. Both use 16px padding and `--radius-control` corners, without shadows. This is a role-identification use of the map palette, not a new brand palette.
- Eligibility copy appears immediately above Verify UniKey in the signed-out Profile popover, using its existing muted 14px paragraph styling and 8px vertical margins. Help has no sign-in/eligibility introduction; the earlier two-line hierarchy is superseded.
- Header wordmark: 16px (`--text-body`) below 700px; retain 12px (`--text-caption`) at wider sizes. Weight and letter spacing are unchanged; this brand exception is not a section-heading size.
- Header artwork: single combined pink gum/tyre transparent PNG, 15×15px image in the unchanged 48×32px window; left −0.8px, top 7.35px below 700px and 7.85px otherwise. This offsets transparent padding to preserve the 6px visible wordmark gap and optical centreline. Visible artwork is approximately 13.4px high, matching the previous icons. Keep 18px trailing brand padding and wordmark typography unchanged. Empty alt text and an aria-hidden wrapper make the logo decorative; the brand remains non-clickable.
- Map symbols: `--icon-map`, 21px, within `--marker-size`, 32px circles. Profile/menu controls and the logo are navigation/brand exceptions, not cell icons.
- Use the existing shared primary/secondary/danger button selectors and dialog/action groups. Equal actions must have equal dimensions; minimum 44px hit targets, 10px corners for action/dialog controls. Home CTAs remain larger deliberate exceptions.
- Responsive shell: retain the 680px mobile/tablet cap below 1000px; from 1000px use `clamp(960px, 66.667vw, 1360px)`. Desktop navigation starts at 1000px and remains one row; Admin is omitted and accessed directly via `/admin`; narrower screens use the drawer. Home CTAs retain mobile dimensions below 700px; above that they are equal, centred, max 360px wide and min 64px high. Hero size remains unchanged.
- Use existing spacing families: 4/8px for tightly related content, 12/16px for fields and panel padding, 24px for section separation. Preserve established map and mobile-sheet layouts rather than changing geometry during typography edits.
- Never reduce input size to match its label. “You receive” and “Your PayID” must have identical computed family, size, weight and colour.
- Driver pickup digits use four visible 44×48px inputs, 8px gaps/corners, centred
  `--text-code` numerals and a per-cell focus outline. Retain the rider's matching
  display-box dimensions. Never cover those cells with an invisible shared input.
  Driver own-PayID text retains the rider value typography without a Copy control.

## Extension checklist

Code cooldown suffixes inherit button typography and use tabular numerals. Keep
existing full-width controls, padding and minimum heights; do not shrink text or
add a separate countdown label. Existing labels return unchanged at zero.
UniKey form controls have zero outer margins and a single 16px grid gap. Resend
and Cancel use shared bordered secondary styling; Verify keeps primary styling.
Wait suffixes use rounded-up minutes (`in 9 min`) at 60 seconds or longer, seconds
below that (`in 59s`), and disappear at zero. The borderless resend experiment is
superseded; maintain button dimensions and shared typography.
Disabled UniKey secondary controls use opacity 1, `--line` fill and `--muted` text,
with their existing border unchanged, no shadow and no transform. This scoped
exception avoids fading the border into a label-like appearance; enabled controls
retain their white background. Other buttons are not restyled.

Ride notifications reuse ink/surface for the 18px Profile count badge, caption
text, and a 44px-minimum secondary notice button. Profile update copy uses small
regular text and a 4px gap below status; a request-card highlight uses only
surface-subtle → surface over two seconds, disabled with reduced motion.

The shared connection notice uses existing surface-subtle/ink/line colours,
small text, control-radius and 12px/16px padding. It is fixed above the safe-area
bottom without page reflow, animation or a new colour/shadow. It is non-interactive;
recovery and actions remain in their existing controls.

After any copy/layout change, review the full affected screen for competing
emphasis on mobile and desktop. Check the hierarchy from page title to section
heading, body, helper text and actions; do not preserve bold formatting blindly
when explanatory text is removed. Help steps and numbers are 14px regular;
role headings remain 18px semibold. Keep colours and spacing supportive rather
than adding emphasis to every element. Include a visual review, not only tests.

Serve the original header PNG with Next Image `unoptimized`: no resized or
recompressed variants. Its full 1254×1254 pixels remain available for mobile
pinch zoom while CSS dimensions and positioning stay unchanged.

The former paired-artwork scale of 0.586181640625 is superseded by the single
logo sizing above (19 October 2026). Do not reapply the old scale or resize the
wordmark/navigation controls. See HEADER_LOGO_2026-10-19.md for asset provenance.

1. Pick an existing semantic role/token before adding a selector; no inline font sizes or new raw font declarations.
2. Compare the equivalent control in Offer, Find, Activity, ride details, Profile and Admin. Do not globally resize maps or the home hero to fix one form.
3. Check 320px/390px mobile and desktop, long names/addresses, pending/pickup/ongoing/completed states and missing values. Verify wrapping and no horizontal overflow.
4. Check keyboard focus, text contrast, reduced motion, and unchanged payment/privacy behavior.
5. Run the visual-system regression test, relevant browser checks, lint and build. Update this document and UI standards for agreed exceptions.
## Private messaging (20 October 2026)

Both role-specific message suggestions use left-aligned regular small text,
vertically centred with 12px padding on all sides. Retain the shared secondary
border/radius and minimum 44px touch target; wrapped text grows the button.

Ride-details panels use 12px top separation. Map legends keep `--text-caption`,
8px row / 16px column gaps, non-shrinking colour swatches and unbroken route names.
Below 600px the location-age item spans a separate centred row. Do not shrink
fonts to fit long update ages. Creator support is a single ride-level link,
“Report a concern via WhatsApp”, using the same caption size as legal links.
Its decorative Bootstrap WhatsApp vector uses `--icon-label` (14px), current
text colour and an 8px gap, vertically centred without shrinking. No badge or
new colour. Support has 0px vertical / 16px horizontal outer margins and keeps
its 44px target, after all details/request cards in both participant views.

No new colour/font tokens. Messages use `--text-small`, `--text-caption`,
`--weight-regular`, `--weight-semibold`, `--surface`, `--surface-subtle`, `--line`
and `--radius-control`. Send message alone uses the shared `ride-action-buttons`
sizing, full available width; body/list gaps 12px, panel padding 16px. Plain message
body remains regular weight. Verification helper spans both Profile identity
columns. See UI_STANDARDS.md and MESSAGING_CHECK_2026-10-20.md for review evidence.
