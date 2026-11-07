// Printability checks on an indexed triangle mesh { positions: Float32Array, indices: Uint32Array }.

export function analyzeMesh(mesh) {
  const p = mesh.positions, t = mesh.indices;
  const nv = p.length / 3;
  let vol = 0;
  const bbox = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < nv; i++) {
    for (let c = 0; c < 3; c++) {
      const v = p[i * 3 + c];
      if (v < bbox[c]) bbox[c] = v;
      if (v > bbox[c + 3]) bbox[c + 3] = v;
    }
  }
  // directed edge counts: manifold & watertight <=> every directed edge appears once and its reverse once
  const edges = new Map();
  const key = (a, b) => a * nv + b;
  for (let i = 0; i < t.length; i += 3) {
    const a = t[i], b = t[i + 1], c = t[i + 2];
    const ax = p[a * 3], ay = p[a * 3 + 1], az = p[a * 3 + 2];
    const bx = p[b * 3], by = p[b * 3 + 1], bz = p[b * 3 + 2];
    const cx = p[c * 3], cy = p[c * 3 + 1], cz = p[c * 3 + 2];
    vol += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
    for (const [u, w] of [[a, b], [b, c], [c, a]]) {
      const k = key(u, w);
      edges.set(k, (edges.get(k) || 0) + 1);
    }
  }
  let openEdges = 0, badEdges = 0;
  for (const [k, cnt] of edges) {
    if (cnt > 1) badEdges++;
    const a = Math.floor(k / nv), b = k - a * nv;
    if (!edges.has(key(b, a))) openEdges++;
  }

  // connected components (islands)
  const parent = new Int32Array(nv);
  for (let i = 0; i < nv; i++) parent[i] = i;
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (let i = 0; i < t.length; i += 3) {
    const r0 = find(t[i]);
    const r1 = find(t[i + 1]); if (r1 !== r0) parent[r1] = r0;
    const r2 = find(t[i + 2]); if (r2 !== find(r0)) parent[r2] = find(r0);
  }
  const roots = new Set();
  for (let i = 0; i < t.length; i++) roots.add(find(t[i]));

  return { volume: vol, bbox, openEdges, badEdges, islands: roots.size, watertight: openEdges === 0 && badEdges === 0 };
}
