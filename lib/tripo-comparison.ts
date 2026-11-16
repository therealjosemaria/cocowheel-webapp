export const TRIPO_MODELS = [
  { name: "H3.1", id: "v3.1-20260211", estimatedCredits: 30 },
  { name: "H3.0", id: "v3.0-20250812", estimatedCredits: 30 },
  { name: "H2.5", id: "v2.5-20250123", estimatedCredits: 30 },
  { name: "P2", id: "P2-20260801", estimatedCredits: 110 },
  { name: "P1", id: "P1-20260311", estimatedCredits: 50 },
] as const;
export const TRIPO_IMAGE_MODELS = [
  { name: "Sunburst", id: "chat_image_2.5_sunburst", estimatedCredits: 10 },
  { name: "Seedream v5", id: "seedream_v5", estimatedCredits: 5 },
] as const;
export const AVATAR_IMAGE_PROMPT = "Use the person in the reference photo to create a polished, full-body 3D-looking avatar image for a map. Preserve his facial identity, face shape, hairstyle, skin tone, black suit, white shirt, white tie and black shoes. Keep realistic adult proportions with subtle stylisation and convincing soft shading, like a high-quality 3D character render. He is standing still, waiting, facing the camera at a slight three-quarter angle, with both hands relaxed and visible. Show his entire head and both feet with a small clear margin; do not crop any part of his body. Portrait 2:3 composition. Isolate the single person on a transparent background, with no room, floor, scenery, text, border or checkerboard pattern. Do not add accessories or change his outfit.";
export function comparisonImagePayload(input: string, model: string) {
  if (!TRIPO_IMAGE_MODELS.some(item => item.id === model)) throw new Error("Unknown image model");
  return { input, model, prompt: AVATAR_IMAGE_PROMPT, output_format: "png",
    ...(model === "chat_image_2.5_sunburst" ? { size: "1024x1536", quality: "medium", background: "transparent" } : { size: "2K" }) };
}
export type ComparisonRow = {
  name: string;
  id: string;
  status: string;
  taskId?: string;
  submittedAt?: number;
  elapsedSeconds?: number;
  estimatedCredits: number | null;
  chargedCredits?: number;
  modelReady?: boolean;
  previewReady?: boolean;
  kind?: "image";
  width?: number;
  height?: number;
  transparent?: boolean;
};
export type Comparison = { referenceHash: string; rows: ComparisonRow[] };
export function comparisonPayload(input: string, model: string) {
  if (!TRIPO_MODELS.some((item) => item.id === model))
    throw new Error("Unknown model");
  // Common supported settings only. H2.5 does not accept texture_quality.
  return {
    input,
    model,
    texture: true,
    pbr: true,
    model_seed: 42,
    texture_seed: 42,
    enable_image_autofix: false,
  };
}
