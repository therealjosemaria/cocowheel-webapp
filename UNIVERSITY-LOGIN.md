# University pilot

Participants enter only their UniKey (four letters and four digits, normalized
to lowercase). Cocowheels appends `@uni.sydney.edu.au` on the server. The six-digit
code proves inbox access, not current enrolment, identity checks, or driving
eligibility. The UI tells participants their UniKey will be publicly visible.

## Rules

- New offers and join requests require a verified university session at the API.
- Browsing remains open. Historical guest records are preserved, not silently
  claimed by a newly verified account. Existing guests may still finish/cancel
  their previously created rides and inspect their own history.
- Ordinary UniKeys share one principal across devices: one active role/item,
  the same private history, and no self-join, using the existing server rules.
- `jmos0905` follows exactly the same rules as all other UniKeys.
- The sole non-university exception is `mosciarobusiness@gmail.com`, entered in
  the same field and verified by a code sent directly to that inbox. It is a
  separate account with the same restrictions, not a role or verification bypass.
  Other email addresses (including Gmail aliases) are not accepted.
- Multiple devices can stay signed in. All share the account's principal,
  active role, and history. Switching accounts replaces only the current
  browser's session. Taking the other role requires ending the existing activity;
  the server never automatically cancels it.
- New real participant names are the verified UniKey. Old records and synthetic
  sample rides retain their original labels.
- Verified sessions are opaque HttpOnly cookies, expiring after 30 days. Signing
  out revokes only that browser session; it does not cancel an active ride or
  free an ordinary account's role restriction.
- Admin authentication remains entirely separate.

## Email setup (required for real delivery)

The initial delivery adapter uses Resend's `POST /emails` API. Create/configure
the service account and verify a sender domain you control; do not send *from*
the University's domain. Set these only in the Pi API's private `.env`:

```
COCOWHEELS_RESEND_API_KEY=<server-side sending key>
COCOWHEELS_EMAIL_FROM=Cocowheels <verified-sender@your-domain>
```

The existing `COCOWHEELS_CODE_ENCRYPTION_KEY` supplies a domain-separated HMAC key
for verification codes. No plaintext codes are saved or logged. Restart the Pi
API after configuring email. No email credential is needed in Vercel.

Missing sender configuration fails closed (`EMAIL_NOT_CONFIGURED`): it never
claims a message was sent and never grants a verified session. There is no
production bypass, test-code endpoint, or master OTP.

Codes expire after ten minutes, with five guesses. A resend invalidates earlier
codes for the UniKey. Limits persist in SQLite: one send per minute, three sends
per UniKey per 15 minutes, 15 verification attempts per UniKey per 15 minutes,
and 100 sends globally per hour. Global limits deliberately avoid trusting
spoofable forwarded IP headers. Provider acceptance does not guarantee inbox
delivery; perform a real inbox test after sender configuration.

Tests inject an in-memory mail sender, covering the HTTP verification flow,
expiry, replay/guess limits, cookie transport, API gating, shared roles/history,
and the allowlisted email with identical account-wide role restrictions.
