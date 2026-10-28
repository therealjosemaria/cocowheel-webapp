# Admin entry and authorization

## Direct email/code sign-in — 28 October 2026

Baseline: db27ac8. Admin is omitted from desktop and mobile menus, including the
owner's account. `/admin` remains available directly and excluded from indexing
and analytics. A signed-out/expired session sees the inline shared verification
form: Email and Send code, followed by Email plus Verification code and Verify.
The email is read-only during a pending challenge; the existing Request a new
code control resets that challenge after its resend cooldown.

This uses the existing `/api/university/code`, `/verify` and `/session` endpoints,
HttpOnly session cookie, OTP validity/attempt limits and resend cooldowns. It adds
no password or alternate admin identity. Only the immutable verified `jmos0905`
principal can see real reports. Other verified accounts see “This account doesn’t
have admin access.” and may verify a different email. Both the server page and
admin API still enforce authorization; editing the visible username does not
grant admin access. Anonymous visitors receive only the sign-in form, not records.

The existing admin contains real journey history, endpoints, live locations and
immutable pickup GPS evidence. Public access was considered then explicitly
withdrawn by the owner after that data scope was identified. Do not treat the
absence of a menu entry as access control or expose the reports as a demo.

An expired/revoked session in AdminPanel returns to `/admin`, where the server
renders sign-in. Session-check connection/timeouts retain the existing error and
Try again view; they do not grant access. A post-verification session-check error
is shown inline, with the same transport error messages. No API/database/provider
change or backend restart is required.

## Verification

`npm test`: 203/203 pass, including real isolated admin HTTP authorization tests.
Lint and production build pass. Reproduce the UI check after building:

```sh
python scripts/check-admin-sign-in.py
```

Use Python with Playwright and Chromium at `/usr/bin/chromium`. The script starts
its own local Next production preview on 3204 and a synthetic HTTP fixture on an
ephemeral loopback port. It overrides the server-side API target and intercepts
all browser API calls to that fixture; external providers are blocked. It sends
no real email, contacts no live API and reads/writes no production records.

At 320/390/844/1440px the check covers anonymous/expired-session sign-in, Email
remaining visible beside the code field, invalid-code feedback, owner access and
refresh, other-account denial across refresh, menu removal and the existing
ordinary verification modal. Screenshots in `/tmp/admin-*-WIDTH.png` support the
whole-screen review of navigation, form spacing, typography and buttons on mobile
and desktop. No horizontal overflow or browser page exceptions were observed.

The first UI assertion mistakenly matched Next's live route announcer alongside
the form error; scoping it to the form resolved that harness failure. A teardown
race with outstanding mocked fetches was corrected by waiting for route handlers
before closing each browser context. Visual review also caught missing top spacing
and tight denial-message spacing; shared page padding and a 16px error gap fix it.

Real-device Safari, live email delivery and the production deployment remain
unverified by this local check.
