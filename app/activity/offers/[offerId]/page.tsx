import { RiderDemandDetails } from "@/components/rider-demands";

export default async function OfferedJourneyPage({ params }: {
  params: Promise<{ offerId: string }>;
}) {
  const { offerId } = await params;
  return <RiderDemandDetails offerId={offerId} />;
}
