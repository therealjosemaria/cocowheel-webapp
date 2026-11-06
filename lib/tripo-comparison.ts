export const TRIPO_MODELS = [
  { name: "H3.1", id: "v3.1-20260211", estimatedCredits: 30 },
  { name: "H3.0", id: "v3.0-20250812", estimatedCredits: null },
  { name: "H2.5", id: "v2.5-20250123", estimatedCredits: null },
  { name: "P2", id: "P2-20260801", estimatedCredits: 110 },
  { name: "P1", id: "P1-20260311", estimatedCredits: null },
] as const;
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
