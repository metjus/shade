// Surface Nets mesher: turns a sampled signed distance grid into a closed triangle mesh.
// values[i + nx*(j + ny*k)] is the field at (x0 + i*h, y0 + j*h, z0 + k*h); negative = inside.
// The grid must be padded so the border samples are outside (positive) — then the mesh is closed.

export function surfaceNets(values, dims, origin, h) {
  const [nx, ny, nz] = dims;
  const [x0, y0, z0] = origin;
  const sx = 1, sy = nx, sz = nx * ny;
  const cellIndex = new Int32Array(nx * ny * nz).fill(-1);
  const pos = [];

  // corner offsets of a cell (in grid index units)
  const corners = [
    [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
    [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
  ];
  const edges = [
    [0, 1], [2, 3], [4, 5], [6, 7], // x
    [0, 2], [1, 3], [4, 6], [5, 7], // y
    [0, 4], [1, 5], [2, 6], [3, 7], // z
  ];
  const cv = new Float64Array(8);

  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const base = i + sy * j + sz * k;
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const o = corners[c];
          const v = values[base + o[0] * sx + o[1] * sy + o[2] * sz];
          cv[c] = v;
          if (v < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let ax = 0, ay = 0, az = 0, n = 0;
        for (let e = 0; e < 12; e++) {
          const [a, b] = edges[e];
          const va = cv[a], vb = cv[b];
          if ((va < 0) === (vb < 0)) continue;
          const t = va / (va - vb);
          const ca = corners[a], cb = corners[b];
          ax += ca[0] + (cb[0] - ca[0]) * t;
          ay += ca[1] + (cb[1] - ca[1]) * t;
          az += ca[2] + (cb[2] - ca[2]) * t;
          n++;
        }
        cellIndex[base] = pos.length / 3;
        pos.push(x0 + (i + ax / n) * h, y0 + (j + ay / n) * h, z0 + (k + az / n) * h);
      }
    }
  }

  const idx = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) { const t = b; b = d; d = t; }
    // split along the shorter diagonal for nicer triangles
    const dac = dist2(pos, a, c), dbd = dist2(pos, b, d);
    if (dac <= dbd) idx.push(a, b, c, a, c, d);
    else idx.push(a, b, d, b, c, d);
  };

  for (let k = 1; k < nz - 1; k++) {
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        // x edge (i,j,k)-(i+1,j,k): cells around in the y-z plane
        const p = i + sy * j + sz * k;
        const v0 = values[p], v1 = values[p + sx];
        if ((v0 < 0) === (v1 < 0)) continue;
        quad(cellIndex[p - sy - sz], cellIndex[p - sz], cellIndex[p], cellIndex[p - sy], !(v0 < 0));
      }
    }
  }
  for (let k = 1; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        // y edge: cells around in the z-x plane (order z, then x)
        const p = i + sy * j + sz * k;
        const v0 = values[p], v1 = values[p + sy];
        if ((v0 < 0) === (v1 < 0)) continue;
        quad(cellIndex[p - sz - sx], cellIndex[p - sx], cellIndex[p], cellIndex[p - sz], !(v0 < 0));
      }
    }
  }
  for (let k = 0; k < nz - 1; k++) {
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        // z edge: cells around in the x-y plane
        const p = i + sy * j + sz * k;
        const v0 = values[p], v1 = values[p + sz];
        if ((v0 < 0) === (v1 < 0)) continue;
        quad(cellIndex[p - sx - sy], cellIndex[p - sy], cellIndex[p], cellIndex[p - sx], !(v0 < 0));
      }
    }
  }

  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}

function dist2(pos, a, b) {
  const dx = pos[a * 3] - pos[b * 3], dy = pos[a * 3 + 1] - pos[b * 3 + 1], dz = pos[a * 3 + 2] - pos[b * 3 + 2];
  return dx * dx + dy * dy + dz * dz;
}

