import type { AvatarJobStatus } from "./avatar-job";

export type AdminAvatarNotice = { count: number; href: string; message: string };
export type AdminAvatarJob = {
  id: string; username: string; email: string; status: AvatarJobStatus;
  createdAt: string; updatedAt: string; approvedAt: string | null;
  reason: string | null; reviewReason: string | null; hold: string | null; taskId: string | null;
  photoUrl: string | null; renderUrl: string | null;
  notificationKey: string | null;
};
export type AdminAvatarJobs = {
  jobs: AdminAvatarJob[]; page: number; total: number;
  workerSeenAt: string | null; model: string; creditsPerAvatar: number;
};
export type AdminAvatarBalance = { availableCredits: number | null; frozenCredits: number | null; checkedAt: string | null };
// Same destination as the official API pricing page's Buy credits action.
export const TRIPO_TOP_UP_URL = "https://developers.tripo3d.ai/en/pricing?action=topup&from=pricing_hero";
export const adminAvatarStatus: Record<AvatarJobStatus, string> = {
  QUEUED: "Waiting for photo check", CHECKING: "Checking photo", APPROVED: "Photo verified",
  SUBMITTING: "Submitting generation", GENERATING: "Generating", READY: "Ready",
  REJECTED: "Photo rejected", FAILED: "Needs attention", REVIEW_REQUIRED: "Needs review",
  CANCELLED: "Cancelled", EXPIRED: "Expired",
};
export const adminAvatarIssues: Record<string, string> = {
  AWAITING_APPROVAL: "Waiting for your generation approval.",
  INSUFFICIENT_CREDITS: "Not enough Tripo credits. Top up the API balance; approved work will resume.",
  DAILY_LIMIT: "Daily generation limit reached. Approved work will resume when capacity is available.",
  GENERATION_PAUSED: "Generation is paused in server configuration. Review the daily credit limit.",
  PROVIDER_UNAVAILABLE: "Couldn’t check Tripo’s balance. The approved job will retry shortly.",
  UPLOAD_FAILED: "Couldn’t upload the photo to Tripo. The approved job will retry shortly.",
  SUBMISSION_REJECTED: "Tripo rejected the generation request. Check the API account and configuration before trying again.",
  SUBMISSION_UNCERTAIN: "Generation may have been submitted. Check Tripo’s task history before cancelling; do not submit a duplicate.",
  PROVIDER_REVIEW: "Generation hasn’t completed. Check this task in Tripo before cancelling.",
  PROVIDER_FAILED: "Tripo could not complete this task. Cancel it before requesting a new photo.",
  RESULT_UNAVAILABLE: "Couldn’t retrieve a usable avatar. This task will be checked again without generating another.",
  BACKGROUND_UNAVAILABLE: "Background removal is unavailable on the Pi. Check its local runtime and model; no generation has been submitted.",
  BACKGROUND_REVIEW: "Background removal needs review. Inspect the generated image, then cancel this creation if a new photo is needed.",
  CHECK_UNAVAILABLE: "Photo checking failed three times. Retry the photo check or cancel this submission.",
};
