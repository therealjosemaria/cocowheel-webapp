"use client";

import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import type { PresenceCell } from '@/lib/home-presence';
import { modelMarkerIcon } from '@/lib/map-role-icon';
import { MAP_TILE_URL } from '@/lib/map-style';

const offsets: [number, number][][] = [[[0, 0]], [[-22, 0], [22, 0]], [[-22, -12], [22, -12], [0, 22]]];
const icons = {
  driver: offsets.map(group => group.map(offset => modelMarkerIcon('driver', '', false, offset))),
  rider: offsets.map(group => group.map(offset => modelMarkerIcon('rider', '', false, offset))),
};

function AreaView({ cells }: { cells: PresenceCell[] }) {
  const map = useMap();
  useEffect(() => {
    if (!cells.length) {
      map.setView([-33.89, 151.2], 11, { animate: false });
      return;
    }
    map.fitBounds(cells.flatMap(cell => [
      [Math.max(-85, cell.latitude - 0.025), cell.longitude - 0.025] as [number, number],
      [Math.min(85, cell.latitude + 0.025), cell.longitude + 0.025] as [number, number],
    ]), { padding: [32, 32], maxZoom: 11, animate: false });
  }, [cells, map]);
  return null;
}

export default function PresenceMap({ cells }: { cells: PresenceCell[] }) {
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
    return { ...cell, key: `${key}:${cell.role}:${index}`, slot, total: totals.get(key)! };
  }));
  return <MapContainer center={[-33.89, 151.2]} zoom={11}
    className="home-presence-map" zoomControl={false} dragging={false}
    scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false}
    boxZoom={false} keyboard={false} zoomAnimation={false} fadeAnimation={false}
    markerZoomAnimation={false}>
    <TileLayer url={MAP_TILE_URL} attribution={'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'} />
    <AreaView cells={cells} />
    {markers.map(cell => <Marker key={cell.key}
      position={[cell.latitude, cell.longitude]} icon={icons[cell.role][cell.total - 1][cell.slot]}
      interactive={false} keyboard={false} />)}
  </MapContainer>;
}
