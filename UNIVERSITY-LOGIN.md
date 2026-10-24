# Email verification (legacy university identifiers preserved)

Participants can enter any valid email address, normalized to lowercase. Legacy
four-letter/four-digit UniKeys remain accepted; their full university email resolves
to the same account, cooldown and principal. The six-digit code proves inbox access,
not current enrolment, identity checks or driving eligibility. Email is owner-only;
the separately editable public username is visible to other participants.
See [Personal details](docs/PERSONAL_DETAILS.md). Historical references below to
per-UniKey limits now mean per canonical login identity, including full emails.

## Rules

- New offers and join requests require an email-verified session at the API.
- Browsing remains open. Historical guest records are preserved, not silently
  claimed by a newly verified account. Existing guests may still finish/cancel
  their previously created rides and inspect their own history.
- Ordinary UniKeys share one principal across devices: one active role/item,
  the same private history, and no self-join, using the existing server rules.
- `jmos0905` follows exactly the same rules as all other UniKeys.
- The existing `mosciarobusiness@gmail.com` identity remains a separate account
  with the same restrictions, not a role or verification bypass. Other valid
  emails are now accepted; provider-specific aliases are not merged.
- Multiple devices can stay signed in. All share the account's principal,
  active role, and history. Switching accounts replaces only the current
  browser's session. Taking the other role requires ending the existing activity;
  the server never automatically cancels it.
- Public displays resolve the current username by principal. Stored historical
  aliases are not rewritten; synthetic/legacy guest records keep safe labels.
- Verified sessions are opaque HttpOnly cookies, expiring after 30 days. Signing
  out revokes only that browser session; it does not cancel an active ride or
  free an ordinary account's role restriction.
- Admin requires only the verified `jmos0905` account. There is no second password
  prompt. Only that account sees the Admin navigation link; the page and every
  admin API endpoint enforce access too. The Gmail test account has no admin access.

## Guest identity and location source

The `guest` alias is also allowed. Its verification code goes to
`mosciarobusiness@gmail.com`, but its principal and visible name are `guest`,
separate from the account named by that email address. `test` is rejected.
Guest verification uses the same code/session/role restrictions as other accounts.

Multiple sessions can view the same account, but only the selected browser login
session may report each participant's location. **Use this device for location**
explicitly transfers ownership. See [the ownership contract](docs/LOCATION_OWNERSHIP.md).

## Email setup (required for real delivery)

The initial delivery adapter uses Resend's `POST /emails` API. Create/configure
the service account and verify a sender domain you control; do not send *from*
the University's domain. Set these only in the Pi API's private `.env`:

```
COCOWHEELS_RESEND_API_KEY=<server-side sending key>
COCOWHEELS_EMAIL_FROM=GUMWHEEL <verified-sender@your-domain>
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

Rate-limit responses retain HTTP 429 and `VERIFICATION_RATE_LIMITED`, now with
`retryAfterSeconds` and `Retry-After`, rounded up from the rejecting bucket's
remaining lifetime. The dialog shows seconds below one minute and rounded-up
minutes otherwise, instead of a blanket 15-minute wait. This is a snapshot at
rejection, not a live countdown. If an older API omits metadata, use “Please wait
a little before trying again.” No limits, code expiry or resend rules changed.
When multiple buckets are exhausted, the existing check order is preserved;
a later retry can encounter a different limit. API deployment/restart is needed
for precise times; the updated frontend safely handles older API responses.

### Local resend countdown (20 October 2026)

After successful sending, the browser starts a conservative 60-second cooldown
from receipt of success. Existing “Request a new code” gains a compact wait suffix and is
disabled; closing/reopening the dialog shows the same suffix on “Send code”.
No names or navigation steps are changed. Code input and Verify remain usable.
Resend uses the shared bordered secondary button, superseding the borderless
experiment. Both sending controls show rounded-up minutes at 60 seconds or more
(500 seconds → `in 9 min`), and seconds below 60 (`in 59s`). At zero, the suffix
disappears and sending re-enables. Only presentation changes; deadlines and server
enforcement are unchanged. Keyboard semantics and full-width touch targets remain.
The form uses consistent 16px gaps, overriding secondary-button outer margins.
Disabled secondary controls keep the normal opaque border and shape; `--line`
fill and `--muted` text replace whole-button fading. Enabled controls remain white.
No countdown, sending or verification rules change with this presentation.
A send-side 429 with retry metadata replaces the local deadline with that server
wait, displayed inside the button rather than a duplicate message. Verification
errors remain separate; they do not disable resending. Older/malformed metadata
keeps the existing neutral error fallback.

Only a timestamp is persisted in `cocowheels:code-cooldown:v1:<normalized UniKey>`.
The deadline survives reload/dialog closure; same-origin tabs receive storage
events. Storage failure uses in-memory state until reload. Different UniKeys use
separate deadlines. The display computes elapsed wall time locally each second,
including after backgrounding; it does not poll, retry or send automatically.
Native disabled buttons and a submit-handler guard block ordinary premature sends.
Manipulating local storage/time or changing browsers never bypasses server checks.
All server quotas/OTP rules are unchanged; no API restart is needed for this layer.

Tests inject an in-memory mail sender, covering the HTTP verification flow,
expiry, replay/guess limits, cookie transport, API gating, shared roles/history,
and the allowlisted email with identical account-wide role restrictions.

The [16 October security campaign](docs/SECURITY_TESTING.md) records a real local
HTTP login/role/privacy matrix with synthetic mail, reproducible commands and
limits. It does not verify real delivery or launch-scale signup capacity.
