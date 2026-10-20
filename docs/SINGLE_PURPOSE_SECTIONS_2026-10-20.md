# Single-purpose messaging sections — 20 October 2026

Baseline `160dd95`. Removed Ride actions navigation from chat and removed the
visible “Opens email. Not an emergency service.” sentence below Report a concern.
Report a concern remains a single mailto link at ride level, not an in-app report
submission. No support destination, monitoring promise or privacy handling changed.
WhatsApp Business is a discussion/proposal only; no phone number was configured.

AGENTS.md and UI_STANDARDS.md now require single-purpose sections: conversation
controls stay in messaging; lifecycle controls in Action; support at ride level.
Removed unused message-footer/navigation CSS. Report and footer legal links use
the same `--text-caption` (12px at the default root size), regular weight, and
minimum 44px height; their existing contextual colours remain unchanged.

## Verification

Use the isolated frontend and commands in LEGEND_CHAT_LAYOUT_2026-10-20.md.
`scripts/check-message-entry.py` now asserts computed 12px parity with legal links,
absence of the helper sentence and Ride actions link, and a single report link.
`scripts/check-messaging.py` now reaches Action directly and asserts that chat
has no Ride actions link. Neither harness sends production requests.

Lint and targeted visual-system/messaging-entry tests passed. The first entry
browser run passed 320px chooser then exceeded its 5-second navigation/render
assertion on the preview flow (page shell present, no ride data rendered yet).
An unchanged rerun passed all six entry cases (320/393/1440px, chooser/preview).
All eight messaging checks passed (driver/rider, 320/390/844/1440px). Computed
font sizes matched at 12px. Full mobile 320px and desktop 1440px screenshots were
visually reviewed: no unrelated chat footer, clear separation of messaging and
Action, one understated support link, unchanged heading/body hierarchy and no
horizontal overflow. Screenshots regenerate under `/tmp/message-entry-detail-*`.
Production build was not repeated for these markup/CSS removals.

Physical-device Safari and production deployment are not covered. Changes are
local and not pushed as part of this discussion.
