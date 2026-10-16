export default function HelpPage() {
  return (
    <section className="activity-page">
      <div className="activity-panel">
        <h1 className="page-title">How it works</h1>
        <p className="help-intro">
          For University of Sydney students. Sign in with your UniKey to get
          started. More universities coming soon.
        </p>
        <ol className="how-it-works-steps">
          <li><strong>Going somewhere?</strong> Find a ride going your way, or offer one with your destination, fare and PayID.</li>
          <li><strong>Ride together.</strong> Request to join. Once the driver accepts, keep the app open and location enabled for updates.</li>
          <li><strong>Confirm pickup.</strong> At pickup, the rider shares their four-digit code and the driver enters it to start the ride.</li>
          <li><strong>Pay and finish.</strong> Pay the driver directly through your bank using their PayID, revealed after pickup confirmation. Either person can complete the ride when it ends.</li>
        </ol>
        <section className="help-section" aria-labelledby="faq-heading">
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
