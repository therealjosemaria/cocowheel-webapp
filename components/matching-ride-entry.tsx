"use client";
import { useEffect, useState } from "react";
import HomeClient from "./home-client";
import { ApiError, apiErrorMessage, cocowheelsApi } from "@/lib/api-client";
import type { UsualRoute } from "@/lib/usual-route";

// No credentials or private route coordinates are carried in the email URL.
export default function MatchingRideEntry({ match }: { match: string }) {
  const [state, setState] = useState<{ route?: UsualRoute | null; error?: string; signedOut?: boolean }>({});
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    let generation = 0;
    const load = async () => {
      const current = ++generation;
      setState({});
      try {
        const { route } = await cocowheelsApi<{ route: UsualRoute | null }>("/api/usual-route");
        if (live && current === generation) setState({ route });
      } catch (reason) {
        if (live && current === generation) setState(reason instanceof ApiError && reason.status === 401
          ? { signedOut: true } : { error: apiErrorMessage(reason) });
      }
    };
    void load();
    window.addEventListener("cocowheels:identity-changed", load);
    return () => { live = false; window.removeEventListener("cocowheels:identity-changed", load); };
  }, [retry, match]);
  if (state.route !== undefined) return <HomeClient initialScreen="RIDER"
    initialMatch={state.route ? { rideId: match, origin: state.route.origin, destination: state.route.destination } : undefined}
    initialNotice={state.route ? undefined : "Your saved route is no longer available. Choose where from and where to to find a ride."} />;
  return <section className="activity-page"><div className="activity-panel usual-route-panel">
    <h1 className="page-title">Find a ride</h1><div className="usual-route-body">
      <p role="status">{state.error ?? (state.signedOut ? "Sign in to view rides matching your usual route." : "Loading your matching ride…")}</p>
      {state.signedOut ? <button className="primary" onClick={() => window.dispatchEvent(new CustomEvent("cocowheels:verify-university"))}>Sign in</button>
        : state.error ? <button className="secondary" onClick={() => setRetry((n) => n + 1)}>Try again</button> : null}
    </div></div></section>;
}
