// Web preparation only: retain the approved image composition and alpha channel.
// Usage: node scripts/prepare-journey-icons.mjs /path/to/approved-concept.png [light|dark]
import sharp from 'sharp';
const source = process.argv[2];
const surface = process.argv[3] ?? 'light';
if (!['light', 'dark'].includes(surface)) throw new Error('Choose a light or dark surface.');
if (!source) throw new Error('Provide the approved 1774 × 887 PNG as the first argument.');
const image = sharp(source);
const metadata = await image.metadata();
if (metadata.width !== 1774 || metadata.height !== 887 || !metadata.hasAlpha)
  throw new Error('Expected the approved transparent 1774 × 887 concept; do not substitute another composition.');
await image.resize(532, 266).webp({ quality: 90, alphaQuality: 100 })
  .toFile(`public/brand/journey-roles-3d-v1${surface === 'dark' ? '-on-dark' : ''}.webp`);
