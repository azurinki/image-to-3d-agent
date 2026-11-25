# Image Recognition, Realization & Questioning Protocol

Read this guide **before** writing `model.mjs` or generating a depth map whenever the user provides a reference image. It teaches you **where to look**, **how to systematically recognize and deconstruct the subject**, **when to ask clarifying questions vs. act immediately**, and **how to materialize the 2D image into high-fidelity, print-ready 3D geometry**.

---

## 1. Systematic Image Reading (4-Pass Visual Inspection)

Never jump straight from a glance at the image to code. Inspect the image in 4 structured passes:

### Pass 1 — Identify What the Subject Physically Is
Classify the subject into its primary real-world 3D archetype:
1. **Packaging / Technical Die-Cut:** sachets, pouches, cartons, trays, blister packs, folding boxes, labels with dimension lines.
2. **Functional / Mechanical / Enclosure:** stands, mounts, brackets, cases, cable organizers, docks, keycaps, tool holders, hinges.
3. **Rotational / Vessel / Turned Form:** bottles, cups, vases, planters, lamp shades, bowls, knobs, chess pieces, spinning tops.
4. **Wearable Mask / Armor / Faceplate:** Oni masks, Khmer Khol / Hanuman masks, cosplay masks, visors, shoulder pauldrons, shin guards.
5. **Relief / Medallion / Sign / Lithophane:** coins, crests, seals, emblems, logos, carved wall plaques, nameplates, backlit photo lithophanes.
6. **Architectural / Furniture / Modular Prop:** miniature buildings, frames, trays, multi-part geometric sculptures, interlocking stands.
7. **Full-360° Organic Character / Creature:** figurines, busts, animals, toys, statues seen from one angle.

### Pass 2 — Read Camera Angle, Lighting & Style
Recognize *how* the image was captured so you don't bake 2D artifacts into 3D geometry:
- **Flat 2D Blueprint / Die-Cut / Technical Drawing:** Trust orthographic outlines and printed millimeter/cm callouts directly → **Track A**.
- **3/4 or Perspective 3D Photo / Product Render:** Feed **directly** into **Track C (`generate` on Local GPU `Hunyuan3D-2mini`)** — neural 3D thrives on 3/4 studio shots and reconstructs true inward cavities, flaring ears, snouts, and 360° backs!
- **Flat 2D Vector Illustration / Cartoon / Sketch:**
  - **CRITICAL TRAP:** Never feed flat 2D vector art raw into `generate` (`Hunyuan3D-2mini`), or it will interpret the drawing as a paper-thin flat sticker (`~10mm` thick)!
  - **If the user wants true volumetric 3D (Track C)** and your agent has image-gen: **FIRST convert the 2D vector into a 3/4-angle photorealistic matte-clay 3D studio render** on a clean solid dark background (explicitly showing curved 3D volume, protruding horns/nose/fangs, deep sculpted eye/mouth cavities, and thick sculptural rim), **THEN** run `generate` on that 3/4 clay render!
  - **If using Track B (`sculpt --mode mask` / `relief`)**: convert thick black cartoon outlines into a smooth continuous grayscale depth map so ink strokes become sculpted bevels, not trenches.
- **Harsh Cast Shadows / Specular Highlights:** Separate **form (3D geometry)** from **paint/glare (albedo)**.

### Pass 3 — Extract Dimensions, Proportions & Scale Anchors
Resolve real-world millimeter dimensions in this strict priority order:
1. **Explicit callouts on the image** (e.g. `80mm`, `120mm`, `R5`, `15°`) → obey to the exact millimeter.
2. **Dimensions stated by the user** (e.g. `"220mm tall"`, `"fits iPhone 16 Pro"`) → obey exactly.
3. **Known physical / ergonomic anchors** when unstated (state your assumption in 1 line so the user can tweak in `<2s`):
   - Adult wearable full-face mask: `height 215–225mm`, `width 165–185mm`, `wall 4.0–4.4mm`, `arcDeg 130–145°`
   - Adult half-face / jaw mask: `height 115–135mm`, `width 155–175mm`, `wall 3.8–4.2mm`
   - Medallion / wall emblem / coaster: `diameter/height 90–120mm`, `depth 4–6mm`, `base 2.4–3.0mm`
   - Keychain / badge / charm: `height 45–60mm`, `depth 2.5–3.5mm`, `base 2.0mm` + `4mm` keyring hole
   - Backlit lithophane: `height 120–150mm`, `depth 2.4mm`, `wall 0.8mm`, `--invert`
   - Desk phone stand: `width 75–85mm`, `wall 3.5–4.5mm`, `tilt 60–68°`
   - Packaging sachet / pouch: match exact aspect ratio of the visible die-cut (typical stick/sachet `50–80mm × 110–140mm`)

