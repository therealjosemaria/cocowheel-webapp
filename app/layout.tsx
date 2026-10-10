import type { Metadata } from "next";
import Link from "next/link";
import AppNavigation from "@/components/app-navigation";
import SiteFooter from "@/components/site-footer";
import LocationTracker from "@/components/location-tracker";
import UniversityVerification from "@/components/university-verification";
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
        <LocationTracker />
        <UniversityVerification />
        <main className="app-shell">
          <header className="topbar">
            <Link href="/" className="brand">
              COCOWHEELS
            </Link>
            <AppNavigation />
          </header>
          <div className="app-content">{children}</div>
          <SiteFooter />
        </main>
      </body>
    </html>
  );
}