// Marching tetrahedra (Freudenthal split of each cube into 6 tetrahedra).
// Unlike plain surface nets it has no ambiguous cases, so the output is always a closed 2-manifold.
export function marchingTets(values, dims, origin, h) {
  const [nx, ny, nz] = dims;
  const sx = 1, sy = nx, sz = nx * ny;
  const offs = [0, sx, sy, sx + sy, sz, sx + sz, sy + sz, sx + sy + sz]; // corner bit: x=1, y=2, z=4
  const tets = [];
  for (const [a, b] of [[1, 2], [1, 4], [2, 1], [2, 4], [4, 1], [4, 2]]) tets.push([0, a, a | b, 7]);
  const edgeType = new Map([[sx, 0], [sy, 1], [sz, 2], [sx + sy, 3], [sx + sz, 4], [sy + sz, 5], [sx + sy + sz, 6]]);
  const vmap = new Map();
  const pos = [];
  const idx = [];
  const gx = (g) => g % nx, gy = (g) => Math.floor(g / nx) % ny, gz = (g) => Math.floor(g / sz);

  const vert = (p, q) => {
    if (p > q) { const t = p; p = q; q = t; }
    const key = p * 7 + edgeType.get(q - p);
    let id = vmap.get(key);
    if (id !== undefined) return id;
    const vp = values[p], vq = values[q];
    let t = vp / (vp - vq);
    if (t < 1e-3) t = 1e-3; else if (t > 1 - 1e-3) t = 1 - 1e-3;
    const px = gx(p), py = gy(p), pz = gz(p);
    const qx = gx(q), qy = gy(q), qz = gz(q);
    id = pos.length / 3;
    pos.push(origin[0] + (px + (qx - px) * t) * h, origin[1] + (py + (qy - py) * t) * h, origin[2] + (pz + (qz - pz) * t) * h);
    vmap.set(key, id);
    return id;
  };

  const tri = (a, b, c, inC, outC) => {
    // orient so the normal points from the inside corners towards the outside corners
    const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
    const ux = pos[b * 3] - ax, uy = pos[b * 3 + 1] - ay, uz = pos[b * 3 + 2] - az;
    const vx = pos[c * 3] - ax, vy = pos[c * 3 + 1] - ay, vz = pos[c * 3 + 2] - az;
    const nX = uy * vz - uz * vy, nY = uz * vx - ux * vz, nZ = ux * vy - uy * vx;
    const dot = nX * (outC[0] - inC[0]) + nY * (outC[1] - inC[1]) + nZ * (outC[2] - inC[2]);
    if (dot >= 0) idx.push(a, b, c); else idx.push(a, c, b);
  };

  const corner = new Int32Array(8);
  const cval = new Float64Array(8);
  const ins = [], outs = [];
  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const base = i + sy * j + sz * k;
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          corner[c] = base + offs[c];
          cval[c] = values[corner[c]];
          if (cval[c] < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        for (const tet of tets) {
          ins.length = 0; outs.length = 0;
          for (const c of tet) (cval[c] < 0 ? ins : outs).push(c);
          if (ins.length === 0 || outs.length === 0) continue;
          const cen = (list) => {
            let x = 0, y = 0, z = 0;
            for (const c of list) { x += c & 1; y += (c >> 1) & 1; z += (c >> 2) & 1; }
            return [x / list.length, y / list.length, z / list.length];
          };
          const inC = cen(ins), outC = cen(outs);
          if (ins.length === 1 || outs.length === 1) {
            const lone = ins.length === 1 ? ins[0] : outs[0];
            const others = ins.length === 1 ? outs : ins;
            tri(vert(corner[lone], corner[others[0]]), vert(corner[lone], corner[others[1]]), vert(corner[lone], corner[others[2]]), inC, outC);
          } else {
            const [i0, i1] = ins, [o0, o1] = outs;
            const a = vert(corner[i0], corner[o0]), b = vert(corner[i0], corner[o1]);
            const c = vert(corner[i1], corner[o1]), d = vert(corner[i1], corner[o0]);
            tri(a, b, c, inC, outC);
            tri(a, c, d, inC, outC);
          }
        }
      }
    }
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}

