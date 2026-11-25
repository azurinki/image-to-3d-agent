#!/usr/bin/env python3
"""
100% Local Zero-Signup GPU Image-to-3D Mesh Generator (Apple Silicon MPS / NVIDIA CUDA / CPU)
Powered by open-weight Tencent Hunyuan3D-2mini (shape-only DiT + VAE — ZERO custom CUDA compilers!).

Generates a true volumetric 360-degree 3D mesh (.glb) with real inward cavities, undercuts,
and protruding 3D geometry — then hands off directly to `scripts/cad-engine.mjs finish` for
exact-mm sizing, wearable hollowing, flat base, multi-color .3mf, .stl, .scad, and .step!
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

# Enable safe MPS fallback on Apple Silicon and disable flaky hf-xet chunk middleware
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")


def detect_device(requested: str) -> str:
    import torch
    if requested and requested != "auto":
        return requested
    if torch.cuda.is_available():
        return "cuda"
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def prepare_image(image_path: Path, keep_bg: bool):
    from PIL import Image
    import numpy as np

    img = Image.open(image_path).convert("RGBA")
    if keep_bg:
        return img

    # Check if image already has meaningful transparency
    alpha = np.array(img.getchannel("A"))
    if (alpha < 240).mean() > 0.05:
        return img

    # Try rembg first for clean subject cutout on busy photos
    try:
        from rembg import remove
        out = remove(img)
        if isinstance(out, Image.Image):
            return out.convert("RGBA")
    except Exception:
        pass

    # Fast pure-numpy corner-color flood-fill fallback (great for studio/solid backgrounds!)
    arr = np.array(img, dtype=np.float32)
    h, w, _ = arr.shape
    corners = np.array([arr[0, 0, :3], arr[0, w - 1, :3], arr[h - 1, 0, :3], arr[h - 1, w - 1, :3]])
    bg = corners.mean(axis=0)
    dist = np.linalg.norm(arr[:, :, :3] - bg, axis=2)
    cand = dist < 28.0

    from collections import deque
    visited = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        if cand[0, x]:
            visited[0, x] = True
            q.append((0, x))
        if cand[h - 1, x]:
            visited[h - 1, x] = True
            q.append((h - 1, x))
    for y in range(h):
        if cand[y, 0] and not visited[y, 0]:
            visited[y, 0] = True
            q.append((y, 0))
        if cand[y, w - 1] and not visited[y, w - 1]:
            visited[y, w - 1] = True
            q.append((y, w - 1))

    while q:
        cy, cx = q.popleft()
        for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and cand[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))

    out_arr = np.array(img)
    out_arr[visited, 3] = 0
    return Image.fromarray(out_arr, mode="RGBA")


def main():
    parser = argparse.ArgumentParser(description="100% Local GPU Image-to-3D Mesh Generator (Hunyuan3D-2mini)")
    parser.add_argument("image", help="Input reference image (.png, .jpg, .webp)")
    parser.add_argument("--out", "-o", required=True, help="Output .glb file path")
    parser.add_argument("--model", default="mini", choices=["mini", "turbo", "full"],
                        help="Model preset: mini (0.6B balanced, default), turbo (5-step fast), full (1.1B max detail)")
    parser.add_argument("--steps", type=int, default=0, help="Inference steps (default: 30 mini/full, 5 turbo)")
    parser.add_argument("--octree", type=int, default=320, help="Marching cubes octree resolution (256..384, default 320)")
    parser.add_argument("--target-faces", type=int, default=100000, help="Quadric decimation target face count (0 to disable, default 100000)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--device", default="auto", choices=["auto", "mps", "cuda", "cpu"], help="Compute device")
    parser.add_argument("--keep-bg", action="store_true", help="Skip background removal")
    args = parser.parse_args()

    img_path = Path(args.image).expanduser().resolve()
    if not img_path.exists():
        print(json.dumps({"ok": False, "error": f"Input image not found: {img_path}"}), file=sys.stderr)
        sys.exit(1)

    out_path = Path(args.out).expanduser().resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    t0 = time.time()
    import torch
    from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline

    device = detect_device(args.device)
    dtype = torch.float16 if device in ("cuda", "mps") else torch.float32

    if args.model == "turbo":
        repo_id = "tencent/Hunyuan3D-2mini"
        subfolder = "hunyuan3d-dit-v2-mini-turbo"
        steps = args.steps or 5
    elif args.model == "full":
        repo_id = "tencent/Hunyuan3D-2"
        subfolder = "hunyuan3d-dit-v2-0"
        steps = args.steps or 35
    else:
        repo_id = "tencent/Hunyuan3D-2mini"
        subfolder = "hunyuan3d-dit-v2-mini"
        steps = args.steps or 30

    print(f"[local-3d-gpu] Device={device} ({dtype}) | Model={repo_id}/{subfolder} | Steps={steps} | Octree={args.octree}", file=sys.stderr)

    image = prepare_image(img_path, args.keep_bg)

    # Download ONLY config.yaml + model.fp16.safetensors (~3.8GB instead of 7.6GB duplicate ckpts!)
    # with automatic resume/retry for transient Wi-Fi or CDN drops.
    from huggingface_hub import hf_hub_download
    def fetch_with_retry(filename: str, attempts: int = 5) -> str:
        last_err = None
        for n in range(1, attempts + 1):
            try:
                return hf_hub_download(repo_id=repo_id, filename=filename)
            except Exception as err:
                last_err = err
                print(f"[local-3d-gpu] Download retry {n}/{attempts} for {filename}: {err}", file=sys.stderr)
                time.sleep(3 * n)
        raise last_err

    config_path = fetch_with_retry(f"{subfolder}/config.yaml")
    ckpt_path = fetch_with_retry(f"{subfolder}/model.fp16.safetensors")

    pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_single_file(
        ckpt_path,
        config_path,
        device=device,
        dtype=dtype,
        use_safetensors=True,
    )
    if args.model == "turbo" and hasattr(pipeline, "enable_flashvdm"):
        try:
            pipeline.enable_flashvdm()
        except Exception:
            pass

    gen_device = "cpu" if device == "mps" else device
    generator = torch.Generator(device=gen_device).manual_seed(args.seed)

    with torch.no_grad():
        mesh = pipeline(
            image=image,
            num_inference_steps=steps,
            octree_resolution=args.octree,
            num_chunks=20000,
            generator=generator,
            output_type="trimesh",
        )[0]

    raw_faces = int(len(mesh.faces))
    final_verts = int(len(mesh.vertices))
    final_faces = raw_faces

    if args.target_faces > 0 and raw_faces > args.target_faces:
        raw_tmp = out_path.with_name(f".raw-{out_path.stem}.glb")
        mesh.export(str(raw_tmp))
        try:
            import pymeshlab
            import trimesh
            ms = pymeshlab.MeshSet()
            ms.load_new_mesh(str(raw_tmp))
            ms.meshing_decimation_quadric_edge_collapse(
                targetfacenum=args.target_faces,
                preservenormal=True,
                preserveboundary=True,
            )
            ms.save_current_mesh(str(out_path))
            dec = trimesh.load(str(out_path))
            final_verts = int(len(dec.vertices))
            final_faces = int(len(dec.faces))
        finally:
            if raw_tmp.exists():
                raw_tmp.unlink()
    else:
        mesh.export(str(out_path))

    elapsed = round(time.time() - t0, 1)

    result = {
        "ok": True,
        "mesh": str(out_path),
        "device": device,
        "model": f"{repo_id}/{subfolder}",
        "steps": steps,
        "octree": args.octree,
        "rawFaces": raw_faces,
        "vertices": final_verts,
        "faces": final_faces,
        "elapsedSec": elapsed,
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
