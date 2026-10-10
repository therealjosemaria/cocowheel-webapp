import AdminPanel from "@/components/admin-panel";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Admin · Cocowheels",
  robots: { index: false, follow: false },
};
export default async function AdminPage() {
  const session = (await cookies()).get("cocowheels_guest")?.value;
  const target = process.env.COCOWHEELS_API_PROXY_TARGET;
  if (!session || !target) redirect("/");
  let allowed = false;
  try {
    const response = await fetch(
      `${target.replace(/\/$/, "")}/api/university/session`,
      {
        headers: { Cookie: `cocowheels_guest=${encodeURIComponent(session)}` },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );
    allowed = response.ok && (await response.json()).canAdmin === true;
  } catch {
    // Fail closed if identity cannot be verified by the API.
  }
  if (!allowed) redirect("/");
  return <AdminPanel />;
}
