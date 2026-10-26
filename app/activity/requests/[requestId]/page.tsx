import { RiderDemandDetails } from "@/components/rider-demands";

export default async function RequestedJourneyPage({ params }: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return <RiderDemandDetails requestId={requestId} />;
}
