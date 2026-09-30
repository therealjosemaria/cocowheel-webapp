import type { Metadata } from "next";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cocowheels",
  description: "A simple planned ride, together.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <main className="app-shell">
          <header className="topbar">
            <Link href="/" className="brand">
              <span className="brand-mark">C</span>
              <span>Cocowheels</span>
            </Link>
            <span className="guest-label">Guest-only rides</span>
          </header>
          {children}
          <footer>Private by design · No accounts · Fixed prices</footer>
        </main>
      </body>
    </html>
  );
}
