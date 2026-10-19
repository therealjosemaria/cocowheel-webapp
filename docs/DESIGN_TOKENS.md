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
| Rider / driver routes | `--route-rider` blue / `--route-driver` dark orange |
| Finished status / pulse midpoint | `--status-finished` #444444 / `--status-pulse` #666666 |

Prefer these tokens. Existing map/provider imagery, focus rings, admin semantic indicators and translucent shadows are intentional contextual colours, not new brand palettes. Historical compatibility aliases `--ocean`, `--coral`, `--sun`, `--mint`, `--paper` are not permission to introduce extra brand colours. New exceptions need a documented semantic purpose and contrast checks.

## Icons, controls and spacing

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
UniKey form controls have zero outer margins and a single 16px grid gap. The resend
control keeps its existing target size with no border/background/shadow, regular
weight and an enabled-state underline; Verify and Cancel retain shared styling.

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
