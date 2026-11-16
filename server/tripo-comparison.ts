import { readFile } from "node:fs/promises";
import path from "node:path";
import { TRIPO_MODELS, TRIPO_IMAGE_MODELS, type Comparison } from "../lib/tripo-comparison";
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
  const extension = path.extname(name);
  const id = name.slice(0, -extension.length);
  if (!(TRIPO_MODELS.some(model => model.id === id) && [".glb", ".png"].includes(extension)) &&
      !(TRIPO_IMAGE_MODELS.some(model => model.id === id) && extension === ".png")) return null;
  return {
    path: path.join(comparisonDirectory(), name),
    type: extension === ".glb" ? "model/gltf-binary" : "image/png",
  };
}
