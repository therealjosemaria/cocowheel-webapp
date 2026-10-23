import HomeClient from "@/components/home-client";
import MatchingRideEntry from "@/components/matching-ride-entry";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ start?: string | string[]; match?: string | string[] }>;
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
