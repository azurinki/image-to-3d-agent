# Manifold-3D Coded CAD DSL Reference (`model.mjs`)

Every project's `model.mjs` is a standard ES module exporting `meta`, `params`, and `build(cad, p)`:

```js
export const meta = {
  title: 'Example Model',
  referenceImage: 'reference.png',
  notes: 'Short summary of the 3D design',
};

export const params = {
  height: 80,
  width: 60,
  wall: 2.6,
  primaryColor: '#3b82f6',
};

export function build(cad, p) {
  const body = cad.filletBox(p.width, p.width, p.height, 8);
  return [cad.part('Main Body', body, p.primaryColor)];
}
```

All dimensions are in **millimeters (mm)**. Coordinate convention: **X = right/left**, **Y = back (+Y) / front (-Y)**, **Z = up (+Z)** (print bed at `Z = 0`). Memory for all WASM solids is automatically freed after export.

---

## 1. 3D Primitives

| Method | Description |
| :--- | :--- |
| `cad.box(w, d, h, { center? })` | Box of size `w × d × h` (centered XY, bottom at `Z=0` unless `center: true`) |
| `cad.roundedBox(w, d, h, r, { segs?, center? })` | Box with vertical rounded corners of radius `r` |
| `cad.filletBox(w, d, h, r, { segs?, center? })` | True 3D box rounded on **all 12 edges & 8 corners** (ideal for electronics, cases, cute chunky characters) |
| `cad.cylinder(h, rBottom, rTop = rBottom, segs = 48, { center? })` | Cylinder or tapered frustum (`rTop !== rBottom`) |
| `cad.cone(h, r, segs = 48, { center? })` | Cone of height `h` and base radius `r` |
| `cad.sphere(r, segs = 36)` | Sphere centered at origin |
| `cad.ellipsoid(rx, ry, rz, segs = 36)` | Stretched 3D ellipsoid (heads, torsos, cheeks, noses, eggs, pebbles) |
| `cad.capsule(r, totalHeight, segs = 32, { center? })` | Rounded cylinder with hemispherical ends (limbs, fingers, handles, pills) |
| `cad.torus(majorR, minorR, { segs?, tubeSegs?, degrees? })` | Full ring or partial arc (`degrees: 180` for handles/arches) in XY plane |
| `cad.wedge(w, d, h)` | Sloped triangular prism/ramp (phone stands, roofs, brackets) |

---

## 2. True 3D Sweeps, Revolves, Lofts & Tubes

### `cad.revolve(profile2d, { degrees = 360, segs = 64 })`
Lathes a closed 2D `[radius >= 0, z]` polygon around the Z axis. Best for **vases, mugs, bottles, lampshades, chess pieces, mushrooms, hats, knobs, planters**.
```js
const vase = cad.revolve([
  [0, 0], [26, 0], [32, 22], [22, 58], [26, 85],
  [23, 85], [19, 58], [28, 22], [22, 3], [0, 3],
], { segs: 72 });
```

### `cad.loft(sections, { segs = 48 })`
Smoothly connects 2+ horizontal cross-sections along Z into a watertight manifold solid. Best for **sculpted bodies, necks, ergonomic grips, figurines, boats, organic vessels**.
Each section can be `{ z, rx, ry?, cx?, cy?, rotDeg? }` OR `{ z, points: [[x,y], ...] }`:
```js
const torso = cad.loft([
  { z: 0, rx: 22, ry: 18 },
  { z: 25, rx: 26, ry: 22, cy: -2 },
  { z: 52, rx: 16, ry: 15, cy: 0 },
]);
```

### `cad.tube(path3d, radius, { segs = 18, closed = false })`
Sweeps a smooth rounded tube along any 3D polyline `[[x, y, z], ...]`. Accepts a constant `radius` or per-point radius array `[r0, r1, ...]` for tapered tails, handles, frames, and arches!
```js
const handle = cad.tube(
  [[24, 0, 22], [38, 0, 30], [40, 0, 52], [36, 0, 70], [24, 0, 76]],
  4.5,
  { segs: 20 },
);
```

### `cad.extrude(points2d, height, { twist?, scaleTop?, slices?, center? })`
Extrudes a 2D polygon `[[x, y], ...]` or multi-ring `[[outer], [hole]]` along Z with optional `twist` (degrees) and `scaleTop` (`[sx, sy]` or number).

---

## 3. Watertight CSG Booleans, Organic Blends & Patterns

