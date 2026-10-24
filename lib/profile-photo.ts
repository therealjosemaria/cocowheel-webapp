import { PHOTO_ERROR } from "./personal-details";

export async function prepareBrowserPhoto(file: File): Promise<string> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error(PHOTO_ERROR);
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(PHOTO_ERROR);
  });
  try {
    if (bitmap.width * bitmap.height > 32_000_000)
      throw new Error("Choose a photo smaller than 32 megapixels.");
    const canvas = document.createElement("canvas");
    const side = Math.min(bitmap.width, bitmap.height);
    canvas.width = canvas.height = Math.min(512, side);
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("We couldn’t prepare that photo. Try another.");
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    // Preview is exactly the centred square that will be saved.
    const data = canvas.toDataURL("image/webp", 0.92);
    if (data.length > 700_000) throw new Error("Choose a smaller photo.");
    return data;
  } finally {
    bitmap.close();
  }
}
