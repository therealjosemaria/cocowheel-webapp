import HomeClient from "@/components/home-client";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ start?: string | string[] }>;
}) {
  const requested = (await searchParams).start;
  const initialScreen =
    requested === "driver"
      ? "DRIVER"
      : requested === "rider"
        ? "RIDER"
        : "HOME";

  return <HomeClient initialScreen={initialScreen} />;
}
