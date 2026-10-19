import type { Metadata } from "next";
import Image from "next/image";
import AppNavigation from "@/components/app-navigation";
import SiteFooter from "@/components/site-footer";
import LocationTracker from "@/components/location-tracker";
import UniversityVerification from "@/components/university-verification";
import ConnectionNotice from "@/components/connection-notice";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "GUMWHEEL",
  description: "A simple planned ride, together.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <UniversityVerification />
        <ConnectionNotice />
        <main className="app-shell">
          <header className="topbar">
            <span className="brand">
              GUMWHEEL
              <span className="brand-art" aria-hidden="true">
                <Image
                  src="/brand/gumwheel-original.png"
                  unoptimized
                  alt=""
                  width={15}
                  height={15}
                  sizes="15px"
                />
              </span>
            </span>
            <AppNavigation />
          </header>
          <div className="app-content">
            <LocationTracker />
            {children}
          </div>
          <SiteFooter />
        </main>
      </body>
    </html>
  );
}
