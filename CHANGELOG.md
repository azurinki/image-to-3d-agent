# Changelog

All notable changes to `image-to-3d-agent` are documented in this file.

## [3.0.0] - 2026-11-26

### Added
- **3-Track 100% Local Architecture (Zero Signup, Zero Cloud APIs):**
  - **Track A (`init` + `build model.mjs`):** Bundled `Manifold-3D` WASM parametric CAD engine outputting watertight `.3mf` (multi-color AMS), `.stl`, `.obj`, `.scad`, optional analytic `.step` (`--cad`), 4-view `preview.png`, and resumable `state.json`.
  - **Track B (`sculpt --mode relief|mask`):** Pure-JS PNG decoder + 2.5D bas-relief/lithophane generator (`--invert`) and uniform thin-shell curved wearable front mask sculpting (`innerFollow` hollowing + connected-component `minHolePixels` ink-line protection + tucked strap slots).
  - **Track C (`setup-gpu` + `generate` + `finish`):** One-command isolated Python 3.11/PyTorch GPU setup (`Hunyuan3D-2mini` shape-only DiT on Apple Silicon MPS / NVIDIA CUDA / CPU with automatic quadric decimation) piped straight into Manifold-3D wearable hollowing and flat-base finishing — plus standalone `finish` for any local `.glb`/`.stl`/`.obj`.
- **Visual Recognition & Realization Brain (`references/image-recognition-and-realization.md`):** 4-pass visual inspection protocol, 7-question self-check, smart questioning rule, 2D-vector → 3/4-clay-render → local GPU bridge, and "No Bumped-Egg" visual QA gate.
- **Deterministic Verifier & Multi-Harness Packaging:** Zero-dependency `node --test` end-to-end suite (`npm test`), `doctor` health check (`npm run doctor`), GitHub Actions CI across Ubuntu/macOS/Windows, native manifests for Claude Code, Antigravity (AGY), Cursor, and Codex, and portable `dist/image-to-3d.{zip,skill}` bundles.
