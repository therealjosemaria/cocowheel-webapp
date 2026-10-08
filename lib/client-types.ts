export type Pin = { latitude: number; longitude: number; label?: string };
export type RequestStatus =
  "PENDING" | "ACCEPTED" | "DECLINED" | "DISCARDED" | "CANCELLED";
export type RideStatus =
  | "PUBLISHED"
  | "REQUESTED"
  | "ACCEPTED"
  | "RIDE_ACTIVE"
  | "CO_RIDE_ACTIVE"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";
export type Location = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: string;
  stale: boolean;
};
export type Candidate = {
  rideId: string;
  driverAlias: string;
  priceAud: number;
  scheduledDepartureAt: string;
  directionFit: "GOOD" | "POOR";
  redactedCorridor: [Pin, Pin];
  pickupDistanceMeters: number;
  destinationDistanceMeters: number;
  isOwnOffer: boolean;
};
export type Ride = {
  rideId: string;
  status: RideStatus;
  driverAlias: string;
  priceAud: number;
  scheduledDepartureAt: string;
  request?: {
    requestId: string;
    status: RequestStatus;
    pickup: Pin;
    destination: Pin;
    requestedDepartureAt: string;
  };
  plannedRoute?: { origin: Pin; destination: Pin };
  rider?: {
    alias: string;
    pickup: Pin;
    destination: Pin;
    requestedDepartureAt: string;
    directionFit: "GOOD" | "POOR";
  };
  requests?: Array<{
    requestId: string;
    riderAlias: string;
    pickup: Pin;
    destination: Pin;
    requestedDepartureAt: string;
    directionFit: "GOOD" | "POOR";
    status: RequestStatus;
  }>;
  driverLocation?: Location;
  riderLocation?: Location;
  coRideCode?: string;
  payId?: string | null;
  paymentHandoffMethod?: "PAYID" | "CASH" | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
};
