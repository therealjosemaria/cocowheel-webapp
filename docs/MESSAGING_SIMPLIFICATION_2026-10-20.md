# Send-only messaging and concern link — 20 October 2026

Baseline: `53508fc`. This change removes the Stop messaging button, its client
handler, confirmation dialog and unused dialog CSS. The composer retains only
Send message (plus the optional starter for an empty draft), with existing shared
button dimensions and full width. Pickup, cancellation/withdrawal and error
confirmations are unchanged. No backend restart or migration is required.

Messaging remains request-scoped and server-authorized. Decline, withdrawal,
discard, cancellation, completion and expiry continue to close access. The legacy
stop endpoint/data remain for older clients; previously stopped conversations
remain unavailable for sending and are never reopened or deleted automatically.
Privacy, Terms, README and UI/messaging guides no longer advertise a separate
user-facing stop control.

The single ride-level support link reads “Report a concern via WhatsApp”. This
states both purpose and medium without extra helper copy. Destination is unchanged;
the editable draft now says “Hi José, I’d like to report a concern about my
GUMWHEEL ride. Reference: [ride reference]”. No automatic send, location, PayID
or login credentials. Support is never inserted into the conversation section.

## Reproduction and evidence

```sh
COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:1 npx next dev --hostname 127.0.0.1 --port 3090
/tmp/gumwheel-pickup-check-env/bin/python scripts/check-messaging.py
/tmp/gumwheel-pickup-check-env/bin/python scripts/check-message-entry.py
COCOWHEELS_DB_PATH=/tmp/gumwheel-send-only-tests.db node --import tsx --test tests/*.test.ts
npm run lint
# Stop isolated dev before building.
npm run build
```

All 110 regression tests passed, including backend closed-conversation/stop
compatibility tests and support URL encoding. Browser fixtures mock API traffic
and block external destinations; they send no real messages or reports. No
production database/service is touched. Initial browser runs were interrupted by
copy revisions and failed old-label assertions; fresh runs verify the final text.
Final checks passed: eight driver/rider messaging cases at 320, 390, 844 and
1440px; six request-entry cases at 320, 393 and 1440px (chooser and preview);
legal-page assertions; lint; production build/TypeScript; and `git diff --check`.
Whole-screen screenshots were visually reviewed for driver and rider on mobile
(390/393px) and desktop (1440px): one full-width Send message action, no Stop
control, support outside chat, consistent caption-sized link, no competing new
emphasis or horizontal overflow. Map tiles are deliberately blocked in fixtures;
grey maps are not production map failures.

Physical iOS/Safari,
WhatsApp handoff/recipient delivery and live frontend deployment remain separate
from automated testing and git push.
