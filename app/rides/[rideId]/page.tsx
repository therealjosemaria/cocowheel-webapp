import RidePreviewClient from "@/components/ride-preview-client";

export default async function RidePreviewPage({
  params,
}: {
  params: Promise<{ rideId: string }>;
}) {
  const { rideId } = await params;
  return <RidePreviewClient rideId={rideId} />;
}
