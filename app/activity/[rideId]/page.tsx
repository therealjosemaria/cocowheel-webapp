import ActivityRideClient from "@/components/activity-ride-client";

export default async function ActivityRidePage({
  params,
}: {
  params: Promise<{ rideId: string }>;
}) {
  const { rideId } = await params;
  return <ActivityRideClient rideId={rideId} />;
}
