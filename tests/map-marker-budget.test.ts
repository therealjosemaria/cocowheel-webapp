import assert from "node:assert/strict";
import test from "node:test";
import { MAP_MARKER_POLICY, mapFrameBudgetExceeded, mapImageDetail, visibleMapMarkers } from "../lib/map-marker-budget";
import { mapAvatarImagePath } from "../lib/map-avatar";

test("overview hides at broad zoom, culls offscreen/overlap and bounds thousands by a stable budget", () => {
  const markers = Array.from({ length: 10_000 }, (_, i) => ({ key: `marker-${i}`, x: (i % 100) * 48, y: Math.floor(i / 100) * 48 }));
  const selected = visibleMapMarkers(markers, 1200, 800, 12);
  assert.equal(selected.length, 50);
  assert.deepEqual(visibleMapMarkers(markers.slice().reverse(), 1200, 800, 12), selected);
  assert.equal(visibleMapMarkers(markers, 1200, 800, 7.99).length, 0);
  assert.equal(visibleMapMarkers(markers, 1200, 800, 8).length, 50);
  assert.equal(visibleMapMarkers(markers, 1200, 800, 15, true).length, 25);
  assert.ok(visibleMapMarkers(markers, 390, 200, 12).length <= 19);
  assert.deepEqual(visibleMapMarkers(markers, 0, 200, 12), []);
  const dense = visibleMapMarkers([{ key: "a", x: 100, y: 100 }, { key: "b", x: 101, y: 101 }, { key: "off", x: -100, y: 100 }, { key: "invalid", x: NaN, y: 100 }], 300, 200, 12);
  assert.equal(dense.length, 1);
  for (let i = 0; i < selected.length; i++) for (let j = i + 1; j < selected.length; j++)
    assert.ok(Math.hypot(selected[i].x - selected[j].x, selected[i].y - selected[j].y) >= MAP_MARKER_POLICY.gap);
});

test("map image tiers use explicit zoom, never accept injected paths or expose private previews", () => {
  assert.equal(mapImageDetail(11.99), "light"); assert.equal(mapImageDetail(12), "detail");
  assert.equal(mapImageDetail(18, true), "light");
  const path = `/api/map-avatar/${"a".repeat(32)}.webp`;
  assert.equal(mapAvatarImagePath(path, "light"), path);
  assert.equal(mapAvatarImagePath(path, "detail"), path.replace(".webp", ".detail.webp"));
  for (const path of ["/api/avatar/preview", "https://evil.invalid/a.webp", '/api/map-avatar/<img>.webp', `/api/map-avatar/${"a".repeat(32)}.webp?x=1`]) assert.equal(mapAvatarImagePath(path, "detail"), undefined);
});


test("slow rendering degrades only after three consecutive interaction stalls", () => {
  let last = 0, slow = 0;
  for (const [time, expected] of [[100,false],[160,false],[220,false],[280,true]] as const) {
    const value = mapFrameBudgetExceeded(last, time, slow); last = time; slow = value.slow;
    assert.equal(value.exceeded, expected);
  }
  assert.deepEqual(mapFrameBudgetExceeded(280, 296, slow), { slow: 0, exceeded: false });
  assert.deepEqual(mapFrameBudgetExceeded(0, 10000, 0), { slow: 0, exceeded: false });
});
