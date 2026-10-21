import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms | GUMWHEEL" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      revision={{ date: "2026-10-21", label: "21 October 2026" }}
    >
      <p>
        These terms describe participation in the GUMWHEEL carpool pilot. Please
        read them alongside our <Link href="/privacy">Privacy policy</Link>{" "}
        before offering or requesting a ride. Questions can be sent to{" "}
        <a href="mailto:jose@gumwheel.com">
          jose@gumwheel.com
        </a>
        .
      </p>
      <h2>The pilot</h2>
      <p>
        GUMWHEEL helps drivers publish routes and riders request to join them.
        It does not itself drive passengers or process payments. The pilot is
        intended for University of Sydney students, with limited approved
        testing accounts. University email verification does not mean the
        University endorses the service or that participants have passed
        identity, licence, vehicle or background checks.
      </p>
      <h2>Your account and conduct</h2>
      <p>
        Use an account you are authorised to access. Do not share login codes,
        impersonate someone, submit misleading information, harass participants,
        misuse their locations or payment details, or attempt to bypass security
        or disrupt the service. One account can have only one active driver
        offer or rider request at a time, across devices.
      </p>
      <h2>Arranging a ride</h2>
      <p>
        A request is not a confirmed pickup. The driver chooses whether to
        accept one rider. Confirm the pickup point, destination and displayed
        fare together. The rider shares the pickup code only when meeting the
        intended driver; the driver enters it to start the ride. The code is a
        coordination step, not proof of safety or identity.
      </p>
      <p>
        You can withdraw a pending request or cancel where the app permits.
        After pickup confirmation, either participant can mark the ride
        complete. Completing or cancelling a ride does not prove payment, issue
        a refund or erase its history. Available offers can expire
        automatically.
      </p>
      <h2>Safety and responsibility</h2>
      <p>
        Optional private messages help the driver and requesting rider arrange
        their trip. Do not send abusive, unsolicited promotional or misleading
        messages. You can withdraw your request or cancel your ride using the
        available ride controls. Messaging ends when the request or ride
        closes. Report a concern via WhatsApp opens the creator’s personal
        WhatsApp account, not an in-app or emergency response service. Messages
        and reports are not guaranteed to be read immediately.
      </p>
      <p>
        Drivers are responsible for holding the licences, registration,
        insurance and permissions applicable to their journey, maintaining a
        safe vehicle and following road rules. Both participants should check
        that the arrangement is suitable and lawful. Do not operate the app
        while driving; stop safely first. Do not begin or continue a ride if you
        feel unsafe.
      </p>
      <p>
        GUMWHEEL is not an emergency or monitored safety service. Contact local
        emergency services when urgent help is needed. Route fit, pickup codes
        and location displays do not replace your own checks and judgment.
      </p>
      <h2>Fares and payment</h2>
      <p>
        Rides may be free or have a driver-set contribution, shown before you
        request. Free rides require no payment. Paid fares are shown in Australian
        dollars. Payment is cashless and made
        directly through your bank using the driver’s PayID, revealed after
        pickup confirmation. Check the recipient details your bank displays
        before paying. GUMWHEEL does not hold funds, verify transfers, provide
        escrow or automatically refund payments. Discuss payment issues with the
        other participant and your bank; you can also report concerns to us.
      </p>
      <h2>Estimates and availability</h2>
      <p>
        Routes, arrival times and positions are estimates and may be inaccurate
        or out of date. Browser permissions, connectivity, battery and
        third-party services affect updates. Ride availability and uninterrupted
        access are not guaranteed. The pilot also contains simulated test rides;
        these are not offers of real transport and their payment details must
        not be used to send money.
      </p>
      <h2>Your rights and updates</h2>
      <p>
        Nothing in these terms excludes or limits rights or remedies that cannot
        lawfully be excluded, including applicable Australian Consumer Law
        rights. These terms do not provide a blanket waiver of responsibility
        for harm.
      </p>
      <p>
        Features and these terms may change as the pilot develops. The revision
        date above identifies this version. Contact us if you need clarification
        before arranging a ride.
      </p>
    </LegalPage>
  );
}