| Method | Description |
| :--- | :--- |
| `cad.union(...solids)` / `a.union(b)` | Fuse overlapping solids into one watertight body |
| `cad.subtract(base, ...cutters)` / `a.subtract(b)` | Carve cavities, holes, slots, or clean multi-color part interfaces |
| `cad.intersect(...solids)` / `a.intersect(b)` | Keep only shared volume (great for slicing chamfers or contours) |
| `cad.hull(...solids)` / `a.hull(b)` | Convex hull wrapping 2+ solids — **best tool for organic limbs, ears, snouts, smooth transitions, ergonomic grips** |
| `cad.mirrorPair(solid, 'x' \| 'y' \| 'z')` | Unions `solid` with its mirror across the chosen axis (instant symmetry!) |
| `cad.radialArray(solid, count, { radius?, startDeg? })` | Circular pattern around Z (flutes, ribs, gears, petals, screw holes) |
| `cad.linearArray(solid, count, [dx, dy, dz])` | Linear array along a 3D vector |

---

## 4. Fluent Solid Transforms & Queries

Every `Solid` supports chaining:
- `.translate(x, y, z)`
- `.rotate(rxDeg, ryDeg, rzDeg)`
- `.scale(sx, sy?, sz?)`
- `.mirror('x' | 'y' | 'z')`
- `.warp((x, y, z) => [nx, ny, nz])` — smooth procedural bends, tapers, waves, organic ripples
- `.smooth(subdivisions = 1)` / `.refine(n)` — organic surface smoothing
- `.ground(z = 0)` — shifts lowest point onto `z`
- `.centerXY()` — centers X and Y bounding box at `0`
- `.scaleToHeight(mm)` / `.scaleToMaxDim(mm)`
- `.bbox()` → `{ min: [x,y,z], max: [x,y,z], size: [w,d,h] }`
- `.volume()` → volume in `mm³`

---

## 5. Pixel-Accurate Depth/Image Sculpting & Mesh Import (100% Pure Node.js!)

Sculpt high-resolution watertight 3D reliefs, lithophanes, and curved hollow wearable masks directly from an image or agent-generated grayscale depth map, or import local `.glb`/`.stl`/`.obj` meshes into parametric code:

| Method | Description |
| :--- | :--- |
| `cad.curvedMaskFromImage(imgPath, { height, width, depth, wall, innerFollow, arcDeg, domeCurve, res, smooth, gamma, cutDarkHoles, straps })` | Wraps a depth map or reference image onto a **sleek uniform thin-shell** curved hollow wearable front face mask (`innerFollow` defaults to `0.82` so inner cavity smoothly follows outer relief for lightweight prints, optional dark eye cutouts + flush tucked strap slots) |
| `cad.reliefFromImage(imgPath, { height, width, depth, baseThickness, res, smooth, gamma, invert })` | Sculpts a watertight flat `Z=0` 3D bas-relief, medallion, coin, or backlit lithophane (`invert: true`) |
| `cad.reliefFromImage(imgPath, { height, width, depth, baseThickness, res, smooth, gamma, invert, removeBg })` | Sculpts a watertight flat 3D bas-relief, medallion, plaque, or backlit lithophane (`invert: true`) directly from image pixels |
| `cad.importMesh(filePath, { height?, width?, scaleMax?, rot?: [rx,ry,rz], centerXY?, ground? })` | Imports binary `.glb` (glTF 2.0, auto-converts Y-up → Z-up & welds UV seams), `.stl`, `.obj`, or `.3mf` directly into a watertight `Manifold` `Solid` |
| `cad.makeWearable(solid, { wall = 4.2, entry = 'back' \| 'bottom', straps = false })` | Hollows a solid mask/helmet mesh to `wall` mm thickness, opens rear (`'back'`) or neck (`'bottom'`) entry, and optionally adds flush left/right elastic strap loops |
| `cad.flatBase(solid, trimMm = 1.2)` | Trims the bottom flat on `Z = 0` for effortless 3D-printer bed adhesion |

## 6. Multi-Color AMS Slicer Best Practices

When returning multiple `cad.part(name, solid, hex)` objects:
1. **Prevent overlapping volumes** by subtracting accent parts from the main body:
   ```js
   const cleanBody = cad.subtract(bodyRaw, eyes, nose, trim);
   return [
     cad.part('Body', cleanBody, '#45484c'),
     cad.part('Eyes & Nose', cad.union(eyes, nose), '#111827'),
     cad.part('Trim', trim, '#f8fafc'),
   ];
   ```
2. **Overlap parts before subtracting** (`1–2mm` embed depth) so parts lock solidly together with zero paper-thin gaps.
3. **Keep printable clearances** (`0.2mm` press-fit, `0.35mm` loose slip-fit) and minimum wall thickness `>= 1.6mm` (`4` perimeters on a `0.4mm` nozzle).
