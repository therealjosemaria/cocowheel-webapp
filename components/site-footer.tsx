import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        © 2026 GUMWHEEL. All rights reserved.{" "}
        <span aria-label="Australia">🇦🇺</span>
      </div>
      <nav className="footer-legal" aria-label="Legal">
        <Link href="/privacy">Privacy</Link>
        <span aria-hidden="true">·</span>
        <Link href="/terms">Terms</Link>
      </nav>
    </footer>
  );
}
