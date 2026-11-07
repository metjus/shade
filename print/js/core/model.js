// Builds printable color parts from a scene.
// Modes:
//   'single' – one solid body (single-color print)
//   'ams'    – one body per color, touching exactly (multi-material printer, e.g. Bambu AMS)
//   'split'  – one body per color with a fit clearance and alignment pins, printed separately and glued
import { compileScene, axisCylinder } from './sdf.js';
import { marchingTets, dropFragments, smoothProject } from './mesher.js';
import { analyzeMesh } from './check.js';

export const DEFAULT_OPTIONS = {
  mode: 'ams',
  voxel: 0.6, // mm
  maxCells: 3_000_000,
  clearance: 0.2, // mm, total gap between split parts
  pinType: 'filament', // 'filament' | 'peg' | 'none'
  filamentDiameter: 1.75,
  pegDiameter: 3,
  pinMaxLength: 6,
  pinWall: 1.2,
};

export function buildModel(scene, opts = {}) {
  const o = { ...DEFAULT_OPTIONS, ...opts };
  const t0 = now();
  const sc = compileScene(scene);
  const P = sc.partCount;

  // ---- grid setup (z = 0 falls exactly between two sample layers) ----
  let h = o.voxel;
  const pad = 2;
  const bb = sc.bbox;
  let dims, origin;
  for (;;) {
    const x0 = bb[0] - pad * h, y0 = bb[1] - pad * h;
    const z0 = -h * (pad + 0.5);
    const nx = Math.ceil((bb[3] - x0) / h) + pad + 1;
    const ny = Math.ceil((bb[4] - y0) / h) + pad + 1;
    const nz = Math.ceil((bb[5] - z0) / h) + pad + 1;
    if (nx * ny * nz <= o.maxCells) { dims = [nx, ny, nz]; origin = [x0, y0, z0]; break; }
    h *= 1.1;
  }
  const [nx, ny, nz] = dims;
  const N = nx * ny * nz;

  // ---- sample the field once ----
  const F = new Float32Array(N);
  const D = Array.from({ length: P }, () => new Float32Array(N));
  let n = 0;
  for (let k = 0; k < nz; k++) {
    const z = origin[2] + k * h;
    for (let j = 0; j < ny; j++) {
      const y = origin[1] + j * h;
      for (let i = 0; i < nx; i++, n++) {
        const x = origin[0] + i * h;
        F[n] = sc.evaluate(x, y, z);
        for (let p = 0; p < P; p++) D[p][n] = sc.partD[p];
      }
    }
  }
  // border must be outside
  forBorder(dims, (idx) => { F[idx] = Math.max(F[idx], h); });
  const tSample = now();

  const grid = { dims, origin, h };
  const parts = [];
  let pins = [];

  if (o.mode === 'single') {
    const mesh = meshField(F, dims, origin, h);
    parts.push(finishPart({ index: -1, name: scene.name || 'model', color: scene.parts[0]?.color || '#cccccc' }, mesh));
  } else {
    const clr = o.mode === 'split' ? o.clearance / 2 : 0;
    // region fields
    const fields = [];
    for (let p = 0; p < P; p++) {
      const R = new Float32Array(N);
      let any = false;
      const Dp = D[p];
      for (let q = 0; q < N; q++) {
        let other = 1e9;
        for (let r = 0; r < P; r++) if (r !== p && D[r][q] < other) other = D[r][q];
        const region = (Dp[q] - other) * 0.5 + clr;
        const v = Math.max(F[q], region);
        R[q] = v;
        if (v < 0) any = true;
      }
      fields.push(any ? R : null);
    }

    if (o.mode === 'split' && o.pinType !== 'none') {
      pins = findPins(sc, D, F, grid, fields, o);
      for (const pin of pins) applyPin(pin, fields, grid, o);
    }

    for (let p = 0; p < P; p++) {
      if (!fields[p]) continue;
      forBorder(dims, (idx) => { fields[p][idx] = Math.max(fields[p][idx], h); });
      const mesh = meshField(fields[p], dims, origin, h);
      if (mesh.indices.length === 0) continue;
      parts.push(finishPart({ index: p, name: scene.parts[p].name, color: scene.parts[p].color }, mesh));
    }
  }

  const tMesh = now();
  const total = parts.reduce((s, p) => s + p.volume, 0);
  return {
    parts,
    pins,
    voxel: h,
    dims,
    stats: { volume: total, sampleMs: Math.round(tSample - t0), meshMs: Math.round(tMesh - tSample) },
  };
}

function finishPart(info, mesh) {
  const a = analyzeMesh(mesh);
  return { ...info, mesh, volume: a.volume, bbox: a.bbox, islands: a.islands, openEdges: a.openEdges, badEdges: a.badEdges, triangles: mesh.indices.length / 3 };
}

function forBorder(dims, fn) {
  const [nx, ny, nz] = dims;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (i === 0 || j === 0 || k === 0 || i === nx - 1 || j === ny - 1 || k === nz - 1) fn(i + nx * (j + ny * k));
  }
}

// ---------------- alignment pins ----------------