### Pass 4 — Deconstruct Into 3D Structural Anatomy
Break what you see into 5 physical layers before choosing code or sculpting:
1. **Macro Silhouette & Symmetry:** Outer contour + symmetry type (`bilateral X-mirror`, `N-fold radial`, or `asymmetric`).
2. **Primary Volume (What Exists Behind the 2D View):**
   - Is it **solid**, **hollow shell**, **curved wrap**, **360° revolved**, or **pillow-lofted front+back**?
   - What does the **unseen back / underside** look like? (Wearable mask = smooth concave face cavity; stand/figurine = flat `Z = 0` bed contact; sachet = mirrored back face + heat-sealed flat crimp border.)
3. **Secondary Features & Cutouts (Negative Space):** Eye/mouth openings, finger notches, strap slots, cable pass-throughs, hanging holes, snap grooves, recessed trays.
4. **Tertiary Surface Details:** Raised filigree, flutes, ribs, horns, fangs, bevels/fillets, embossed text/logos.
5. **Color / Part Separation (Multi-Color `.3mf`):** Which regions are distinct colored parts (e.g. body vs cap vs embossed logo) that should be returned as separate non-overlapping `cad.part(name, solid, hex)` entries?

---

## 2. The 7-Question Realization Self-Check (Run Internally Before Building)

Before writing a single line of `model.mjs` or a depth prompt, answer these 7 questions internally (and optionally summarize them in 3–4 crisp bullets in your reply):

1. **What is this object in the real world?** *(Specific name + category from Pass 1)*
2. **What is its physical end-use?** *(Wearable? Desk display? Wall-hung? Functional holder? Packaging mockup? Backlit lithophane?)*
3. **What is its true 3D volume behind the visible camera view?** *(Flat-back relief, curved hollow mask, 360° revolved vessel, pillow-lofted pouch, or multi-part CAD assembly?)*
4. **What are its real-world mm dimensions & symmetry?** *(Exact callouts vs ergonomic defaults)*
5. **What visual traps exist in this image?** *(3/4 perspective tilt? Black cartoon outlines? Painted dark patterns vs real holes? Specular glare?)*
6. **Which Track + exact geometric recipe materializes it best?** *(Track A exact CAD primitives vs Track B agent depth-map sculpt vs Track C mesh wrap)*
7. **Is anything genuinely ambiguous enough to ask the user first?** *(Apply Section 3 below!)*

---

## 3. Smart Questioning Protocol (Ask vs. Act Immediately)

Balance **zero friction** with **high accuracy**:

### Case A — Clear Intent (Act Immediately, Do NOT Interrogate)
When the image + prompt clearly indicate the physical form (e.g., *"turn this into a wearable Oni mask"*, *"make this 80x120mm sachet in 3D"*, *"turn this photo into a lithophane"*, *"make a desk stand like this"*):
- **Build v1 immediately** using the best Track and Pass 3 ergonomic defaults.
- In your delivery message, briefly state your **Realization Assumptions** (e.g. *"`225mm` adult wearable height, curved `135°` hollow shell, `4.2mm` wall, cut-through eye holes + flush strap slots"*) and offer **2–3 specific 1-sentence enhancements** the user can ask for next (rebuilds in `<2s`).

### Case B — Truly Ambiguous Prompt (Ask 2–3 Ultra-Short Questions FIRST)
ONLY pause to ask when the user gives a vague prompt (*"make this 3D"*, *"turn this into an STL"*) AND the image could reasonably be materialized as **2+ completely different physical objects** (for example: a logo/crest could be a flat keychain, a thick wall sign, a stamp, or a cookie cutter; a character face could be a wearable mask, a flat wall relief, or a fridge magnet; an unlabelled box sketch has unknown dimensions or open/closed lid):

Ask **at most 3 crisp, numbered multiple-choice questions** (always highlighting your recommended default):
1. **What physical 3D object do you want?** *(e.g., A. Wearable hollow mask [Recommended] / B. Flat wall relief plaque / C. Keychain charm)*
2. **Target size?** *(e.g., `220mm` adult wearable [Recommended], `120mm` display, or custom mm)*
3. **Functional details?** *(e.g., cut-through eye holes + strap loops / hanging hole / solid back / multi-color `.3mf` parts)*

> **Rule:** Never ask more than 3 questions, and never ask about technical flags (`arcDeg`, `gamma`, `manifold`) — translate user answers into parameters yourself!

---

## 4. Materialization Playbook (Visual Cue → Exact 3D Technique)

