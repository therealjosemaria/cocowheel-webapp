# Location-reporting ownership

Each active ride participant has one location-reporting browser login session.
Other authenticated sessions for the same account may still view the ride.

- The first valid GPS submission claims ownership atomically.
- Ownership has no lease timer and never transfers automatically when GPS is stale.
- Another browser sees **Use this device for location**. An explicit press transfers
  ownership; later submissions from the previous browser are rejected server-side.
- Driver and accepted rider have independent ownership. Pending riders cannot claim.
- Ownership is checked against the authenticated login token hash, not a supplied
  device name, browser user agent, or account ID. Raw tokens are never stored here.
- A new login session, including reauthentication in the same browser, may require
  the explicit switch. Tabs sharing a login session share the same source.
- Existing current-ride polling supplies `locationSource.canReport`; this does not
  add a polling loop. Non-owning browsers skip GPS capture.
- Terminal rides reject both new claims and GPS submissions. Historical ownership
  records do not authorise future trips. Explicit changes enter the ride event log.
- The server-only sample driver simulator is exempt because it uses temporary
  internal tokens; normal participant authentication is still enforced.

The control appears above page content when another session owns the active ride's
location reporting. Switching does not change account identity, ride status,
pickup pairing, or the other participant's location source.
