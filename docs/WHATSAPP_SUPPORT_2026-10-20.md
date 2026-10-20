# Creator WhatsApp support — 20 October 2026

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
