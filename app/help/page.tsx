import Link from "next/link";
import RideFieldLabel from "@/components/ride-field-label";
import { publicPageMetadata, SITE_URL } from "@/lib/seo";
import { RIDER_STEPS, DRIVER_STEPS, HELP_FAQS, CONTACT_EMAIL } from "@/lib/public-information";

const helpMetadata = publicPageMetadata(
  "/help", "How Carpooling Works | GUMWHEEL",
  "Learn how to find or share a journey with GUMWHEEL, agree on contributions, coordinate pickup and travel together.",
);
export const metadata = {
  ...helpMetadata,
  alternates: { ...helpMetadata.alternates, types: { "text/markdown": `${SITE_URL}/help.md` } },
};

export default function HelpPage() {
  return (
    <section className="activity-page">
      <div className="activity-panel">
        <h1 className="page-title">How it works</h1>
        <div className="help-role-paths">
          <section className="help-role help-role-rider" aria-labelledby="rider-steps-heading">
            <h2 id="rider-steps-heading"><RideFieldLabel icon="rider">Find a journey</RideFieldLabel></h2>
            <ol className="how-it-works-steps">
              {RIDER_STEPS.map(step => <li key={step}>{step}</li>)}
            </ol>
          </section>
          <section className="help-role help-role-driver" aria-labelledby="driver-steps-heading">
            <h2 id="driver-steps-heading"><RideFieldLabel icon="driver">Post a journey</RideFieldLabel></h2>
            <ol className="how-it-works-steps">
              {DRIVER_STEPS.map(step => <li key={step}>{step}</li>)}
            </ol>
          </section>
        </div>
        <section className="help-section help-section-faq" aria-labelledby="faq-heading">
          <h2 id="faq-heading">Frequently asked questions</h2>
          <div className="help-faq">
            {HELP_FAQS.map(({ question, answer }, index) => <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
              {index === 0 && <Link className="help-email" href="/about">About GUMWHEEL</Link>}
            </details>)}
          </div>
        </section>
        <section className="help-section" aria-labelledby="suggestion-heading">
          <h2 id="suggestion-heading">Have a suggestion?</h2>
          <p>We’d love to hear how we can improve GUMWHEEL.</p>
          <a className="help-email" href={`mailto:${CONTACT_EMAIL}?subject=GUMWHEEL%20suggestion`}>Email us</a>
        </section>
      </div>
    </section>
  );
}
