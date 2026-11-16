export type AvatarJobStatus = "QUEUED" | "CHECKING" | "APPROVED" | "SUBMITTING" | "GENERATING" | "READY" | "REJECTED" | "FAILED" | "REVIEW_REQUIRED" | "CANCELLED" | "EXPIRED";
export type AvatarJob = { id: string; status: AvatarJobStatus; reason: string | null; notificationKey: string | null; createdAt: string };
export type AvatarJobs = { accepting: boolean; job: AvatarJob | null };
export const avatarJobActive = (status: AvatarJobStatus) => ["QUEUED", "CHECKING", "APPROVED", "SUBMITTING", "GENERATING", "REVIEW_REQUIRED"].includes(status);
export const avatarJobCancellable = (status: AvatarJobStatus) => ["QUEUED", "CHECKING", "APPROVED"].includes(status);
export const AVATAR_PHOTO_REQUIREMENTS = "Use a clear photo of just you standing, with your head, hands and feet visible.";
export const AVATAR_PHOTO_ERROR = "Choose a JPG, PNG or WebP photo up to 10 MB, at least 256 pixels wide and 512 pixels tall.";
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
    case "APPROVED": return "Your photo passed the check. Avatar creation is queued.";
    case "SUBMITTING": case "GENERATING": return "Your photo passed the check. We’re creating your avatar.";
    case "READY": return "Your avatar is ready.";
    case "REJECTED": return avatarRejections[job.reason ?? ""] ?? avatarRejections.BODY;
    case "CANCELLED": return "Photo check cancelled. You can upload another photo.";
    case "EXPIRED": return "Your photo expired before processing finished. Upload it again to queue a new check.";
    case "REVIEW_REQUIRED": return "Avatar creation needs our review. Your current avatar is unchanged. Contact us for help.";
    default: return "We couldn’t finish your avatar. Your current avatar is unchanged. You can upload another photo.";
  }
}
