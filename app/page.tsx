import HomeClient from "@/components/home-client";
import MatchingRideEntry from "@/components/matching-ride-entry";
import { homePageMetadata } from "@/lib/seo";

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

  return <HomeClient initialScreen={initialScreen} />;
}
