import Link from "next/link";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata(
  "/carpooling/sydney",
  "Sydney Carpooling: Find or Share a Ride | GUMWHEEL",
  "Looking for a carpool in Sydney? Find a shared journey, post where you need to go, or offer a spare seat. Free rides or agreed contributions, in your browser.",
);

export default function SydneyCarpoolingPage() {
  return <section className="activity-page"><div className="activity-panel">
    <h1 className="page-title">Carpooling in Sydney</h1>
    <section className="help-section" aria-labelledby="sydney-find">
      <h2 id="sydney-find">Find someone heading your way</h2>
      <p>Carpooling means sharing a journey with a driver travelling in the same direction. GUMWHEEL helps people in Sydney arrange that journey in a phone or desktop browser.</p>
      <p>Choose where from, where to and your preferred date or time. Review a driver’s route, departure, profile and contribution before requesting to join. Coordinate the pickup through messages once you connect.</p>
      <Link className="help-email" href="/?start=rider">Find a journey</Link>
    </section>
    <section className="help-section" aria-labelledby="sydney-request">
      <h2 id="sydney-request">No journey that fits?</h2>
      <p>Post the journey you need using Request this journey. A driver can offer to take you, and you decide whether to accept. You can also save your usual route and opt into emails when a matching journey is posted.</p>
      <p>For a trip to campus or work, compare both pickup and destination with your actual plans. A nearby suburb or similar destination does not guarantee the journey will suit; confirm the details together.</p>
    </section>
    <section className="help-section" aria-labelledby="sydney-drive">
      <h2 id="sydney-drive">Already driving?</h2>
      <p>Post your planned journey or browse See journey requests to find people looking for a ride. You can explore requests before choosing a route, then review the journey before making an offer.</p>
      <p>Journeys can be free or include an agreed contribution. For paid journeys, the rider pays directly using PayID after pickup confirmation; GUMWHEEL does not process payments.</p>
      <Link className="help-email" href="/?start=driver">Post a journey</Link>
    </section>
    <section className="help-section" aria-labelledby="sydney-start">
      <h2 id="sydney-start">An early Sydney pilot</h2>
      <p>You do not need a university email or an app download. Sign in using the code sent to your email. Availability depends on people posting compatible journeys, so a match is not guaranteed.</p>
      <Link className="help-email" href="/help">How it works</Link>
    </section>
  </div></section>;
}
