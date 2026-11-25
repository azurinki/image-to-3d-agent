import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const ENGINE = join(REPO_ROOT, 'scripts', 'cad-engine.mjs');

function runCli(args, opts = {}) {
  const res = spawnSync(process.execPath, [ENGINE, ...args], {
    cwd: opts.cwd || REPO_ROOT,
    env: { ...process.env, ...(opts.env || {}) },
    encoding: 'utf8',
    timeout: 60000,
  });
  return res;
}

function parseJsonStdout(res) {
  assert.equal(res.status, 0, `CLI exited ${res.status}:\nSTDOUT:\n${res.stdout}\nSTDERR:\n${res.stderr}`);
  return JSON.parse(res.stdout.trim());
}

// Minimal pure-Node RGBA PNG writer for deterministic zero-fixture tests
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function makeTestPng(width, height, pixelFn) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0; // filter None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a = 255] = pixelFn(x, y, width, height);
      const o = row + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

describe('image-to-3d-agent end-to-end engine suite', () => {
  let workDir;
  let maskPngPath;
  let coinPngPath;
  let boxStlPath;

  before(() => {
    workDir = mkdtempSync(join(tmpdir(), 'image-to-3d-test-'));

    // Synthetic frontal depth mask: black bg, domed white face, two large black eye holes,
    // plus a thin 2px black cartoon ink stripe across the lower face (must NOT punch through!)
    maskPngPath = join(workDir, 'face-mask.png');
    writeFileSync(
      maskPngPath,
      makeTestPng(120, 120, (x, y, w, h) => {
        const nx = (x - w / 2) / (w * 0.38);
        const ny = (y - h / 2) / (h * 0.42);
        const r2 = nx * nx + ny * ny;
        if (r2 > 1) return [0, 0, 0, 255];
        // Two large eye cutouts (each ~13x10 px)
        const inLeftEye = ((x - 44) ** 2) / 49 + ((y - 48) ** 2) / 25 <= 1;
        const inRightEye = ((x - 76) ** 2) / 49 + ((y - 48) ** 2) / 25 <= 1;
        if (inLeftEye || inRightEye) return [0, 0, 0, 255];
        // Thin 2px cartoon ink line across cheeks
        if (y >= 74 && y <= 75 && x >= 35 && x <= 85) return [0, 0, 0, 255];
        const lum = Math.round(90 + (1 - Math.sqrt(r2)) * 165);
        return [lum, lum, lum, 255];
      }),
    );

    // Synthetic circular medallion PNG
    coinPngPath = join(workDir, 'coin.png');
    writeFileSync(
      coinPngPath,
      makeTestPng(96, 96, (x, y, w, h) => {
        const d = Math.hypot(x - w / 2, y - h / 2) / (w * 0.42);
        if (d > 1) return [0, 0, 0, 255];
        const v = d > 0.85 ? 235 : d < 0.35 ? 255 : 140;
        return [v, v, v, 255];
      }),
    );
  });

  after(() => {
    if (workDir && existsSync(workDir)) rmSync(workDir, { recursive: true, force: true });
  });

  it('doctor reports Node 18+, WASM kernel, image decoders, and GPU status JSON', () => {
    const data = parseJsonStdout(runCli(['doctor'], { cwd: workDir }));
    assert.equal(data.ok, true);
    assert.equal(data.node.ok, true);
    assert.equal(data.wasm.ok, true);
    assert.equal(data.gpuScript.ok, true);
    assert.equal(typeof data.gpuVenv.installed, 'boolean');
    assert.ok(Array.isArray(data.imageDecoders));
    assert.ok(data.imageDecoders.includes('png-native'));
  });

  it('Track A: init + build exports watertight 3MF, STL, OBJ, SCAD, preview.png, and STEP (--cad)', () => {
    const initRes = parseJsonStdout(
      runCli(['init', 'box-test', '--title', 'Box Test', '--dir', join(workDir, 'projects')], { cwd: workDir }),
    );
    assert.equal(initRes.ok, true);
    assert.ok(existsSync(initRes.modelFile));

    const buildRes = parseJsonStdout(
      runCli(
        ['build', initRes.modelFile, '--param', 'height=50', '--scale', '80', '--cad', '--note', 'ci build'],
        { cwd: workDir },
      ),
    );
    assert.equal(buildRes.ok, true);
    assert.equal(buildRes.watertightAll, true);
    assert.equal(Math.max(buildRes.dimensionsMm.x, buildRes.dimensionsMm.y, buildRes.dimensionsMm.z), 80);
    for (const key of ['threeMf', 'stl', 'obj', 'scad', 'previewPng', 'stepCad']) {
      assert.ok(existsSync(buildRes.outputs[key]), `Missing output ${key}`);
      assert.ok(statSync(buildRes.outputs[key]).size > 100, `Empty output ${key}`);
    }
    boxStlPath = buildRes.outputs.stl;
  });

  it('Track B relief: sculpts watertight medallion and inverted lithophane from pure-JS PNG', () => {
    const relief = parseJsonStdout(
      runCli(
        ['sculpt', coinPngPath, '--slug', 'medallion', '--dir', join(workDir, 'projects'), '--mode', 'relief', '--height', '80', '--depth', '4', '--res', '80'],
        { cwd: workDir },
      ),
    );
    assert.equal(relief.ok, true);
    assert.equal(relief.watertightAll, true);
    assert.ok(Math.abs(relief.dimensionsMm.x - 80) < 2);

    const litho = parseJsonStdout(
      runCli(
        ['sculpt', coinPngPath, '--slug', 'litho', '--dir', join(workDir, 'projects'), '--mode', 'relief', '--invert', '--height', '80', '--depth', '2.4', '--wall', '0.8', '--res', '80'],
        { cwd: workDir },
      ),
    );
    assert.equal(litho.ok, true);
    assert.equal(litho.watertightAll, true);
    assert.ok(litho.dimensionsMm.z <= 3.5);
  });

  it('Track B mask: thin-shell hollowing cuts volume significantly vs solid back while staying watertight', () => {
    const solidBack = parseJsonStdout(
      runCli(
        ['sculpt', maskPngPath, '--slug', 'mask-solid', '--dir', join(workDir, 'projects'), '--mode', 'mask', '--height', '180', '--depth', '28', '--wall', '4.0', '--inner-follow', '0', '--res', '90'],
        { cwd: workDir },
      ),
    );
    const thinShell = parseJsonStdout(
      runCli(
        ['sculpt', maskPngPath, '--slug', 'mask-thin', '--dir', join(workDir, 'projects'), '--mode', 'mask', '--height', '180', '--depth', '28', '--wall', '4.0', '--inner-follow', '0.82', '--res', '90', '--straps'],
        { cwd: workDir },
      ),
    );
    assert.equal(solidBack.watertightAll, true);
    assert.equal(thinShell.watertightAll, true);
    assert.ok(
      thinShell.volumeCm3 < solidBack.volumeCm3 * 0.65,
      `Expected thin shell (${thinShell.volumeCm3}cm3) to be <65% of solid back (${solidBack.volumeCm3}cm3)`,
    );
  });

  it('Track B mask: protects thin black ink lines while still punching real large eye openings', () => {
    const withHoles = parseJsonStdout(
      runCli(
        ['sculpt', maskPngPath, '--slug', 'mask-eyes', '--dir', join(workDir, 'projects'), '--mode', 'mask', '--height', '160', '--depth', '20', '--wall', '4.0', '--res', '96'],
        { cwd: workDir },
      ),
    );
    const noHoles = parseJsonStdout(
      runCli(
        ['sculpt', maskPngPath, '--slug', 'mask-no-holes', '--dir', join(workDir, 'projects'), '--mode', 'mask', '--height', '160', '--depth', '20', '--wall', '4.0', '--res', '96', '--no-holes'],
        { cwd: workDir },
      ),
    );
    assert.equal(withHoles.watertightAll, true);
    assert.equal(noHoles.watertightAll, true);
    // Eye holes remove noticeable volume, while thin ink line does NOT shred the mask
    assert.ok(withHoles.volumeCm3 < noHoles.volumeCm3 * 0.96, 'Expected real eye openings to reduce volume');
    assert.ok(withHoles.volumeCm3 > noHoles.volumeCm3 * 0.75, 'Expected thin ink line NOT to shred mask body');
  });

  it('Track C finish: wraps local STL with --wearable --flat-base and honors --name alias', () => {
    assert.ok(boxStlPath && existsSync(boxStlPath), 'Requires box STL from Track A');
    const fin = parseJsonStdout(
      runCli(
        ['finish', boxStlPath, '--name', 'finished-mesh', '--dir', join(workDir, 'projects'), '--height', '100', '--wearable', '--wall', '4.0', '--entry', 'bottom', '--flat-base'],
        { cwd: workDir },
      ),
    );
    assert.equal(fin.ok, true);
    assert.equal(fin.slug, 'finished-mesh');
    assert.equal(fin.watertightAll, true);
    assert.ok(fin.outputs.modelCode.includes('finished-mesh'));
  });

  it('list and resume persist and reload project state.json cleanly', () => {
    const listed = parseJsonStdout(runCli(['list', '--dir', join(workDir, 'projects')], { cwd: workDir }));
    assert.equal(listed.ok, true);
    assert.ok(listed.count >= 5);

    const resumed = parseJsonStdout(runCli(['resume', 'box-test', '--dir', join(workDir, 'projects')], { cwd: workDir }));
    assert.equal(resumed.slug, 'box-test');
    assert.equal(resumed.status, 'built');
  });

  it('generate fails with an actionable setup-gpu message when GPU venv is missing', () => {
    const res = runCli(
      ['generate', maskPngPath, '--slug', 'gpu-missing', '--dir', join(workDir, 'projects')],
      { cwd: workDir, env: { IMAGE_TO_3D_GPU_VENV: join(workDir, 'no-such-venv') } },
    );
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /setup-gpu/i);
  });

  it('repository skill files and portable zip archive are intact and synced', () => {
    const skillMd = readFileSync(join(REPO_ROOT, 'SKILL.md'), 'utf8');
    assert.match(skillMd, /^---\nname: image-to-3d\n/);
    assert.ok(existsSync(join(REPO_ROOT, 'scripts', 'local-3d-gpu.py')));
    assert.ok(existsSync(join(REPO_ROOT, 'references', 'image-recognition-and-realization.md')));

    const zipBuf = readFileSync(join(REPO_ROOT, 'dist', 'image-to-3d.zip'));
    assert.equal(zipBuf.subarray(0, 2).toString('ascii'), 'PK', 'dist/image-to-3d.zip must be a valid zip');
    const zipStr = zipBuf.toString('latin1');
    for (const entry of [
      'image-to-3d/SKILL.md',
      'image-to-3d/references/image-recognition-and-realization.md',
      'image-to-3d/references/cad-api.md',
      'image-to-3d/references/workflow-and-resume.md',
      'image-to-3d/scripts/cad-engine.mjs',
      'image-to-3d/scripts/local-3d-gpu.py',
      'image-to-3d/scripts/manifold.wasm',
    ]) {
      assert.ok(zipStr.includes(entry), `Missing ${entry} inside dist/image-to-3d.zip`);
    }
  });
});
