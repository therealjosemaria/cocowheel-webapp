import Link from "next/link";

export default function NotFound() {
  return <section className="activity-page"><div className="activity-panel">
    <h1 className="page-title">Page not found</h1>
    <div className="help-section">
      <p>This link may have changed. You can continue from Home or see how GUMWHEEL works.</p>
      <p><Link className="help-email" href="/">Home</Link></p>
      <Link className="help-email" href="/help">How it works</Link>
    </div>
  </div></section>;
}
