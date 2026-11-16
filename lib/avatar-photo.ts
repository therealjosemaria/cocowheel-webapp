import { AVATAR_PHOTO_ERROR } from "./avatar-job";

/** Preserve the whole body; the square profile-photo crop is unsuitable here. */
export async function prepareAvatarPhoto(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024)
    throw new Error(AVATAR_PHOTO_ERROR);
  const image = await createImageBitmap(file).catch(() => { throw new Error(AVATAR_PHOTO_ERROR); });
  try {
    if (image.width < 256 || image.height < 512 || image.width * image.height > 32_000_000)
      throw new Error(AVATAR_PHOTO_ERROR);
    const scale = Math.min(1, 2048 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("We couldn’t prepare that photo. Choose another photo.");
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.92);
    if (data.length > 2_800_000) throw new Error("Choose a smaller photo and upload it again.");
    return data;
  } finally { image.close(); }
}
