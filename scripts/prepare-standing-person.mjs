// Web preparation only: split the approved light/dark pair, trim empty margins,
// and preserve proportions and transparency. No repainting or pose changes.
// Usage: node scripts/prepare-standing-person.mjs /path/to/standing-pair.png
import sharp from 'sharp';

const source = process.argv[2];
if (!source) throw new Error('Provide the approved transparent standing-person pair.');
const metadata = await sharp(source).metadata();
if (metadata.width !== 1774 || metadata.height !== 887 || !metadata.hasAlpha)
  throw new Error('Expected the approved transparent 1774 × 887 standing pair.');
for (const [index, suffix] of ['', '-on-dark'].entries()) {
  const half = await sharp(source)
    .extract({ left: index * 887, top: 0, width: 887, height: 887 })
    .png().toBuffer();
  await sharp(half).trim({ threshold: 10 })
    .resize(128, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(`public/brand/journey-person-standing-v1${suffix}.webp`);
}
