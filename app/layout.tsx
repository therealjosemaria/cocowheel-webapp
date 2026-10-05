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
              COCO WHEELS
            </Link>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
