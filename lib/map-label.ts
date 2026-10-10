import type { Pin } from "./client-types";

export const mapLocationText = (pin: Pin) =>
  pin.label?.split(",", 1)[0]?.trim() ||
  `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`;
