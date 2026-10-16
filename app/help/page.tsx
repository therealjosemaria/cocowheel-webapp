export default function HelpPage() {
  return (
    <section className="activity-page">
      <div className="activity-panel">
        <h1 className="page-title">How it works</h1>
        <ol className="how-it-works-steps">
          <li><strong>Verify your UniKey.</strong> Enter the code sent to your university email to offer or request a ride.</li>
          <li><strong>Going somewhere?</strong> Find a ride going your way and request to join. Or offer a ride with your destination, fare and PayID.</li>
          <li><strong>Agree to ride together.</strong> The driver accepts one rider. Keep the app open and location enabled for location updates.</li>
          <li><strong>Confirm pickup.</strong> At pickup, the rider shares their four-digit code and the driver enters it to start the ride.</li>
          <li><strong>Pay and finish.</strong> After pickup is confirmed, the rider can copy the driver’s PayID and pay through their bank. Either person can complete the ride when it ends.</li>
        </ol>
      </div>
    </section>
  );
}
