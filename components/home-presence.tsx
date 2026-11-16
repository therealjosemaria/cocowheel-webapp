"use client";

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { PRESENCE_REFRESH_MS, presenceViewportQuery, readPresenceReply, type PresenceReply, type PresenceViewport } from '@/lib/home-presence';
import { subscribeVehicleSaved } from '@/lib/vehicle-updates';

const PresenceMap = dynamic(() => import('./presence-map'), { ssr: false });

export default function HomePresence() {
  const [presence, setPresence] = useState<PresenceReply>({ cells:[],hasPresence:false });
  const [viewport, setViewport] = useState<PresenceViewport | null>(null);
  const changeViewport = useCallback((next: PresenceViewport) => {
    setViewport(current => current && presenceViewportQuery(current)===presenceViewportQuery(next) ? current : next);
  }, []);
  useEffect(() => {
    let live = true;
    let controller: AbortController | undefined;
    const refresh = async () => {
      if (document.hidden || controller) return;
      const request = new AbortController(); controller = request;
      const timeout = window.setTimeout(() => request.abort(),10_000);
      try {
        const query = viewport ? presenceViewportQuery(viewport) : 'overview=1';
        const response = await fetch('/api/home-presence?'+query,{ credentials:'omit',cache:'no-store',signal:request.signal });
        if (!response.ok) throw new Error('PRESENCE_UNAVAILABLE');
        const next = readPresenceReply(await response.json());
        if (live && !document.hidden && controller===request) {
          setPresence(previous => ({ ...next,bounds:next.bounds ?? previous.bounds }));
          if (!next.hasPresence) setViewport(null);
        }
      } catch {
        // Keep an established map usable for panning/recovery, but clear stale figures.
        if (live && !document.hidden && controller===request) setPresence(previous => ({ ...previous,cells:[] }));
      } finally {
        window.clearTimeout(timeout);
        if (controller===request) controller=undefined;
      }
    };
    const visibility = () => {
      if (document.hidden) {
        const pending=controller; controller=undefined; pending?.abort();
        setPresence(previous => ({ ...previous,cells:[] }));
      } else void refresh();
    };
    void refresh();
    const timer=window.setInterval(() => void refresh(),PRESENCE_REFRESH_MS);
    const unsubscribe=subscribeVehicleSaved(() => {
      const pending=controller; controller=undefined; pending?.abort(); void refresh();
    });
    document.addEventListener('visibilitychange',visibility);
    return () => { live=false; controller?.abort(); clearInterval(timer); unsubscribe(); document.removeEventListener('visibilitychange',visibility); };
  }, [viewport]);
  if (!presence.hasPresence) return null;
  return <section className="home-presence" aria-label="Posted journeys and journey requests by area">
    <PresenceMap cells={presence.cells} bounds={presence.bounds} onViewport={changeViewport} />
  </section>;
}
