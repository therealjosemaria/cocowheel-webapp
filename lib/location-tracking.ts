export type Fix = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
};

export function distanceMeters(a: Fix, b: Fix) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

// Two reliable displaced readings start moving mode; three quiet readings end it.
export function movementTracker() {
  let anchor: Fix | undefined;
  let moving = false;
  let displaced = 0;
  let quiet = 0;
  return (fix: Fix) => {
    if (!anchor) {
      anchor = fix;
      return moving;
    }
    const shifted =
      distanceMeters(anchor, fix) >
      Math.max(30, anchor.accuracyMeters + fix.accuracyMeters);
    if (shifted) {
      displaced++;
      quiet = 0;
      if (displaced >= 2) {
        moving = true;
        anchor = fix;
        displaced = 0;
      }
    } else {
      displaced = 0;
      quiet++;
      if (quiet >= 3) {
        moving = false;
        anchor = fix;
      }
    }
    return moving;
  };
}
