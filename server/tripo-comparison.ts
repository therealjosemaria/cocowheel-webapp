import { readFile } from "node:fs/promises";
import path from "node:path";
import { TRIPO_MODELS, type Comparison } from "../lib/tripo-comparison";
export const comparisonDirectory = () =>
  process.env.TRIPO_COMPARISON_DIR ||
  path.join(process.cwd(), "data", "tripo-comparison");
// Called only inside the existing server-side admin authorization boundary.
export async function readComparison() {
  try {
    return JSON.parse(
      await readFile(
        path.join(comparisonDirectory(), "comparison.json"),
        "utf8",
      ),
    ) as Comparison;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
export function comparisonAsset(name: string) {
  if (name === "reference.png")
    return { path: path.join(comparisonDirectory(), name), type: "image/png" };
  const match =
    /^(v3\.1-20260211|v3\.0-20250812|v2\.5-20250123|P2-20260801|P1-20260311)\.(glb|png)$/.exec(
      name,
    );
  if (!match || !TRIPO_MODELS.some((m) => m.id === match[1])) return null;
  return {
    path: path.join(comparisonDirectory(), name),
    type: match[2] === "glb" ? "model/gltf-binary" : "image/png",
  };
}
