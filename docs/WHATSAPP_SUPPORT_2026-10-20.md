# Creator WhatsApp support — 20 October 2026

## Current placement and icon refinement

Baseline `915799e`: support now follows all driver request/detail cards, matching
the rider's end-of-details placement. Vertical outer margins are reduced from
8px to zero; the 44px tap target, 16px horizontal margins, 12px regular text and
8px icon gap remain. No border, badge or green attention treatment.
Bootstrap Icons v1.13.1 `whatsapp.svg` replaces the custom outline, rendered
monochrome at 14px with its original vector geometry. Source:
https://icons.getbootstrap.com/icons/whatsapp/ . MIT notice retained in
`docs/licenses/bootstrap-icons.txt`; this is a library icon, not a claim of
WhatsApp endorsement. No dependency, external asset fetch or backend change.
The messaging summary/disclosure arrow and WhatsApp destination/draft are unchanged.
Eight isolated mocked browser cases passed via `scripts/check-messaging.py`
at 320/390/844/1440px for driver and rider, including icon dimensions, a minimum
44px link height, no overflow and support below every driver request stack.
Both roles were visually reviewed in full-screen screenshots at 390 and 1440px:
the new silhouette is clearer at actual size, support stays subordinate to ride
actions, and neither chat nor page headings gain competing emphasis. External
map tiles are intentionally blocked in fixtures. Lint and both support URL tests
passed. React checklist review found no hook, authorization or fetching changes;
the shared link and decorative SVG semantics remain intact. Actual WhatsApp
handoff and deployed frontend remain unverified; no real messages were sent.
`npm run build` (including TypeScript) and `git diff --check` also passed.

Supersedes the email destination described in SINGLE_PURPOSE_SECTIONS_2026-10-20.md.
The owner authorized their personal Australian WhatsApp number for public support.
`lib/support.ts` converts the supplied national number to the wa.me international
digits-only form (61 followed by the mobile number without its leading zero).
This is an intentionally public contact destination, not a secret/API credential.

One “Report a concern via WhatsApp” link stays below participant ride details,
including history; none inside chat. Caption font (12px default), regular weight
and 44px minimum tap height remain. New tab uses noopener/noreferrer to leave the
ride view available and avoid a referrer. No WhatsApp SDK, Business API or account
migration is required. No changes to in-app messages, auth, GPS or ride lifecycle.

The URL contains an encoded editable draft with the ride reference only. No
coordinates, PayID, codes or account credentials. Opening transfers the URL/draft
to WhatsApp; sending requires user action. Contact info/messages they send are
handled by WhatsApp and the creator, not automatically stored in our database.
No immediate response/emergency service is promised. Privacy and Terms describe
the destination; their email contact remains an alternative. The personal number
is visible in the public link and personal/support chats share the owner's inbox.

## Prefilled-message readability follow-up

The earlier greeting and three-paragraph draft is superseded: the concern sentence
is followed immediately by the reference on the next line, using one `%0A`,
without a greeting or blank line. The draft remains editable and is
never sent automatically. `COCO-` is the existing public ride-ID prefix generated
by `server/core.ts`, not accidental branding in the message; it is preserved
exactly for lookup/history compatibility. No backend migration or ID change.
The app link, icon, messaging heading and screen layout are unchanged.
Reproduce checks with `node --import tsx --test tests/support.test.ts` and
`npm run lint`. Tests cover the exact two-line draft, one encoded newline, legacy
reference preservation and unusual reference characters. Actual WhatsApp mobile
and desktop draft rendering remains unverified; no external message is sent.
The compact two-line revision was checked from baseline `bae4d60`: both support
tests, lint and diff whitespace checks passed. No app layout or backend changes.

## Checks

Reproduce browser checks with the isolated frontend commands in
LEGEND_CHAT_LAYOUT_2026-10-20.md; run scripts/check-message-entry.py and
scripts/check-messaging.py. APIs are mocked, external navigation is blocked;
no WhatsApp messages are sent. tests/support.test.ts verifies international number
format and encoding of unusual ride references. All 110 regression tests passed.
The initial browser runs were superseded mid-run by the requested wording change
from “Contact the creator” to “Contact us”; they consequently failed old-label
assertions. Fresh runs use the final wording (not a product/transport failure).
All six entry checks passed at 320/393/1440px, including exact URL, target/rel,
12px typography parity, no duplicate support and no page overflow. Privacy/Terms
also rendered at these sizes. Whole-screen visual review covered rider details
at 393/1440px and the legal pages: no competing emphasis or new controls in chat.
All eight driver/rider messaging checks passed at 320/390/844/1440px. Lint passed.
No actual external chat was opened or sent. Deployment not performed.
Real WhatsApp app/web handoff and recipient identity must be checked by the owner;
automated checks do not verify the number's registration or delivery.

## Outline icon follow-up

Baseline `7f030d5`: the shared concern link now has a decorative inline WhatsApp
outline SVG before the unchanged label. It uses the existing 14px icon token,
current text colour, 8px gap and centred alignment. No SDK, extra request, badge
or chat-summary icon was added. The SVG is hidden from assistive technology and
cannot receive focus; the labelled link and its 44px target remain unchanged.

Reproduction: run the isolated frontend and `scripts/check-messaging.py` as above,
then `npm run lint`, `node --import tsx --test tests/support.test.ts` and
`npm run build`. Eight mocked browser cases passed for both roles at
320/390/844/1440px, including 14px icon dimensions, accessibility attributes,
unchanged link destination and no overflow. Lint and support URL test passed.
Production build/TypeScript and `git diff --check` also passed.
Whole-screen mobile driver (390px) and desktop rider (1440px) screenshots were
reviewed: the icon stays subordinate to text, the chat heading retains its arrow,
and support remains separate from chat. Map tiles were intentionally blocked.
Physical-device WhatsApp handoff and live deployment are not verified by these
checks; no real messages were sent or backend services changed.
