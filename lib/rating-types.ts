export type RatingRole = "DRIVER" | "RIDER";
/** Null hides both score and count below the public threshold. */
export type RatingSummary = { average: number; count: number } | null;
export type RideRatingState = {
  canRate: boolean;
  submitted: boolean;
  targetRole: RatingRole;
  closesAt: string;
};
