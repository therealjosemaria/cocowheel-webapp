import UsualRouteClient from "@/components/usual-route-client";
import { redirect } from "next/navigation";

export default async function UsualRoutePage({
  searchParams,
}: {
  searchParams: Promise<{ ride?: string; alerts?: string }>;
}) {
  const { ride, alerts } = await searchParams;
  if (typeof ride === "string" && ride.length > 0 && ride.length <= 100) redirect(`/?start=rider&match=${encodeURIComponent(ride)}`);
  return <UsualRouteClient alertsEntry={alerts === "1"} />;
}
