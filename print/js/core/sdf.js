// Signed distance primitives and scene evaluation.
// Pure JS, no dependencies, units are millimetres, Z is up (print bed is z = 0).
// A primitive is { d(x,y,z) -> signed distance, bbox: [minX,minY,minZ,maxX,maxY,maxZ], part, op, k }.

export const v3 = (x, y, z) => [x, y, z];

const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export function smin(a, b, k) {
  if (k <= 0) return a < b ? a : b;
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

export function smax(a, b, k) {
  return -smin(-a, -b, k);
}

// Rotation matrix from Euler angles in degrees (applied Z, then Y, then X).
export function rotation(rx = 0, ry = 0, rz = 0) {
  const a = (rx * Math.PI) / 180, b = (ry * Math.PI) / 180, c = (rz * Math.PI) / 180;
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
  // R = Rx * Ry * Rz
  return [
    cb * cc, -cb * sc, sb,
    sa * sb * cc + ca * sc, -sa * sb * sc + ca * cc, -sa * cb,
    -ca * sb * cc + sa * sc, ca * sb * sc + sa * cc, ca * cb,
  ];
}

function boxAround(c, r) {
  return [c[0] - r, c[1] - r, c[2] - r, c[0] + r, c[1] + r, c[2] + r];
}

function mergeBox(a, b) {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2]), Math.max(a[3], b[3]), Math.max(a[4], b[4]), Math.max(a[5], b[5])];
}

export function sphere(c, r) {
  const [cx, cy, cz] = c;
  return { d: (x, y, z) => len3(x - cx, y - cy, z - cz) - r, bbox: boxAround(c, r) };
}

// Ellipsoid with radii (a,b,c) and optional rotation (degrees). Approximate but well behaved distance.
export function ellipsoid(c, radii, rot = null) {
  const [cx, cy, cz] = c;
  const [ra, rb, rc] = radii;
  const R = rot ? rotation(...rot) : null;
  const d = (x, y, z) => {
    let px = x - cx, py = y - cy, pz = z - cz;
    if (R) {
      // local = R^T * p
      const lx = R[0] * px + R[3] * py + R[6] * pz;
      const ly = R[1] * px + R[4] * py + R[7] * pz;
      const lz = R[2] * px + R[5] * py + R[8] * pz;
      px = lx; py = ly; pz = lz;
    }
    const k0 = len3(px / ra, py / rb, pz / rc);
    const k1 = len3(px / (ra * ra), py / (rb * rb), pz / (rc * rc));
    if (k1 < 1e-9) return -Math.min(ra, rb, rc);
    return (k0 * (k0 - 1)) / k1;
  };
  return { d, bbox: boxAround(c, Math.max(ra, rb, rc)) };
}

// Cone-capsule between points a and b with radii ra and rb (round ends).
export function roundCone(a, b, ra, rb = ra) {
  const [ax, ay, az] = a;
  const bx = b[0] - ax, by = b[1] - ay, bz = b[2] - az;
  const l2 = bx * bx + by * by + bz * bz || 1e-9;
  const d = (x, y, z) => {
    const px = x - ax, py = y - ay, pz = z - az;
    const t = clamp((px * bx + py * by + pz * bz) / l2, 0, 1);
    return len3(px - bx * t, py - by * t, pz - bz * t) - (ra + (rb - ra) * t);
  };
  return { d, bbox: mergeBox(boxAround(a, ra), boxAround(b, rb)) };
}

export const capsule = (a, b, r) => roundCone(a, b, r, r);

// Torus around the Z axis (after optional rotation), major radius R, tube radius r.
export function torus(c, R, r, rot = null) {
  const [cx, cy, cz] = c;
  const M = rot ? rotation(...rot) : null;
  const d = (x, y, z) => {
    let px = x - cx, py = y - cy, pz = z - cz;
    if (M) {
      const lx = M[0] * px + M[3] * py + M[6] * pz;
      const ly = M[1] * px + M[4] * py + M[7] * pz;
      const lz = M[2] * px + M[5] * py + M[8] * pz;
      px = lx; py = ly; pz = lz;
    }
    const q = Math.sqrt(px * px + py * py) - R;
    return Math.sqrt(q * q + pz * pz) - r;
  };
  return { d, bbox: boxAround(c, R + r) };
}

