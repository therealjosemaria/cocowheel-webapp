export const routeReference = (rideId: string) =>
  rideId.startsWith("COCO-") ? rideId.slice("COCO-".length) : rideId;
