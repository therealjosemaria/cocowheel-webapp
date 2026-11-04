"use client";

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { PRESENCE_REFRESH_MS, readPresenceCells, type PresenceCell } from '@/lib/home-presence';

const PresenceMap = dynamic(() => import('./presence-map'), { ssr: false });

export default function HomePresence() {
  const [cells, setCells] = useState<PresenceCell[]>([]);
  useEffect(() => {
    let live = true;
    let controller: AbortController | undefined;
    const refresh = async () => {
      if (document.hidden || controller) return;
      const request = new AbortController();
      controller = request;
      const timeout = window.setTimeout(() => request.abort(), 10_000);
      try {
        const response = await fetch('/api/home-presence', { credentials: 'omit', cache: 'no-store', signal: request.signal });
        if (!response.ok) throw new Error('PRESENCE_UNAVAILABLE');
        const next = readPresenceCells(await response.json());
        if (live && !document.hidden && controller === request) setCells(next);
      } catch {
        // A failed refresh must not keep showing old posts as current presence.
        if (live && !document.hidden && controller === request) setCells([]);
      } finally {
        window.clearTimeout(timeout);
        if (controller === request) controller = undefined;
      }
    };
    const visibility = () => {
      if (document.hidden) {
        const pending = controller;
        controller = undefined;
        pending?.abort();
        setCells([]);
      }
      else void refresh();
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), PRESENCE_REFRESH_MS);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      live = false;
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  if (!cells.length) return null;
  return <section className="home-presence" aria-label="Posted journeys and journey requests by area">
    <PresenceMap cells={cells} />
  </section>;
}
