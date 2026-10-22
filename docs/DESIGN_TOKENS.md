# Coco Wheels visual system

Audited 12 October 2026. Source of truth: `app/globals.css` `:root` tokens and shared semantic selectors. Read alongside `UI_STANDARDS.md` before extending any screen.

## Audit findings

The stylesheet had one explicit UI font stack (Arial, Helvetica, sans-serif), four family declarations including inheritance, 99 size declarations with 38 distinct written values, five numeric weights, and 26 distinct text-colour expressions. These are source counts, not 38 independently rendered fonts. Browser defaults also supply monospace for `code` and heading weights. Offer a Ride's “You receive” inherited body size while “Your PayID” explicitly used 0.78rem.

All existing font-size declarations now reference the scale below. Equivalent form labels and summary-cell labels/values share semantic rules. Inputs use 16px so mobile focus does not require smaller text. PayID values use the UI family rather than the browser's code font. Keep “You receive” (present tense).

## Typography

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
| Finished status / pulse midpoint | `--status-finished` #444444 / `--status-pulse` #666666 |

Prefer these tokens. Existing map/provider imagery, focus rings, admin semantic indicators and translucent shadows are intentional contextual colours, not new brand palettes. Historical compatibility aliases `--ocean`, `--coral`, `--sun`, `--mint`, `--paper` are not permission to introduce extra brand colours. New exceptions need a documented semantic purpose and contrast checks.

## Icons, controls and spacing

- Profile body uses 12px related-content gaps; saved address summary is one column
  with 12px between fields and no inset/border. Other ride grids are unchanged.
  Shared route swap uses the secondary control border/radius, 44px square target,
  18px monochrome two-arrow SVG, horizontally centred between the two search
  fields. Grid place-items centres the icon within the button on both axes.
  Its -12px block margins within the 16px grid gaps leave 4px above/below.
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

- Find's Save route reuses text-button below Request to join, centred with a 4px
  top gap and minimum 44px tap target, no border/fill/shadow, regular small text.
  It remains outside results. Consent/replacement reuse cancel-prompt,
  left-aligned body text; the Profile note uses small/muted/regular tokens after
  a single line break, with no extra paragraph gap.
  Keep regular paragraphs and stacked equal actions. Profile schedule editing reuses
  existing checkbox, weekday and native time controls; no new tokens.

- Home active-ride cards use the same min(100%, 360px) width/centering as CTAs
  above 700px; do not resize the Profile version. Driver Departure reuses the
  detail grid, departure icon and body-value tokens, without animated emphasis.

- DepartureChoice keeps the existing radio-button tokens but uses two equal grid
  columns for In 30 min/In 1 hour. Scope this override to departure-options;
  PayID's three choices keep their existing three-column layout.

- Discovery's departure line uses the existing timing caption size, departure colour
  and inherited weight, in the third grid row beneath pickup/arrival. Fare and
  PayID retain their right-column rows. No badge or new font. Departure tokens
  also apply to the driver countdown, not general ride statuses or map routes.
  Contrast on white: green 7.13:1, amber 6.85:1, red 6.57:1; on surface-subtle:
  6.81:1, 6.55:1, 6.28:1. Text always communicates the state without colour.
  Driver Departure stacks normal-ink planned time and caption/regular coloured
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
- Responsive shell: retain the 680px mobile/tablet cap below 1000px; from 1000px use `clamp(960px, 66.667vw, 1360px)`. Desktop navigation starts at 1000px and remains one row, including Admin; narrower screens use the drawer. Home CTAs retain mobile dimensions below 700px; above that they are equal, centred, max 360px wide and min 64px high. Hero size remains unchanged.
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
