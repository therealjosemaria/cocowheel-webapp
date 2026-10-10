import Link from "next/link";
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      © 2026 Cocowheels. All rights reserved.{" "}
      <span aria-label="Australia">🇦🇺</span>
      <Link href="/admin" className="admin-footer-link">
        Admin login
      </Link>
    </footer>
  );
}
