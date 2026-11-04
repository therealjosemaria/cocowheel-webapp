/** Crop generated 3x2 colour-state sheets into aligned transparent WebP icons.
 * Usage: node scripts/prepare-vehicle-catalogue.mjs /path/to/source-manifest.json
 * Source PNGs are retained; no paint recolouring or manufacturer artwork is used.
 */
import sharp from "sharp";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";

const manifest = JSON.parse(await readFile(process.argv[2], "utf8"));
const output = "public/brand/vehicles/v1";
await mkdir(output, { recursive: true });
for (const model of manifest.models) {
  if (!model.source) continue;
  if (!/^[a-z0-9-]+$/.test(model.id)) throw new Error("Invalid model id");
  const meta = await sharp(model.source).metadata();
  if (!meta.hasAlpha || !meta.width || !meta.height) throw new Error(`Missing alpha: ${model.id}`);
  const width = Math.floor(meta.width / 3), height = Math.floor(meta.height / 2);
  for (const [index, colour] of manifest.colours.entries()) {
    const cell = await sharp(model.source).extract({ left: (index % 3) * width, top: Math.floor(index / 3) * height, width, height }).png().toBuffer();
    // Ignore very faint generated shadows when measuring the visible body. A
    // small margin retains soft edges without letting halo size shrink one car.
    const { data, info } = await sharp(cell).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let left = width, top = height, right = -1, bottom = -1, largest = 0;
    // Use the largest connected opaque subject, ignoring stray faint grid marks.
    // This only finds a crop: the original pixels/alpha are never repainted.
    const seen = new Uint8Array(width * height), queue = new Int32Array(width * height);
    for (let start = 0; start < width * height; start++) {
      if (seen[start] || data[start * 4 + 3] < 224) continue;
      let head = 0, tail = 1, loX = width, loY = height, hiX = -1, hiY = -1;
      queue[0] = start; seen[start] = 1;
      while (head < tail) {
        const point = queue[head++], x = point % info.width, y = Math.floor(point / info.width);
        loX = Math.min(loX, x); hiX = Math.max(hiX, x); loY = Math.min(loY, y); hiY = Math.max(hiY, y);
        for (const next of [x > 0 ? point - 1 : -1, x + 1 < width ? point + 1 : -1, y > 0 ? point - width : -1, y + 1 < height ? point + width : -1]) {
          if (next < 0 || seen[next] || data[next * 4 + 3] < 224) continue;
          seen[next] = 1; queue[tail++] = next;
        }
      }
      if (tail > largest) { largest = tail; left = loX; right = hiX; top = loY; bottom = hiY; }
    }
    if (right < left) throw new Error(`Empty colour state: ${model.id}/${colour}`);
    const margin = Math.ceil(width * 0.015);
    left = Math.max(0, left - margin); top = Math.max(0, top - margin);
    right = Math.min(width - 1, right + margin); bottom = Math.min(height - 1, bottom + margin);
    await sharp(cell).extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
      .resize(384, 288, { fit: "contain", background: "#00000000" })
      .webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(output, `${model.id}-${colour.toLowerCase()}.webp`));
  }
  console.log(`Prepared ${model.id}: six 384x288 WebP icons`);
}
