"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiErrorMessage, requestJson } from "@/lib/api-transport";
import UniversityVerification from "./university-verification";

export default function AdminSignIn({ denied = false }: { denied?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState(denied ? "This account doesn’t have admin access." : "");
  async function verified() {
    try {
      const session = await requestJson<{ canAdmin: boolean }>("/api/university/session", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (session.canAdmin) router.refresh();
      else setError("This account doesn’t have admin access.");
    } catch (reason) {
      setError(apiErrorMessage(reason, "We couldn’t check admin access. Please try again."));
    }
  }
  return <section className="activity-page"><div className="activity-panel admin-sign-in">
    <h1 className="page-title">Admin</h1>
    <div className="activity-panel-content">
      {error && <p role="alert">{error}</p>}
      <UniversityVerification inline onVerified={() => void verified()} />
    </div>
  </div></section>;
}
