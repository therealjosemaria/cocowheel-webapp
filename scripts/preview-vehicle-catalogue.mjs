/** Review all shipped colour states, not only the first model's concept. */
import sharp from "sharp";
import { readFile, mkdir } from "node:fs/promises";

const manifest = JSON.parse(await readFile("docs/assets/vehicle-catalogue-sources.json", "utf8"));
const width = 1152, rowHeight = 164, header = 30;
// WebP is limited to 16,383 pixels per dimension; split large catalogues.
const rowsPerPage = 80;
const label = (text, w, h) => Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><text x="12" y="20" font-family="Arial,sans-serif" font-size="14" fill="#111827">${text}</text></svg>`);
await mkdir("docs/assets", { recursive: true });
const pages = Math.ceil(manifest.models.length / rowsPerPage);
for (let page = 0; page < pages; page++) {
  const models = manifest.models.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  const layers = [];
  for (const [column, colour] of manifest.colours.entries()) {
    layers.push({ input: label(colour, 192, header), left: column * 192, top: 0 });
  }
  for (const [row, model] of models.entries()) {
    const top = header + row * rowHeight;
    layers.push({ input: label(`${page * rowsPerPage + row + 1}. ${model.make} ${model.model} (${model.yearFrom === model.yearTo ? model.yearFrom : `${model.yearFrom}–${model.yearTo}`})`, width, 30), left: 0, top });
    for (const [column, colour] of manifest.colours.entries()) {
      const input = await sharp(`public/brand/vehicles/v1/${model.id}-${colour.toLowerCase()}.webp`).resize(184, 132, { fit: "contain", background: "#00000000" }).toBuffer();
      layers.push({ input, left: column * 192 + 4, top: top + 28 });
    }
  }
  const output = `docs/assets/vehicle-catalogue-v1${page ? `-part-${page + 1}` : ""}.webp`;
  await sharp({ create: { width, height: header + models.length * rowHeight, channels: 4, background: "white" } }).composite(layers)
    .webp({ quality: 90 }).toFile(output);
  for (let group = 0; group < Math.ceil(models.length / 5); group++) {
    const rows = Math.min(5, models.length - group * 5);
    await sharp(output).extract({ left: 0, top: header + group * rowHeight * 5, width, height: rowHeight * rows })
      .png().toFile(`/tmp/vehicle-catalogue-review-${page * rowsPerPage / 5 + group + 1}.png`);
  }
}
console.log(`Contact sheets: ${pages}; ${Math.ceil(manifest.models.length / 5)} full-size review groups in /tmp`);