function findPins(sc, D, F, grid, fields, o) {
  const { dims, origin, h } = grid;
  const [nx, ny, nz] = dims;
  const P = D.length;
  const holeR = o.pinType === 'filament' ? o.filamentDiameter / 2 + 0.15 : o.pegDiameter / 2 + o.clearance;
  const need = holeR + o.pinWall;
  const cands = new Map(); // "a-b" -> [{x,y,z,depth}]
  let n = 0;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++, n++) {
    if (F[n] > -need) continue;
    let a = -1, b = -1, da = 1e9, db = 1e9;
    for (let p = 0; p < P; p++) {
      const d = D[p][n];
      if (d < da) { b = a; db = da; a = p; da = d; } else if (d < db) { b = p; db = d; }
    }
    if (b < 0 || !fields[a] || !fields[b]) continue;
    if (db - da > h * 0.9) continue;
    const lo = Math.min(a, b), hi = Math.max(a, b);
    const key = lo + '-' + hi;
    if (!cands.has(key)) cands.set(key, []);
    cands.get(key).push({ x: origin[0] + i * h, y: origin[1] + j * h, z: origin[2] + k * h, depth: -F[n] });
  }

  const pins = [];
  const minSep = Math.max(8, holeR * 6);
  for (const [key, list] of cands) {
    const [a, b] = key.split('-').map(Number);
    list.sort((p, q) => q.depth - p.depth);
    const chosen = [];
    for (const c of list) {
      if (chosen.length >= 8) break;
      if (chosen.some((s) => (s.x - c.x) ** 2 + (s.y - c.y) ** 2 + (s.z - c.z) ** 2 < minSep * minSep)) continue;
      const pin = makePin(sc, a, b, c, need, o, h);
      if (pin) chosen.push({ ...c, pin });
    }
    for (const c of chosen) pins.push(c.pin);
  }
  return pins;
}

function partGap(sc, a, b, x, y, z) {
  const f = sc.evaluate(x, y, z);
  return { f, g: sc.partD[a] - sc.partD[b] };
}

function makePin(sc, a, b, c, need, o, h) {
  // normal: gradient of (d_a - d_b), pointing from part a into part b
  const e = h * 0.5;
  const gx = partGap(sc, a, b, c.x + e, c.y, c.z).g - partGap(sc, a, b, c.x - e, c.y, c.z).g;
  const gy = partGap(sc, a, b, c.x, c.y + e, c.z).g - partGap(sc, a, b, c.x, c.y - e, c.z).g;
  const gz = partGap(sc, a, b, c.x, c.y, c.z + e).g - partGap(sc, a, b, c.x, c.y, c.z - e).g;
  const gl = Math.hypot(gx, gy, gz);
  if (gl < 1e-6) return null;
  const nrm = [gx / gl, gy / gl, gz / gl];
  // snap the center onto the interface
  const g0 = partGap(sc, a, b, c.x, c.y, c.z).g;
  const shift = -g0 / (gl / (2 * e));
  const cx = c.x + nrm[0] * shift, cy = c.y + nrm[1] * shift, cz = c.z + nrm[2] * shift;

  const reach = (dir, inA) => {
    let last = 0;
    for (let t = 0.25; t <= o.pinMaxLength + 1e-6; t += 0.25) {
      const px = cx + nrm[0] * t * dir, py = cy + nrm[1] * t * dir, pz = cz + nrm[2] * t * dir;
      const { f, g } = partGap(sc, a, b, px, py, pz);
      if (f > -need) break;
      if (inA ? g > 0 : g < 0) break;
      last = t;
    }
    return Math.max(0, last - o.pinWall * 0.5);
  };
  const La = Math.min(reach(-1, true), o.pinMaxLength);
  const Lb = Math.min(reach(1, false), o.pinMaxLength);
  if (La < 2 || Lb < 2) return null;
  const pin = { a, b, center: [cx, cy, cz], normal: nrm, La, Lb, type: o.pinType };
  if (o.pinType === 'filament') pin.cutLength = Math.round((La + Lb - 0.6) * 10) / 10;
  return pin;
}

function applyPin(pin, fields, grid, o) {
  const { a, b, center, normal, La, Lb } = pin;
  if (pin.type === 'filament') {
    const r = o.filamentDiameter / 2 + 0.15;
    const cyl = axisCylinder(center, normal, r, -La, Lb);
    carve(fields[a], grid, cyl, 'sub');
    carve(fields[b], grid, cyl, 'sub');
  } else {
    const r = o.pegDiameter / 2;
    const peg = axisCylinder(center, normal, r, -1.0, Lb - 0.4);
    const hole = axisCylinder(center, normal, r + o.clearance, -0.01, Lb);
    carve(fields[a], grid, peg, 'add');
    carve(fields[b], grid, hole, 'sub');
  }
}

function carve(field, grid, prim, op) {
  if (!field) return;
  const { dims, origin, h } = grid;
  const [nx, ny] = dims;
  const b = prim.bbox;
  const i0 = Math.max(0, Math.floor((b[0] - origin[0]) / h) - 1), i1 = Math.min(dims[0] - 1, Math.ceil((b[3] - origin[0]) / h) + 1);
  const j0 = Math.max(0, Math.floor((b[1] - origin[1]) / h) - 1), j1 = Math.min(dims[1] - 1, Math.ceil((b[4] - origin[1]) / h) + 1);
  const k0 = Math.max(0, Math.floor((b[2] - origin[2]) / h) - 1), k1 = Math.min(dims[2] - 1, Math.ceil((b[5] - origin[2]) / h) + 1);
  for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const idx = i + nx * (j + ny * k);
    const d = prim.d(origin[0] + i * h, origin[1] + j * h, origin[2] + k * h);
    field[idx] = op === 'sub' ? Math.max(field[idx], -d) : Math.min(field[idx], d);
  }
}

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function meshField(values, dims, origin, h) {
  const mesh = marchingTets(values, dims, origin, h);
  const p = mesh.positions;
  for (let i = 2; i < p.length; i += 3) if (p[i] < 0) p[i] = 0;
  const clean = dropFragments(mesh, Math.max(0.5, h * h * h * 2));
  return smoothProject(clean, values, dims, origin, h);
}
