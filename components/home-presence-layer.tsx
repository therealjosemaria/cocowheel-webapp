"use client";

import { useEffect, useRef } from 'react';
import { Marker, useMap } from 'react-leaflet';
import { PRESENCE_MOVE_DELAY_MS, presenceViewport, type PresenceCell, type PresenceBounds, type PresenceViewport } from '@/lib/home-presence';
import { modelMarkerIcon } from '@/lib/map-role-icon';
import { visibleMapMarkers } from '@/lib/map-marker-budget';
import { useMapMarkerBudget } from './use-map-marker-budget';

const offsets: [number, number][][] = [[[0, 0]], [[-22, 0], [22, 0]], [[-22, -12], [22, -12], [0, 22]]];
const icons = {
  driver: offsets.map(group => group.map(offset => modelMarkerIcon('driver', '', false, offset))),
  rider: offsets.map(group => group.map(offset => modelMarkerIcon('rider', '', false, offset))),
};

function AreaView({ cells, bounds }: { cells: PresenceCell[]; bounds?: PresenceBounds }) {
  const map = useMap();
  const framedAreas = useRef<string | null>(null);
  useEffect(() => {
    // Counts/artwork refresh each minute; preserve the viewport for the same areas.
    const areas = [...new Set(cells.map(cell => `${cell.latitude}:${cell.longitude}`))].sort().join('|');
    if (framedAreas.current !== null) return;
    framedAreas.current = areas;
    if (bounds) {
      map.fitBounds([[Math.max(-85,Math.min(85,bounds.south)),bounds.west],[Math.max(-85,Math.min(85,bounds.north)),bounds.east]], { padding:[32,32],maxZoom:11,animate:false });
      return;
    }
    if (!cells.length) {
      map.setView([-33.89, 151.2], 11, { animate: false });
      return;
    }
    map.fitBounds(cells.flatMap(cell => [
      [Math.max(-85, cell.latitude - 0.025), cell.longitude - 0.025] as [number, number],
      [Math.min(85, cell.latitude + 0.025), cell.longitude + 0.025] as [number, number],
    ]), { padding: [32, 32], maxZoom: 11, animate: false });
  }, [cells, bounds, map]);
  return null;
}

function PresenceMarkers({ cells }: { cells: PresenceCell[] }) {
  const map = useMap();
  const view = useMapMarkerBudget();
  const slots = new Map<string, number>();
  const totals = new Map<string, number>();
  for (const cell of cells) {
    const key = `${cell.latitude}:${cell.longitude}`;
    totals.set(key, (totals.get(key) ?? 0) + cell.count);
  }
  const markers = cells.flatMap(cell => Array.from({ length: cell.count }, (_, index) => {
    const key = `${cell.latitude}:${cell.longitude}`;
    const slot = slots.get(key) ?? 0;
    slots.set(key, slot + 1);
    const point = map.latLngToContainerPoint([cell.latitude, cell.longitude]);
    const offset = offsets[totals.get(key)! - 1][slot];
    return { area: key, x: point.x + offset[0], y: point.y + offset[1], ...cell, artwork: cell.artworks?.[index], key: `${key}:${cell.role}:${index}`, slot, total: totals.get(key)! };
  }));
  return <>
    {visibleMapMarkers(markers, view.width, view.height, view.zoom, view.reduced).map(cell => <Marker key={cell.key}
      position={[cell.latitude, cell.longitude]} icon={cell.artwork
        ? modelMarkerIcon(cell.role, '', false, offsets[cell.total - 1][cell.slot], undefined, cell.artwork, view.detail)
        : icons[cell.role][cell.total - 1][cell.slot]}
      interactive={false} keyboard={false} />)}
  </>;
}

function ViewportUpdates({ onViewport }: { onViewport: (view: PresenceViewport) => void }) {
  const map = useMap();
  useEffect(() => {
    let timer = 0, initial = 0;
    const publish = () => {
      if (document.hidden || !map.getSize().x || !map.getSize().y) return;
      const b = map.getBounds(), width = b.getEast()-b.getWest();
      const wrap = (n: number) => ((n+180)%360+360)%360-180;
      const west = width>=360 ? -180 : wrap(b.getWest()), east = width>=360 ? 180 : wrap(b.getEast());
      onViewport(presenceViewport({ south:Math.max(-90,b.getSouth()),north:Math.min(90,b.getNorth()),west,east,zoom:Math.round(map.getZoom()) }));
    };
    const stop = () => { clearTimeout(timer); timer = window.setTimeout(publish,PRESENCE_MOVE_DELAY_MS); };
    const start = () => clearTimeout(timer);
    const visibility = () => document.hidden ? start() : stop();
    document.addEventListener("visibilitychange",visibility);
    initial = requestAnimationFrame(stop);
    map.on("movestart zoomstart",start); map.on("moveend zoomend resize",stop);
    return () => { clearTimeout(timer); cancelAnimationFrame(initial); document.removeEventListener("visibilitychange",visibility); map.off("movestart zoomstart",start); map.off("moveend zoomend resize",stop); };
  }, [map,onViewport]);
  return null;
}

export type HomePresenceLayerProps = { cells: PresenceCell[]; bounds?: PresenceBounds; onViewport: (view: PresenceViewport) => void };

export default function HomePresenceLayer({ cells, bounds, onViewport }: HomePresenceLayerProps) {
  return <>
    <AreaView cells={cells} bounds={bounds} />
    <ViewportUpdates onViewport={onViewport} />
    <PresenceMarkers cells={cells} />
  </>;
}