// Vertical cylinder with rounded edges, from z0 to z1, radius r0 at the bottom and r1 at the top.
export function roundCylinder(c, r0, r1, z0, z1, edge = 1) {
  const [cx, cy] = c;
  const h = z1 - z0;
  const d = (x, y, z) => {
    const t = clamp((z - z0) / h, 0, 1);
    const r = r0 + (r1 - r0) * t - edge;
    const dr = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) - r;
    const dz = Math.abs(z - (z0 + z1) / 2) - (h / 2 - edge);
    const ox = Math.max(dr, 0), oz = Math.max(dz, 0);
    return Math.min(Math.max(dr, dz), 0) + Math.sqrt(ox * ox + oz * oz) - edge;
  };
  const R = Math.max(r0, r1);
  return { d, bbox: [cx - R, c[1] - R, z0, cx + R, c[1] + R, z1] };
}

// Cylinder along an arbitrary axis n (unit) through point c, spanning t in [t0, t1].
export function axisCylinder(c, n, r, t0, t1) {
  const [cx, cy, cz] = c;
  const [nx, ny, nz] = n;
  const d = (x, y, z) => {
    const px = x - cx, py = y - cy, pz = z - cz;
    const t = px * nx + py * ny + pz * nz;
    const rad = len3(px - t * nx, py - t * ny, pz - t * nz) - r;
    const ax = Math.max(t0 - t, t - t1);
    const ox = Math.max(rad, 0), oz = Math.max(ax, 0);
    return Math.min(Math.max(rad, ax), 0) + Math.sqrt(ox * ox + oz * oz);
  };
  const e = Math.max(Math.abs(t0), Math.abs(t1)) + r;
  return { d, bbox: boxAround(c, e) };
}

// Wrap a primitive with modifiers.
export function intersect(p, q) {
  return { d: (x, y, z) => Math.max(p.d(x, y, z), q.d(x, y, z)), bbox: p.bbox };
}

export function halfSpaceAbove(z0) {
  return { d: (x, y, z) => z0 - z, bbox: [-1e6, -1e6, z0, 1e6, 1e6, 1e6] };
}

// Lower bound of distance from a point to a box (0 inside).
function boxDist(b, x, y, z) {
  const dx = Math.max(b[0] - x, 0, x - b[3]);
  const dy = Math.max(b[1] - y, 0, y - b[4]);
  const dz = Math.max(b[2] - z, 0, z - b[5]);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * A scene is a list of parts (colors) and shapes.
 * shapes: [{ prim, part: index, op: 'add'|'sub', k: blend radius }]
 * Returns an evaluator that fills `out` = { f, parts: Float64Array(partCount) } for a point,
 * where f is the final solid distance and parts[i] the distance to the shapes of part i.
 */
export function compileScene(scene) {
  const partCount = scene.parts.length;
  const adds = [], subs = [];
  for (const s of scene.shapes) {
    const margin = 2 + (s.k || 0) * 2;
    const b = s.prim.bbox;
    const entry = { d: s.prim.d, part: s.part ?? 0, k: s.k || 0, margin, box: [b[0] - margin, b[1] - margin, b[2] - margin, b[3] + margin, b[4] + margin, b[5] + margin] };
    (s.op === 'sub' ? subs : adds).push(entry);
  }
  const flatBase = scene.flatBase !== false;
  const partD = new Float64Array(partCount);

  function evaluate(x, y, z) {
    let f = 1e9;
    partD.fill(1e9);
    for (let i = 0; i < adds.length; i++) {
      const s = adds[i];
      const bd = boxDist(s.box, x, y, z);
      // outside the margin box the true distance is at least `margin` (> blend radius), so a cheap bound is safe
      const d = bd > 0 ? bd + s.margin : s.d(x, y, z);
      f = smin(f, d, s.k);
      if (d < partD[s.part]) partD[s.part] = d;
    }
    for (let i = 0; i < subs.length; i++) {
      const s = subs[i];
      const bd = boxDist(s.box, x, y, z);
      if (bd > 0) continue;
      f = smax(f, -s.d(x, y, z), s.k);
    }
    if (flatBase) f = Math.max(f, -z);
    return f;
  }

  let bbox = null;
  for (const a of adds) {
    const b = a.box;
    bbox = bbox ? mergeBox(bbox, b) : b.slice();
  }
  if (!bbox) bbox = [-1, -1, 0, 1, 1, 1];
  if (flatBase) bbox[2] = Math.max(bbox[2], -1);
  return { evaluate, partD, partCount, bbox };
}
