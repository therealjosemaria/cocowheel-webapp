import RideFieldLabel from "@/components/ride-field-label";

export default function HelpPage() {
  return (
    <section className="activity-page">
      <div className="activity-panel">
        <h1 className="page-title">How it works</h1>
        <div className="help-role-paths">
          <section className="help-role help-role-rider" aria-labelledby="rider-steps-heading">
            <h2 id="rider-steps-heading"><RideFieldLabel icon="rider">Find a ride</RideFieldLabel></h2>
            <ol className="how-it-works-steps">
              <li>Choose your destination.</li>
              <li>Request to join a ride.</li>
              <li>Meet your driver.</li>
              <li>Pay your driver.</li>
            </ol>
          </section>
          <section className="help-role help-role-driver" aria-labelledby="driver-steps-heading">
            <h2 id="driver-steps-heading"><RideFieldLabel icon="driver">Offer a ride</RideFieldLabel></h2>
            <ol className="how-it-works-steps">
              <li>Publish your route.</li>
              <li>Accept a rider.</li>
              <li>Meet your rider.</li>
              <li>Receive payment.</li>
            </ol>
          </section>
        </div>
        <section className="help-section help-section-faq" aria-labelledby="faq-heading">
          <h2 id="faq-heading">Frequently asked questions</h2>
          <div className="help-faq">
            <details>
              <summary>How do I pay?</summary>
              <p>Pay directly through your bank using the driver’s PayID: mobile number, email, ABN or organisation identifier. Payment details appear after pickup confirmation. GUMWHEEL is cashless and does not process payments. QR payments are planned to make this quicker.</p>
            </details>
            <details>
              <summary>When do I share my pickup code?</summary>
              <p>Share it when you meet your driver. They enter the code to confirm pickup and start the ride.</p>
            </details>
            <details>
              <summary>Should I keep the app open?</summary>
              <p>Yes—keep it open with location enabled during your ride. Location updates may pause when the app is in the background or your phone is locked.</p>
            </details>
            <details>
              <summary>Can I cancel?</summary>
              <p>You can withdraw a pending request or cancel an ongoing ride using its available actions.</p>
            </details>
          </div>
        </section>
        <section className="help-section" aria-labelledby="suggestion-heading">
          <h2 id="suggestion-heading">Have a suggestion?</h2>
          <p>We’d love to hear how we can improve GUMWHEEL.</p>
          <a className="help-email" href="mailto:jmos0905@uni.sydney.edu.au?subject=GUMWHEEL%20suggestion">Email us</a>
        </section>
      </div>
    </section>
  );
}
