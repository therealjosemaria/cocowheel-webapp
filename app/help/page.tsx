import RideFieldLabel from "@/components/ride-field-label";

export default function HelpPage() {
  return (
    <section className="activity-page">
      <div className="activity-panel">
        <h1 className="page-title">How it works</h1>
        <p className="help-intro">
          For University of Sydney students. Sign in with your UniKey to get
          started. More universities coming soon.
        </p>
        <div className="help-role-paths">
          <section className="help-role help-role-rider" aria-labelledby="rider-steps-heading">
            <h2 id="rider-steps-heading"><RideFieldLabel icon="rider">Find a ride</RideFieldLabel></h2>
            <ol className="how-it-works-steps">
              <li><strong>Choose your destination.</strong> Compare available rides.</li>
              <li><strong>Request to join.</strong> Wait for the driver to accept.</li>
              <li><strong>Meet your driver.</strong> Share your four-digit pickup code.</li>
              <li><strong>Pay by PayID.</strong> You’ll see the driver’s payment details once they confirm your pickup.</li>
            </ol>
          </section>
          <section className="help-role help-role-driver" aria-labelledby="driver-steps-heading">
            <h2 id="driver-steps-heading"><RideFieldLabel icon="driver">Offer a ride</RideFieldLabel></h2>
            <ol className="how-it-works-steps">
              <li><strong>Publish your route.</strong> Set your fare and choose how to receive payment by PayID.</li>
              <li><strong>Choose a rider.</strong> Review their route and accept.</li>
              <li><strong>Confirm pickup.</strong> Enter the rider’s four-digit code.</li>
              <li><strong>Share the ride.</strong> Either person can complete it after arrival.</li>
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
