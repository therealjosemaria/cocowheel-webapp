import HomeClient from "@/components/home-client";
import MatchingRideEntry from "@/components/matching-ride-entry";
import { homePageMetadata } from "@/lib/seo";
import PublicSiteIdentity from "@/components/public-site-identity";
import { ABOUT_SUMMARY } from "@/lib/public-information";
import Link from "next/link";

type SearchParams = { start?: string | string[]; match?: string | string[] };

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return homePageMetadata((await searchParams).match);
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { start: requested, match } = await searchParams;
  if (typeof match === "string" && match.length > 0 && match.length <= 100) return <MatchingRideEntry match={match} />;
  const initialScreen =
    requested === "driver"
      ? "DRIVER"
      : requested === "rider"
        ? "RIDER"
        : "HOME";

  return <>
    {!match && <PublicSiteIdentity />}
    <HomeClient initialScreen={initialScreen} />
    <noscript><section className="activity-panel">
      <div className="activity-panel-content">
        <p>{ABOUT_SUMMARY}</p>
        <p>Enable JavaScript to search and arrange journeys. You can still read <Link className="help-email" href="/help">How it works</Link> or <Link className="help-email" href="/about">About GUMWHEEL</Link>.</p>
      </div>
    </section></noscript>
  </>;
}
