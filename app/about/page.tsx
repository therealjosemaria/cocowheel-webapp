import Link from "next/link";
import { publicPageMetadata } from "@/lib/seo";
import { ABOUT_SUMMARY, CONTACT_EMAIL } from "@/lib/public-information";

export const metadata = publicPageMetadata("/about", "About GUMWHEEL | Sydney Carpooling", ABOUT_SUMMARY);

export default function AboutPage() {
  return <section className="activity-page"><div className="activity-panel">
    <h1 className="page-title">About GUMWHEEL</h1>
    <section className="help-section" aria-labelledby="about-carpool">
      <h2 id="about-carpool">Share your journey</h2>
      <p>{ABOUT_SUMMARY}</p>
      <p>Drivers can post where they’re going or browse journey requests from riders. Riders can request to join a posted journey, or post the journey they need and review offers from drivers.</p>
      <p>Use GUMWHEEL in your phone or desktop browser. No app download or university email is required; sign in with the code sent to your email.</p>
      <Link className="help-email" href="/help">How it works</Link>
      <p><Link className="help-email" href="/carpooling/sydney">Carpooling in Sydney</Link></p>
    </section>
    <section className="help-section" aria-labelledby="about-pilot">
      <h2 id="about-pilot">An early pilot</h2>
      <p>We’re starting in Sydney. Availability depends on people posting compatible journeys, so a match is not guaranteed.</p>
      <p>Journeys can be free or include an agreed contribution. GUMWHEEL helps people coordinate through messages and manage requests and offers. Payments are arranged directly using PayID; GUMWHEEL does not process them.</p>
    </section>
    <section className="help-section" aria-labelledby="contact">
      <h2 id="contact">Contact</h2>
      <p>Questions, feedback or interested in trying GUMWHEEL with your community?</p>
      <a className="help-email" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
    </section>
  </div></section>;
}
