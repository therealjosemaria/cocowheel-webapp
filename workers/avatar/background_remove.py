"""Local U²-Net human segmentation: bounded image stdin -> transparent PNG stdout.

No network, downloads, provider credentials, photo persistence or generation.
Preprocessing follows rembg's human-segmentation session and upstream U²-Net.
"""
import argparse
import hashlib
import io
import resource
import sys
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image
from scipy.ndimage import binary_erosion
from pymatting import estimate_alpha_cf, estimate_foreground_ml
from pymatting.preconditioner.ichol import ichol

MODEL_SHA256 = "01eb6a29a5c4d8edb30b56adad9bb3a2a0535338e480724a213e0acfd2d1c73c"
Image.MAX_IMAGE_PIXELS = 16_000_000


def remove_background(data, model_path):
    if len(data) > 10_000_000:
        raise ValueError("image too large")
    image = Image.open(io.BytesIO(data))
    if image.format not in ("PNG", "JPEG", "WEBP") or getattr(image, "n_frames", 1) != 1:
        raise ValueError("unsupported image")
    if image.width * image.height > 16_000_000:
        raise ValueError("too many pixels")
    image = image.convert("RGB")
    image.thumbnail((1024, 1536), Image.Resampling.LANCZOS)
    with Path(model_path).open("rb") as model_file:
        digest = hashlib.file_digest(model_file, "sha256").hexdigest()
    if digest != MODEL_SHA256:
        raise ValueError("model checksum mismatch")
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    options.inter_op_num_threads = 1
    options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    options.enable_cpu_mem_arena = False
    options.enable_mem_pattern = False
    options.add_session_config_entry("session.intra_op.allow_spinning", "0")
    session = ort.InferenceSession(str(model_path), sess_options=options, providers=["CPUExecutionProvider"])
    pixels = np.asarray(image.resize((320, 320), Image.Resampling.LANCZOS), dtype=np.float32)
    pixels /= max(float(pixels.max()), 1.0)
    pixels = (pixels - np.array([0.485, 0.456, 0.406], dtype=np.float32)) / np.array([0.229, 0.224, 0.225], dtype=np.float32)
    tensor = np.transpose(pixels, (2, 0, 1))[None].astype(np.float32)
    prediction = session.run(None, {session.get_inputs()[0].name: tensor})[0][0, 0]
    low, high = float(prediction.min()), float(prediction.max())
    if high - low < 0.1:
        raise ValueError("uncertain foreground")
    prediction = (prediction - low) / (high - low)
    mask = Image.fromarray((prediction * 255).astype(np.uint8)).resize(image.size, Image.Resampling.LANCZOS)
    confidence = np.asarray(mask, dtype=np.float64) / 255.0
    foreground = binary_erosion(confidence >= 0.98, iterations=2)
    background = binary_erosion(confidence <= 0.02, iterations=2, border_value=1)
    if not foreground.any() or not background.any():
        raise ValueError("uncertain trimap")
    trimap = np.full(confidence.shape, 0.5)
    trimap[foreground] = 1.0
    trimap[background] = 0.0
    original = np.asarray(image, dtype=np.float64) / 255.0
    # PyMatting's default factor allocation is too large for an always-on Pi.
    def bounded_factor(matrix):
        return ichol(matrix, max_nnz=min(8_000_000, max(100_000, matrix.nnz * 4)))
    matte = estimate_alpha_cf(original, trimap, preconditioner=bounded_factor, cg_kwargs={"maxiter": 1000, "rtol": 1e-5})
    colours = estimate_foreground_ml(original, matte)
    rgb = np.asarray(image).copy()
    edge = (matte > 0.0) & (matte < 0.98)
    # Edge colour decontamination removes the old background's halo. Confident
    # foreground pixels (including the interior face) retain their original RGB.
    rgb[edge] = np.clip(colours[edge] * 255.0, 0, 255).astype(np.uint8)
    alpha = np.clip(matte * 255.0, 0, 255).astype(np.uint8)
    alpha[alpha <= 3] = 0
    alpha[alpha >= 250] = 255
    coverage = float(np.mean(alpha >= 128))
    bounds = Image.fromarray(alpha).getbbox()
    if not bounds or not 0.01 < coverage < 0.9 or bounds[3] - bounds[1] < image.height * 0.3:
        raise ValueError("foreground needs review")
    image = Image.fromarray(rgb)
    image.putalpha(Image.fromarray(alpha))
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    resource.setrlimit(resource.RLIMIT_AS, (3 * 1024**3, 3 * 1024**3))
    resource.setrlimit(resource.RLIMIT_CPU, (120, 120))
    try:
        if args.check:
            with Path(args.model).open("rb") as model_file:
                if hashlib.file_digest(model_file, "sha256").hexdigest() != MODEL_SHA256:
                    raise ValueError("model checksum mismatch")
            print("READY", end="")
            sys.exit(0)
        started = time.monotonic()
        result = remove_background(sys.stdin.buffer.read(10_000_001), args.model)
        if len(result) > 10_000_000:
            raise ValueError("output too large")
        sys.stdout.buffer.write(result)
        print(f"elapsed_seconds={time.monotonic()-started:.3f} peak_rss_kib={resource.getrusage(resource.RUSAGE_SELF).ru_maxrss}", file=sys.stderr)
    except Exception:
        # Operational detail stays in the admin queue; never print photos or paths.
        print("BACKGROUND_REMOVAL_REVIEW", file=sys.stderr)
        sys.exit(1)
