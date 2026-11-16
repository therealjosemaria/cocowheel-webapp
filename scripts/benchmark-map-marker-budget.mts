// Synthetic screen positions only. No network, photos, sessions, GPS or live trip load.
import assert from "node:assert/strict";
import { visibleMapMarkers } from "../lib/map-marker-budget";
const output = [];
for (const population of [1000, 10000]) {
  const markers = Array.from({ length: population }, (_, i) => ({ key: `synthetic-${i}`, x: ((i * 73) % 3000) - 800, y: ((i * 47) % 2000) - 500 }));
  for (const width of [390, 1440]) {
    const times = [];
    let count = 0;
    for (let iteration = 0; iteration < 120; iteration++) {
      const start = performance.now();
      const result = visibleMapMarkers(markers, width, 200, 12);
      times.push(performance.now() - start); count = result.length;
      assert.ok(count <= 50);
    }
    times.sort((a,b) => a-b);
    output.push({ population, viewport: [width,200], repetitions: times.length, visible: count, p95Ms: Number(times[Math.floor(times.length * .95)].toFixed(3)), maxMs: Number(times.at(-1)!.toFixed(3)) });
  }
}
console.log(JSON.stringify({ kind: "selector-only", results: output }, null, 2));
