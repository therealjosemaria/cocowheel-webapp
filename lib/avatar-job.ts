export type AvatarJobStatus = "QUEUED" | "CHECKING" | "APPROVED" | "SUBMITTING" | "GENERATING" | "READY" | "REJECTED" | "FAILED" | "REVIEW_REQUIRED" | "CANCELLED" | "EXPIRED";
export type AvatarJob = { id: string; status: AvatarJobStatus; reason: string | null; reviewReason?: string | null; notificationKey: string | null; createdAt: string };
export type AvatarJobs = { accepting: boolean; job: AvatarJob | null };
export type AvatarHistoryItem = Omit<AvatarJob, "notificationKey"> & { thumbnailUrl: string | null };
export type AvatarHistory = { items: AvatarHistoryItem[]; total: number; page: number; pageSize: number };
export const avatarHistoryStatus: Record<AvatarJobStatus, string> = {
  QUEUED: "Waiting for photo check", CHECKING: "Checking photo", APPROVED: "Photo check passed",
  SUBMITTING: "Creating avatar", GENERATING: "Creating avatar", READY: "Avatar ready",
  REJECTED: "Photo rejected", CANCELLED: "Cancelled", EXPIRED: "Expired",
  FAILED: "Not completed", REVIEW_REQUIRED: "Waiting for avatar",
};
export const avatarJobActive = (status: AvatarJobStatus) => ["QUEUED", "CHECKING", "APPROVED", "SUBMITTING", "GENERATING", "REVIEW_REQUIRED"].includes(status);
export const AVATAR_PHOTO_REQUIREMENTS = "Use a clear photo of just you standing, with your head, hands and feet visible.";
export const AVATAR_PHOTO_ERROR = "Choose a JPG, PNG or WebP photo up to 10 MB, at least 256 pixels wide and 512 pixels tall.";
export const AVATAR_REVIEW_REASON_LIMIT = 400;
export const AVATAR_REVIEW_REASON_ERROR = "Add a reason of up to 400 characters so the user knows what to change.";
export function avatarReviewReason(value: unknown): string | null {
  if (typeof value !== "string" || Array.from(value).some(char => {
    const code = char.charCodeAt(0);
    return (code < 32 && ![9, 10, 13].includes(code)) || code === 127;
  })) return null;
  const reason = value.trim().replace(/\s+/g, " ");
  return reason.length > 0 && reason.length <= AVATAR_REVIEW_REASON_LIMIT ? reason : null;
}
export const avatarRejections: Record<string, string> = {
  NO_PERSON: "We couldn’t clearly identify your full body. Upload another photo with your head, hands and feet visible.",
  HEAD: "We couldn’t clearly identify your head. Upload another photo with your whole head visible.",
  HANDS: "We couldn’t clearly identify both hands. Upload another photo with your hands visible and away from your body.",
  FEET: "We couldn’t clearly identify both feet. Upload another full-body photo with your feet visible.",
  BODY: "We couldn’t clearly identify your full body. Upload another clear, front-facing photo.",
  STANDING: "We couldn’t confirm a standing pose. Upload another photo standing upright.",
  ONE_PERSON: "Use a photo of just you, facing the camera. Upload another photo.",
};
export function avatarJobMessage(job: AvatarJob) {
  switch (job.status) {
    case "QUEUED": case "CHECKING": return "Your photo is queued for checking. We’ll notify you with the results.";
    case "APPROVED": return "Your photo passed the check. Your avatar is waiting to be created.";
    case "SUBMITTING": case "GENERATING": return "Your photo passed the check. We’re creating your avatar.";
    case "READY": return "Your avatar is ready.";
    case "REJECTED": return job.reviewReason ? `Your photo wasn’t approved. ${job.reviewReason} Upload another photo.`
      : avatarRejections[job.reason ?? ""] ?? avatarRejections.BODY;
    case "CANCELLED": return "Avatar creation cancelled. You can upload another photo.";
    case "EXPIRED": return "Your photo expired before processing finished. Upload it again to queue a new check.";
    case "REVIEW_REQUIRED": return "Avatar creation needs our review. Your current avatar is unchanged. Contact us for help.";
    default: return "We couldn’t finish your avatar. Your current avatar is unchanged. You can upload another photo.";
  }
}
