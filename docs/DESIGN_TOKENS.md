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
- Header wordmark: 16px (`--text-body`) below 700px; retain 12px (`--text-caption`) at wider sizes. Weight and letter spacing are unchanged; this brand exception is not a section-heading size.
- Header artwork: an 8px wordmark gap, then the generated pink bubble and black/silver tyre together in a 64×32px window (80×40px image offset −8/−4px to trim transparent padding). Preserve the approved raster artwork, equal visual icon sizes and vertical alignment on mobile/desktop. Empty alt text and an aria-hidden wrapper make these decorative; the brand remains non-clickable.
- Map symbols: `--icon-map`, 21px, within `--marker-size`, 32px circles. Profile/menu controls and the logo are navigation/brand exceptions, not cell icons.
- Use the existing shared primary/secondary/danger button selectors and dialog/action groups. Equal actions must have equal dimensions; minimum 44px hit targets, 10px corners for action/dialog controls. Home CTAs remain larger deliberate exceptions.
- Responsive shell: retain the 680px mobile/tablet cap below 1000px; from 1000px use `clamp(960px, 66.667vw, 1360px)`. Desktop navigation starts at 1000px and remains one row, including Admin; narrower screens use the drawer. Home CTAs retain mobile dimensions below 700px; above that they are equal, centred, max 360px wide and min 64px high. Hero size remains unchanged.
- Use existing spacing families: 4/8px for tightly related content, 12/16px for fields and panel padding, 24px for section separation. Preserve established map and mobile-sheet layouts rather than changing geometry during typography edits.
- Never reduce input size to match its label. “You receive” and “Your PayID” must have identical computed family, size, weight and colour.

## Extension checklist

1. Pick an existing semantic role/token before adding a selector; no inline font sizes or new raw font declarations.
2. Compare the equivalent control in Offer, Find, Activity, ride details, Profile and Admin. Do not globally resize maps or the home hero to fix one form.
3. Check 320px/390px mobile and desktop, long names/addresses, pending/pickup/ongoing/completed states and missing values. Verify wrapping and no horizontal overflow.
4. Check keyboard focus, text contrast, reduced motion, and unchanged payment/privacy behavior.
5. Run the visual-system regression test, relevant browser checks, lint and build. Update this document and UI standards for agreed exceptions.
