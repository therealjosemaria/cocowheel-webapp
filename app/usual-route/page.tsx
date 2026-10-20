import UsualRouteClient from "@/components/usual-route-client";

export default async function UsualRoutePage({
  searchParams,
}: {
  searchParams: Promise<{ ride?: string }>;
}) {
  const { ride } = await searchParams;
  return <UsualRouteClient match={typeof ride === "string" ? ride : null} />;
}