| What You Recognized in the Image | Exact Materialization Strategy | Key Engineering Rules |
| :--- | :--- | :--- |
| **Packaging die-cut / pouch / sachet** | **Track A (`model.mjs`)**: `loft` rounded cross-sections for filled pillow body + flat `filletBox` heat-seal crimp borders + `subtract` tear notch + separate `cad.part()` layers for multi-color AMS branding. | Match printed mm callouts 1:1. Subtract overlapping color zones (`cad.subtract`) so slicers never see z-fighting. |
| **Box / stand / mount / enclosure / bracket** | **Track A (`model.mjs`)**: `filletBox` / `extrude2d` + `subtract` cavities/slots + `mirrorPair` symmetry + chamfers/fillets. | Keep structural walls `>= 2.4–4.0mm`; check overhang angles (`<= 50°`) and ensure a flat `Z = 0` print base. |
| **Bottle / vase / cup / lamp / knob / chalice** | **Track A (`model.mjs`)**: Trace clean 2D half-silhouette `[r, z]` points → `cad.revolve(profile, 64)` (hollow by offsetting inner profile or `subtract` inner revolved core). | Close bottom (`r = 0`) cleanly; wall thickness `>= 2.0mm` (`>= 1.2mm` for translucent lamp shades). |
| **Wearable front face plate** *(flat-front Oni/kabuki mask without deep overhanging jaw/ears)* | **Track B (`sculpt --mode mask`)**: Re-project to a centered **frontal orthographic grayscale 3D depth map** → `cad.curvedMaskFromImage` (sleek uniform thin-shell via `innerFollow: 0.82`). | `wall 3.8–4.2mm`, `depth 28–34mm`, `arcDeg 132–142°`, `--straps`. Use pure `#000000` inside eye holes only; keep recessed mouth `#404040–#5A5A5A` so fangs stay solid. |
| **Full 360° organic mask / helmet / character / creature / bust / sculpted product** *(has deep hollow mouth cavities, overhanging fangs, protruding snouts, flaring 3D ears/fins, or full-round anatomy)* | **Track C (`generate` on Local GPU `Hunyuan3D-2mini` → `finish`)**: Run `node scripts/cad-engine.mjs generate "<image>" --height 240 --wearable --wall 4.5 --entry bottom` *(or `--flat-base` for solid display sculptures)*. | **CRITICAL REALISM RULE:** Heightmaps CANNOT carve real inward mouth cavities or separate protruding 3D ear blades/snouts! Whenever the subject needs real volumetric expansion + indentation + undercuts, ALWAYS route to **Track C Local GPU (`generate`)** — 100% offline on Apple Silicon MPS / NVIDIA CUDA, zero signup! |
| **Coin / emblem / crest / logo / wall plaque** | **Track B (`sculpt --mode relief`)**: Generate clean grayscale heightmap (or pass crisp frontal high-contrast PNG) → `cad.reliefFromImage`. | `depth 4–6mm`, `wall 2.4–3.0mm`. Add a bezel ring or keyring tab in `model.mjs` using `cad.union` + `cad.subtract` if needed! |
| **Photo lithophane (backlit)** | **Track B (`sculpt --mode relief --invert`)**: Pass photo directly with `--invert --depth 2.4 --wall 0.8 --smooth 1`. | Dark image pixels become thicker (`3.2mm`) to block light; bright pixels become thin (`0.8mm`) to glow. |

### Gold-Standard Grayscale Depth-Map Prompt Blueprint (For Agents With Image-Gen)
When transforming a reference image into `projects/<slug>/depth.png` for Track B:
- **Re-project to dead-center frontal orthographic** (even if the reference is a 3/4 photo!).
- **Pure pitch-black `#000000`** for the entire background outside the silhouette — AND inside eye/mouth openings ONLY if they should be cut all the way through.
- **Pure white `#FFFFFF`** = closest forward 3D peaks (nose tip, brow ridge, horns, fangs, snout, crown crest).
- **Mid-gray `#808080`–`#D0D0D0`** = cheeks, mid-depth carvings, filigree, ears, petals.
- **Dark gray `#282828`–`#585858`** = deep recesses, grooves, receding outer rim.
- **Strictly NO color, NO black cartoon ink outlines, NO cast lighting shadows, NO glossy highlights** — smooth, continuous 3D height-field shading only.

---

## 5. Post-Build Realization Audit & Enhancement Suggestions

After running `build`, `sculpt`, or `generate`, ALWAYS open `projects/<slug>/preview.png` (4 views: ISO 3/4, FRONT, RIGHT, BACK) side-by-side with the original reference image and verify:
1. **Identity Match (FRONT & ISO 3/4):** Does the silhouette immediately read as the exact subject from the reference image?
2. **True Volumetric Indentation & Expansion (RIGHT — "No Bumped-Egg" Gate!):** Check the side profile brutally! Do protruding features (snout, ears, horns, fins, limbs) genuinely **expand outward** in 3D, and do cavities (open mouth, eye sockets, undercuts) genuinely **indent inward**? If an organic 3D subject looks like a shallow bumped texture pasted onto an oval or slab, **FAIL the check and switch to Track C (`generate` on Local GPU)** — never ship fake bumped-egg 3D!
3. **Back & Function (BACK):** Clean hollow wearable cavity / bottom neck opening (if helmet/mask) or clean flat print bed (`Z = 0`)? Clean openings? Tucked internal strap loops?
4. **Slicer Readiness:** `"watertightAll": true`, realistic printable wall thickness & PLA weight.

If anything looks off, fix it immediately in `model.mjs` (or refine `depth.png`) before showing the final result. When presenting the finished export, include **2–3 concrete enhancement ideas** tailored to what you recognized in the image (e.g. *"Want a keyhole wall-mount slot on the back?"*, *"Want to split the crown/horns into a second AMS color part?"*, *"Want a tighter `145°` cheek wrap or thicker `5mm` wall?"*).
