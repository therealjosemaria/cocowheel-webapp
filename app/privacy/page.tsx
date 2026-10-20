import type { Metadata } from "next";
import LegalPage from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy | GUMWHEEL" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      revision={{ date: "2026-10-20", label: "20 October 2026" }}
    >
      <p>
        This notice explains how the GUMWHEEL university carpool pilot handles
        your information. For privacy questions, contact{" "}
        <a href="mailto:jose@gumwheel.com">
          jose@gumwheel.com
        </a>
        .
      </p>
      <h2>What we collect and why</h2>
      <p>
        We use your UniKey and university email address to verify inbox access,
        maintain your account and associate your rides across devices. Approved
        testing accounts use their designated email inboxes. Verification does
        not establish current enrolment, identity or driving eligibility.
      </p>
      <p>
        We store ride and request details, including origin and destination
        coordinates and addresses, fares, statuses and timestamps. These support
        ride matching, pickup and activity history. If you email us, we receive
        your message and contact details to respond.
      </p>
      <p>
        We store your PayID to enable payment for your ride. Riders can see your
        payment preference, but your PayID details remain hidden from them until
        pickup is confirmed.
      </p>
      <h2>Location and pickup records</h2>
      <p>
        With browser permission, we collect location fixes, accuracy and
        timestamps to show positions and estimate routes. Updates may pause when
        the browser is closed, hidden or offline. The app stores the latest live
        fixes, not a complete journey trail.
      </p>
      <p>
        When the pickup code is confirmed, we retain a separate snapshot of both
        participants’ latest available fixes, their capture and receipt times,
        and their calculated separation. A fix may be stale or missing. This
        record supports reviewing pickup events; proximity is not a guarantee
        that people met.
      </p>
      <h2>Who can see your information</h2>
      <p>
        Your UniKey is your visible participant name. Published driver offers
        expose the driver’s name, route endpoints, fare and available location
        information to people browsing rides, including visitors who have not
        signed in. Do not publish an address you are unwilling to share.
      </p>
      <p>
        Rider request details are shared with the relevant driver and rider, not
        other riders. Driver PayID details become visible to the paired rider
        after pickup confirmation and may remain in their ride history. The
        authorised administrator can inspect records for support and operation,
        including pickup evidence. Information already seen or copied by another
        person cannot be recalled by closing a ride.
      </p>
      <p>
        Optional ride ratings are stored with the ride, the participants’
        accounts, their roles and submission times. Individual scores and who
        submitted them are not shown to participants. Only an average and rating
        count for each role are shared, once at least ten ratings for that role
        have been released. Ratings are released when both participants submit
        or seven days after completion. This reduces, but cannot eliminate, the
        possibility of inferring a score from changes in an average. Rating
        records are retained with ride history, without an automatic deletion
        schedule.
      </p>
      <h2>Private messages</h2>
      <p>
        Optional messages are stored with their request, sender, timestamps and
        read position to help participants arrange the ride. Only that driver
        and rider can access the conversation through the app while their
        request or ride is open. Conversations disappear from participant access
        when the request or ride ends; they are retained on our server without
        an automatic deletion schedule. They are not end-to-end encrypted;
        authorised operators may access stored records for support and safety.
        Avoid sharing sensitive information or login codes in messages.
      </p>
      <h2>Service providers</h2>
      <p>
        Vercel and Cloudflare deliver and protect the service; Resend sends
        verification emails; Geoapify receives place searches and coordinates to
        provide address and route results. Map tiles are requested from
        OpenStreetMap. These providers may receive technical information such as
        IP addresses and request metadata, and may process information outside
        Australia.
      </p>
      <p>
        Opening Google Maps passes the directions information to Google. Paying
        through your bank is separate from GUMWHEEL. We do not collect your bank
        login or card number, process transfers or verify payment. Provider
        handling is also governed by their own privacy policies.
      </p>
      <p>
        Report a concern via WhatsApp opens an external conversation with the
        creator’s personal account. The link includes your ride reference in an
        editable draft, not your route, PayID or login codes. Opening the link
        passes that draft to WhatsApp; you choose whether to send it. WhatsApp
        handles your information under its own privacy policy. Messages you send
        and your WhatsApp contact information are received by the creator and are
        not automatically recorded in GUMWHEEL’s ride history. Email remains
        available for privacy questions.
      </p>
      <h2>Storage and retention</h2>
      <p>
        Sign-in cookies last up to 30 days. Browser storage can reuse recent GPS
        for five minutes, country preferences for seven days and Find a ride
        drafts for 30 minutes. Server address and route caches last up to seven
        days. Expiry prevents reuse; physical removal can occur during later
        cleanup.
      </p>
      <p>
        Ending or expiring a ride does not delete its history. Account records,
        original endpoints, requests, payment identifiers, ride events and
        pickup snapshots are retained; the pilot has no automatic deletion
        schedule for these records. Live-location records are removed during
        terminal-ride cleanup, separately from retained pickup evidence. Signing
        out or clearing browser storage does not delete server records.
      </p>
      <h2>Your choices and questions</h2>
      <p>
        You can revoke location permission in your browser, sign out, or clear
        local storage. This may limit ride features. Email us to request access,
        correction or deletion, or raise a privacy concern. We may need to
        verify account ownership and assess what can be removed, including
        effects on another participant’s history and any applicable retention
        obligations. There is no self-service account-deletion feature.
      </p>
      <p>
        If a concern remains unresolved, you can seek guidance from the{" "}
        <a href="https://www.oaic.gov.au/privacy/privacy-complaints">
          Office of the Australian Information Commissioner
        </a>{" "}
        about available complaint options. Access controls and verification help
        protect data, but no online system can guarantee absolute security.
      </p>
      <h2>Changes</h2>
      <p>
        We will update this notice as the pilot changes and show the revision
        date above. Review it before sharing information if you have not used
        GUMWHEEL recently.
      </p>
    </LegalPage>
  );
}
