import AdminPanel from "@/components/admin-panel";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError, apiErrorMessage, requestJson } from "@/lib/api-transport";

export const metadata = {
  title: "Admin · GUMWHEEL",
  robots: { index: false, follow: false },
};
export default async function AdminPage() {
  const session = (await cookies()).get("cocowheels_guest")?.value;
  const target = process.env.COCOWHEELS_API_PROXY_TARGET;
  if (!session || !target) redirect("/");
  let allowed = false;
  try {
    const result = await requestJson<{ canAdmin: boolean }>(
      `${target.replace(/\/$/, "")}/api/university/session`,
      {
        headers: { Cookie: `cocowheels_guest=${encodeURIComponent(session)}` },
        cache: "no-store",
      },
      5000,
    );
    allowed = result.canAdmin === true;
  } catch (reason) {
    if (reason instanceof ApiError && [401, 403].includes(reason.status))
      redirect("/");
    // No admin data or controls are rendered until authorization succeeds.
    return (
      <section className="activity-panel">
        <h1 className="page-title">Admin</h1>
        <div className="activity-panel-content">
          <p role="alert">
            {apiErrorMessage(
              reason,
              "We couldn’t check admin access. Please try again.",
            )}
          </p>
          <a className="primary" href="/admin">
            Try again
          </a>
        </div>
      </section>
    );
  }
  if (!allowed) redirect("/");
  return <AdminPanel />;
}
