# Read-only admin

Open `/admin` or use the footer's Admin login link. Overview shows all-time ride
counts (including samples); Trips provides status filters and 25-record pages;
Trip inspector shows route details, up to 200 recent requests/events, and the
latest retained GPS positions. It does not claim to retain a GPS history.
No ride edits, cancellation, deletion, payment identifiers, pickup codes, or
guest-session credentials are exposed by the admin API.

Admin sessions are independent of guest identities. They expire after one hour
without an interaction or after eight hours regardless of activity. Report
polling does not extend the session. The browser receives only an HttpOnly,
SameSite=Strict cookie (Secure in production); the database stores its hash.
Ten login attempts per 15 minutes are allowed across the single admin account.
This account-wide throttle intentionally does not trust forwarded IP headers.

## Provision or rotate the account on the API host

Run from the project directory against the API's configured database path:

```bash
read -r -p 'Admin username: ' admin_username
read -r -s -p 'Admin password: ' admin_password
printf '\n'
printf '%s\n%s\n' "$admin_username" "$admin_password" | npx tsx scripts/admin-setup.ts
unset admin_username admin_password
```

Set `COCOWHEELS_DB_PATH` first if the service uses a non-default database. The
setup command stores a salted scrypt hash and revokes all existing admin
sessions. No default credentials are checked into the repository.

Existing offer expiry and rider-facing screens are unchanged by this panel.
