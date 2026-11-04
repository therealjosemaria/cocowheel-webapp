/** Review all shipped colour states, not only the first model's concept. */
import sharp from "sharp";
import { readFile, mkdir } from "node:fs/promises";

const manifest = JSON.parse(await readFile("docs/assets/vehicle-catalogue-sources.json", "utf8"));
const width = 1152, rowHeight = 164, header = 30;
const height = header + manifest.models.length * rowHeight;
const layers = [];
const label = (text, w, h) => Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><text x="12" y="20" font-family="Arial,sans-serif" font-size="14" fill="#111827">${text}</text></svg>`);
for (const [column, colour] of manifest.colours.entries()) {
  layers.push({ input: label(colour, 192, header), left: column * 192, top: 0 });
}
for (const [row, model] of manifest.models.entries()) {
  const top = header + row * rowHeight;
  layers.push({ input: label(`${row + 1}. ${model.make} ${model.model} (${model.yearFrom === model.yearTo ? model.yearFrom : `${model.yearFrom}–${model.yearTo}`})`, width, 30), left: 0, top });
  for (const [column, colour] of manifest.colours.entries()) {
    const input = await sharp(`public/brand/vehicles/v1/${model.id}-${colour.toLowerCase()}.webp`).resize(184, 132, { fit: "contain", background: "#00000000" }).toBuffer();
    layers.push({ input, left: column * 192 + 4, top: top + 28 });
  }
}
await mkdir("docs/assets", { recursive: true });
await sharp({ create: { width, height, channels: 4, background: "white" } }).composite(layers)
  .webp({ quality: 90 }).toFile("docs/assets/vehicle-catalogue-v1.webp");
for (let group = 0; group < 4; group++) {
  await sharp("docs/assets/vehicle-catalogue-v1.webp").extract({ left: 0, top: header + group * rowHeight * 5, width, height: rowHeight * 5 })
    .png().toFile(`/tmp/vehicle-catalogue-review-${group + 1}.png`);
}
console.log("Contact sheet: docs/assets/vehicle-catalogue-v1.webp; four full-size review groups in /tmp");
