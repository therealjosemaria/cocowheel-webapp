import ActivityRideClient from "@/components/activity-ride-client";

export default async function ActivityRidePage({
  params,
  searchParams,
}: {
  params: Promise<{ rideId: string }>;
  searchParams: Promise<{ request?: string | string[] }>;
}) {
  const { rideId } = await params;
  const requested = (await searchParams).request;
  const requestId = typeof requested === "string" ? requested : undefined;
  return <ActivityRideClient rideId={rideId} requestId={requestId} />;
}
