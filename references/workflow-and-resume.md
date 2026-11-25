# Visual Modeling Workflow, Session Resume & Optional `3d.azurinki.com` Handoff

## 1. Choosing the Right Local Strategy From a Reference Image

Inspect the reference image carefully (silhouette, angle, callout dimensions, organic vs. geometric detail) and choose the right track:

| Subject in Image | Recommended Track & Technique | Tips for Fidelity & Printability |
| :--- | :--- | :--- |
| **Packaging Die-Cuts, Boxes, Stands, Enclosures, Vases, Brackets** | **Track A — Manifold-3D CAD (`init` + `build model.mjs`)** using `filletBox`, `revolve`, `loft`, `tube`, `hull`, `subtract`, `mirrorPair` | Match exact millimeter callouts from the drawing (e.g. `80×120mm` sachet). Use `cad.subtract(...)` between touching color parts for clean multi-color `.3mf` slices. |
| **Wearable Front Face Plate (Flat-Front Oni / Kabuki)** | **Track B — Agent Depth-Map + `sculpt --mode mask`** (`cad.curvedMaskFromImage`) | Sleek thin-shell hollowing (`innerFollow: 0.82`). Use pure `#000000` inside eye holes only; keep recessed mouth gray so fangs stay solid. |
| **Medallions, Coins, Wall Plaques, Emblems, Lithophanes** | **Track B — `sculpt --mode relief`** (`cad.reliefFromImage`) | Use `--depth 4..6` for medallions, or `--invert --depth 2.4 --wall 0.8` for backlit lithophanes. |
| **Full 360° Organic Masks/Helmets, Characters, Busts, Sculpted Products** | **Track C — Local GPU `generate` (`Hunyuan3D-2mini`) → `finish`** | Run one-time `setup-gpu`, then `generate <image> --height 240 --wearable --wall 4.5 --entry bottom` (or `--flat-base` for solid display). Delivers true 3D inward cavities, overhangs, flaring ears, and 360° anatomy 100% offline on Mac MPS / NVIDIA CUDA! |
| **Existing Local `.glb` / `.stl` / `.obj` Meshes** | **Track C — `finish <mesh>`** (`cad.importMesh` + `cad.makeWearable` / `cad.flatBase`) | Auto-generates an editable `projects/<slug>/model.mjs` wrapper for exact sizing, hollowing, and strap loops (0 GPU needed). |

---

## 2. Visual Self-Critique Loop (`preview.png` vs Reference Image)

Every `build`, `sculpt`, and `finish` renders a 2×2 **ISO 3/4 · FRONT · RIGHT · BACK** preview sheet at `projects/<slug>/preview.png`.
Open `preview.png` and verify all 5 checks BEFORE declaring done:

1. **Silhouette Match (FRONT view):** Overall proportions, outer contour, horns/ears/crown, or die-cut shape match the reference image.
2. **True 3D Depth (RIGHT & ISO views):** Relief depth (`depthMm`) and curve wrap (`arcDeg`, `domeCurve`) feel genuinely 3D — not pancake-flat.
3. **Wearability Check (BACK view, for masks):** Smooth concave interior with zero poking nubs, flush strap slots, and clear eye/mouth holes (if meant to be worn with vision cutouts).
4. **Watertight Manifold:** JSON output confirms `"watertightAll": true` and non-zero volume.
5. **Printability:** Model rests cleanly on `Z = 0` with printable wall thickness (`>= 1.6mm` small parts, `>= 3.6mm` wearable masks).

---

## 3. Low-Token Session Resume Protocol

All tracks (`build`, `sculpt`, `finish`) auto-store projects under `projects/<slug>/` (`model.mjs`, `state.json`, `preview.png`, `out/`):

```bash
# List all saved projects
node <skill-dir>/scripts/cad-engine.mjs list

# Inspect one project's saved params, dimensions & history
node <skill-dir>/scripts/cad-engine.mjs resume <slug>

# Instant resize or relief tweak (<2s, zero re-designing!)
node <skill-dir>/scripts/cad-engine.mjs build projects/<slug>/model.mjs --param heightMm=240 --param depthMm=38 --note "Taller + deeper relief"
```

---

## 4. Optional Browser Tools (`https://3d.azurinki.com`)

Everything finishes 100% locally inside your IDE/CLI — browser tools are strictly optional if you want studio renders, STEP CAD conversion, or print cost estimates afterward:

| Optional Browser Step | URL | File to Drop |
| :--- | :--- | :--- |
| **3D Orbit, Materials & Photo Shoot** | `https://3d.azurinki.com/#/render-studio` | `out/<slug>.3mf` or `.stl` |
| **Convert STL → Editable STEP CAD** | `https://3d.azurinki.com/#/stl-to-step` | `out/<slug>.stl` |
| **Estimate Filament Weight & Cost** | `https://3d.azurinki.com/#/price-calculator` | `out/<slug>.stl` |
