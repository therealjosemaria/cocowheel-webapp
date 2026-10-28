import type { Metadata } from "next";
import Image from "next/image";
import AppNavigation from "@/components/app-navigation";
import SiteFooter from "@/components/site-footer";
import LocationTracker from "@/components/location-tracker";
import UniversityVerification from "@/components/university-verification";
import ConnectionNotice from "@/components/connection-notice";
import WebAnalytics from "@/components/web-analytics";
import { JourneyUpdateProvider } from "@/components/journey-update-context";
import { SITE_URL, SITE_TITLE, SITE_DESCRIPTION } from "@/lib/seo";
import { siteVerification } from "@/lib/site-verification";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: "GUMWHEEL",
  verification: siteVerification(process.env.GOOGLE_SITE_VERIFICATION, process.env.BING_SITE_VERIFICATION),
  // Public information pages opt in individually; account/journey pages do not.
  robots: { index: false, follow: false },
  referrer: "origin",
  icons: {
    icon: { url: "/brand/gumwheel-original.png", type: "image/png", sizes: "1254x1254" },
    apple: { url: "/brand/gumwheel-original.png", sizes: "1254x1254" },
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <JourneyUpdateProvider>
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
        <WebAnalytics />
        </JourneyUpdateProvider>
      </body>
    </html>
  );
}
