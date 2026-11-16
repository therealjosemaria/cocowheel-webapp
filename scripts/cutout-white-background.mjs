// Offline sample preparation, not a general person-segmentation/upload pipeline.
// Remove only border-connected near-white pixels; retain every original RGB value.
import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export async function cutoutWhiteBackground(bytes) {
  if (bytes.length > 10_000_000) throw new Error("Image exceeds 10 MB; use a smaller saved PNG.");
  const image = sharp(bytes, { limitInputPixels: 16_000_000, failOn: "warning" });
  const metadata = await image.metadata();
  if (metadata.format !== "png" || (metadata.pages ?? 1) !== 1)
    throw new Error("Use a still PNG with a plain near-white background.");
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0, tail = 0;
  const visit = index => {
    if (visited[index]) return;
    const offset = index * 4;
    const lo = Math.min(data[offset], data[offset + 1], data[offset + 2]);
    const hi = Math.max(data[offset], data[offset + 1], data[offset + 2]);
    if (lo < 230 || hi - lo > 24) return;
    visited[index] = 1;
    queue[tail++] = index;
  };
  for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { visit(y * width); visit(y * width + width - 1); }
  while (head < tail) {
    const index = queue[head++], x = index % width, y = Math.floor(index / width);
    if (x > 0) visit(index - 1);
    if (x + 1 < width) visit(index + 1);
    if (y > 0) visit(index - width);
    if (y + 1 < height) visit(index + width);
  }
  if (tail < width * height * 0.1 || tail > width * height * 0.99)
    throw new Error("Cutout needs visual review: use a plain-background sample with a clearly visible subject.");
  for (let index = 0; index < visited.length; index++)
    if (visited[index]) data[index * 4 + 3] = 0;
  return {
    png: await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer(),
    width, height, removedPixels: tail,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [source, destination] = process.argv.slice(2);
  if (!source || !destination) throw new Error("Usage: node scripts/cutout-white-background.mjs SOURCE.png NEW-CUTOUT.png");
  const result = await cutoutWhiteBackground(await readFile(source));
  await writeFile(destination, result.png, { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ width: result.width, height: result.height, removedPixels: result.removedPixels,
    method: "Local border-connected near-white alpha mask; original RGB preserved; no API call" }));
}