// Remove tiny disconnected fragments (sampling noise), keeping real separate pieces.
export function dropFragments(mesh, minVolume) {
  const p = mesh.positions, t = mesh.indices;
  const nv = p.length / 3;
  const parent = new Int32Array(nv);
  for (let i = 0; i < nv; i++) parent[i] = i;
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const unite = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
  for (let i = 0; i < t.length; i += 3) { unite(t[i], t[i + 1]); unite(t[i], t[i + 2]); }
  const vol = new Map();
  for (let i = 0; i < t.length; i += 3) {
    const a = t[i] * 3, b = t[i + 1] * 3, c = t[i + 2] * 3;
    const v = (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6;
    const r = find(t[i]);
    vol.set(r, (vol.get(r) || 0) + v);
  }
  let dropped = 0;
  const keep = [];
  for (let i = 0; i < t.length; i += 3) {
    if (vol.get(find(t[i])) >= minVolume) keep.push(t[i], t[i + 1], t[i + 2]);
  }
  for (const v of vol.values()) if (v < minVolume) dropped++;
  if (!dropped) return mesh;
  // compact vertices
  const remap = new Int32Array(nv).fill(-1);
  const np = [];
  const ni = new Uint32Array(keep.length);
  for (let i = 0; i < keep.length; i++) {
    const v = keep[i];
    if (remap[v] < 0) { remap[v] = np.length / 3; np.push(p[v * 3], p[v * 3 + 1], p[v * 3 + 2]); }
    ni[i] = remap[v];
  }
  return { positions: new Float32Array(np), indices: ni, dropped };
}

// Taubin smoothing (no shrinking) followed by projection back onto the field's zero surface.
// Removes the faceted look of marching tetrahedra while keeping the surface where the field says.
// Topology is untouched, so the mesh stays closed. Vertices lying on the bed (z = 0) keep z = 0.
export function smoothProject(mesh, values, dims, origin, h, iterations = 4) {
  const p = mesh.positions, t = mesh.indices;
  const nv = p.length / 3;
  // vertex adjacency (CSR)
  const deg = new Uint32Array(nv);
  for (let i = 0; i < t.length; i++) deg[t[i]] += 2;
  const start = new Uint32Array(nv + 1);
  for (let i = 0; i < nv; i++) start[i + 1] = start[i] + deg[i];
  const fill = start.slice(0, nv);
  const nb = new Uint32Array(start[nv]);
  for (let i = 0; i < t.length; i += 3) {
    const a = t[i], b = t[i + 1], c = t[i + 2];
    nb[fill[a]++] = b; nb[fill[a]++] = c;
    nb[fill[b]++] = a; nb[fill[b]++] = c;
    nb[fill[c]++] = a; nb[fill[c]++] = b;
  }
  const onBed = new Uint8Array(nv);
  for (let i = 0; i < nv; i++) onBed[i] = p[i * 3 + 2] <= 1e-6 ? 1 : 0;
  const tmp = new Float32Array(p.length);
  const pass = (f) => {
    for (let i = 0; i < nv; i++) {
      let sx = 0, sy = 0, sz = 0;
      const s = start[i], e = start[i + 1];
      for (let k = s; k < e; k++) { const j = nb[k] * 3; sx += p[j]; sy += p[j + 1]; sz += p[j + 2]; }
      const n = e - s || 1;
      const o = i * 3;
      tmp[o] = p[o] + f * (sx / n - p[o]);
      tmp[o + 1] = p[o + 1] + f * (sy / n - p[o + 1]);
      tmp[o + 2] = onBed[i] ? 0 : p[o + 2] + f * (sz / n - p[o + 2]);
    }
    p.set(tmp);
  };
  for (let it = 0; it < iterations; it++) { pass(0.5); pass(-0.53); }

  // project onto the zero level set with a couple of Newton steps on the trilinear field
  const [nx, ny, nz] = dims;
  const sample = (x, y, z) => {
    let fx = (x - origin[0]) / h, fy = (y - origin[1]) / h, fz = (z - origin[2]) / h;
    fx = Math.min(Math.max(fx, 0), nx - 1.001); fy = Math.min(Math.max(fy, 0), ny - 1.001); fz = Math.min(Math.max(fz, 0), nz - 1.001);
    const i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz);
    const u = fx - i, v = fy - j, w = fz - k;
    const b = i + nx * (j + ny * k), sy = nx, sz = nx * ny;
    const c000 = values[b], c100 = values[b + 1], c010 = values[b + sy], c110 = values[b + 1 + sy];
    const c001 = values[b + sz], c101 = values[b + 1 + sz], c011 = values[b + sy + sz], c111 = values[b + 1 + sy + sz];
    const x00 = c000 + (c100 - c000) * u, x10 = c010 + (c110 - c010) * u, x01 = c001 + (c101 - c001) * u, x11 = c011 + (c111 - c011) * u;
    const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
    return y0 + (y1 - y0) * w;
  };
  const e = h * 0.5;
  for (let i = 0; i < nv; i++) {
    const o = i * 3;
    for (let step = 0; step < 2; step++) {
      const x = p[o], y = p[o + 1], z = p[o + 2];
      const f = sample(x, y, z);
      if (Math.abs(f) < 1e-4) break;
      const gx = (sample(x + e, y, z) - sample(x - e, y, z)) / (2 * e);
      const gy = (sample(x, y + e, z) - sample(x, y - e, z)) / (2 * e);
      const gz = onBed[i] ? 0 : (sample(x, y, z + e) - sample(x, y, z - e)) / (2 * e);
      const g2 = gx * gx + gy * gy + gz * gz;
      if (g2 < 1e-8) break;
      let s = f / g2;
      const maxMove = h * 0.5;
      const mv = Math.abs(s) * Math.sqrt(g2);
      if (mv > maxMove) s *= maxMove / mv;
      p[o] = x - s * gx; p[o + 1] = y - s * gy; p[o + 2] = onBed[i] ? 0 : Math.max(0, z - s * gz);
    }
  }
  return mesh;
}
