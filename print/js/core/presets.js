// Parametric organic model presets. Each preset turns parameters into a scene of SDF shapes,
// where every shape belongs to a color part. Units mm, Z up, the model stands on z = 0.
import { sphere, ellipsoid, roundCone, capsule, torus, roundCylinder, intersect, halfSpaceAbove } from './sdf.js';

export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const norm = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; };
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];

export const PRESETS = [
  {
    id: 'mushroom',
    name: 'Hríb',
    parts: [
      { name: 'Noha', color: '#f1e4c8' },
      { name: 'Klobúk', color: '#d62828' },
      { name: 'Bodky', color: '#ffffff' },
    ],
    params: [
      { id: 'height', label: 'Výška', min: 25, max: 120, step: 1, value: 50, unit: 'mm' },
      { id: 'cap', label: 'Šírka klobúka', min: 25, max: 120, step: 1, value: 48, unit: 'mm' },
      { id: 'stem', label: 'Hrúbka nohy', min: 0.6, max: 1.6, step: 0.05, value: 1 },
      { id: 'spots', label: 'Počet bodiek', min: 0, max: 16, step: 1, value: 8 },
      { id: 'seed', label: 'Náhoda', min: 1, max: 999, step: 1, value: 7 },
    ],
    build(p) {
      const r = rng(p.seed);
      const H = p.height, W = p.cap;
      const sr = W * 0.15 * p.stem;
      const capZ = H * 0.62, capRz = H * 0.4;
      const shapes = [
        { prim: roundCone([0, 0, 0], [0, 0, capZ], sr * 1.25, sr * 0.9), part: 0 },
        { prim: ellipsoid([0, 0, sr * 0.4], [sr * 1.45, sr * 1.45, sr * 0.8]), part: 0, k: sr * 0.6 },
        { prim: intersect(ellipsoid([0, 0, capZ], [W / 2, W / 2, capRz]), halfSpaceAbove(capZ - capRz * 0.2)), part: 1, k: Math.min(3, sr * 0.4) },
      ];
      const placed = [];
      for (let tries = 0; placed.length < p.spots && tries < 400; tries++) {
        const rs = W * (0.05 + r() * 0.035);
        const e = (12 + r() * 70) * (Math.PI / 180);
        const a = r() * Math.PI * 2;
        const surf = [Math.cos(e) * Math.cos(a) * W / 2, Math.cos(e) * Math.sin(a) * W / 2, capZ + Math.sin(e) * capRz];
        if (placed.some((q) => Math.hypot(q.c[0] - surf[0], q.c[1] - surf[1], q.c[2] - surf[2]) < (q.r + rs) * 1.25)) continue;
        const n = norm(surf[0] / (W * W), surf[1] / (W * W), (surf[2] - capZ) / (capRz * capRz));
        const c = add(surf, n, -rs * 0.55);
        placed.push({ c: surf, r: rs });
        shapes.push({ prim: sphere(c, rs), part: 2, k: 0.3 });
      }
      return shapes;
    },
  },
  {
    id: 'bird',
    name: 'Vtáčik',
    parts: [
      { name: 'Telo', color: '#4ea8de' },
      { name: 'Bruško', color: '#ffe8a3' },
      { name: 'Zobák a nôžky', color: '#f4a259' },
      { name: 'Oči', color: '#1b1b1b' },
      { name: 'Krídla a chvost', color: '#2b6cb0' },
    ],
    params: [
      { id: 'size', label: 'Veľkosť', min: 30, max: 120, step: 1, value: 55, unit: 'mm' },
      { id: 'chubby', label: 'Bucľatosť', min: 0.8, max: 1.3, step: 0.05, value: 1 },
      { id: 'head', label: 'Veľkosť hlavy', min: 0.8, max: 1.3, step: 0.05, value: 1 },
      { id: 'tail', label: 'Dĺžka chvosta', min: 0.5, max: 1.6, step: 0.05, value: 1 },
    ],
    build(p) {
      const S = p.size, c = p.chubby, hd = p.head;
      const head = [0.25 * S, 0, 0.7 * S];
      const hr = 0.24 * S * hd;
      const eyeDir = (s) => norm(0.72, 0.5 * s, 0.38);
      const shapes = [
        { prim: ellipsoid([0, 0, 0.33 * S], [0.42 * S, 0.34 * S * c, 0.36 * S * c]), part: 0 },
        { prim: sphere(head, hr), part: 0, k: 0.1 * S },
        { prim: ellipsoid([0.12 * S, 0, 0.3 * S], [0.33 * S, 0.27 * S * c, 0.28 * S * c]), part: 1 },
        { prim: roundCone(add(head, [1, 0, 0], hr * 0.85), add(head, norm(1, 0, -0.08), hr + 0.15 * S), 0.075 * S, Math.max(0.6, 0.02 * S)), part: 2, k: 0.02 * S },
        { prim: ellipsoid([0.1 * S, 0.1 * S, 0.015 * S], [0.09 * S, 0.04 * S, 0.035 * S]), part: 2, k: 0.02 * S },
        { prim: ellipsoid([0.1 * S, -0.1 * S, 0.015 * S], [0.09 * S, 0.04 * S, 0.035 * S]), part: 2, k: 0.02 * S },
        { prim: ellipsoid([-0.44 * S - 0.08 * S * (p.tail - 1), 0, 0.45 * S], [0.2 * S * p.tail, 0.13 * S, 0.05 * S], [0, -25, 0]), part: 4, k: 0.06 * S },
      ];
      for (const s of [1, -1]) {
        const ed = eyeDir(s);
        shapes.push({ prim: sphere(add(head, ed, hr * 0.92), 0.05 * S * hd), part: 3 });
        shapes.push({ prim: ellipsoid([-0.05 * S, 0.3 * S * c * s, 0.4 * S], [0.27 * S, 0.07 * S, 0.17 * S], [12 * s, -18, 0]), part: 4, k: 0.03 * S });
      }
      return shapes;
    },
  },
  {
    id: 'caterpillar',
    name: 'Húsenica',
    parts: [
      { name: 'Telo A', color: '#7bc950' },
      { name: 'Telo B', color: '#3f8f2a' },
      { name: 'Hlava', color: '#9ad66b' },
      { name: 'Oči', color: '#ffffff' },
      { name: 'Zreničky a tykadlá', color: '#222222' },
    ],
    params: [
      { id: 'segments', label: 'Počet článkov', min: 3, max: 10, step: 1, value: 6 },
      { id: 'radius', label: 'Hrúbka', min: 5, max: 14, step: 0.5, value: 8, unit: 'mm' },
      { id: 'wave', label: 'Vlnenie', min: 0, max: 1, step: 0.05, value: 0.6 },
    ],
    build(p) {
      const n = p.segments, R = p.radius;
      const step = R * 1.45;
      const ox = -(n * step) / 2;
      const shapes = [];
      for (let i = 0; i < n; i++) {
        const rr = R * (0.82 + 0.18 * Math.sin(((i + 1) / (n + 1)) * Math.PI));
        const c = [ox + i * step, p.wave * R * 0.8 * Math.sin(i * 0.9), rr * 0.85 + p.wave * R * 0.35 * Math.abs(Math.sin(i * 0.9 + 0.8))];
        shapes.push({ prim: sphere(c, rr), part: i % 2, k: R * 0.35 });
      }
      const HR = R * 1.25;
      const H = [ox + n * step + R * 0.15, p.wave * R * 0.8 * Math.sin(n * 0.9), R * 1.7];
      shapes.push({ prim: sphere(H, HR), part: 2, k: R * 0.4 });
      for (const s of [1, -1]) {
        const d = norm(0.8, 0.42 * s, 0.3);
        shapes.push({ prim: sphere(add(H, d, HR * 0.9), HR * 0.24), part: 3, k: 0.2 });
        shapes.push({ prim: sphere(add(H, d, HR * 0.9 + HR * 0.19), HR * 0.11), part: 4, k: 0.1 });
        const a0 = add(H, norm(0.15, 0.4 * s, 0.9), HR * 0.85);
        const a1 = add(H, norm(0.35, 0.55 * s, 0.9), HR * 1.75);
        shapes.push({ prim: capsule(a0, a1, Math.max(1.1, HR * 0.09)), part: 4, k: 0.4 });
        shapes.push({ prim: sphere(a1, Math.max(1.8, HR * 0.18)), part: 4, k: 0.3 });
      }
      return shapes;
    },
  },
  {
    id: 'cactus',
    name: 'Kaktus v kvetináči',
    parts: [
      { name: 'Kvetináč', color: '#c8693a' },
      { name: 'Hlina', color: '#5a3b22' },
      { name: 'Kaktus', color: '#3a9d5d' },
      { name: 'Kvet', color: '#ff6fa8' },
      { name: 'Stred kvetu', color: '#ffd23f' },
    ],
    params: [
      { id: 'height', label: 'Výška kaktusu', min: 35, max: 120, step: 1, value: 60, unit: 'mm' },
      { id: 'thick', label: 'Hrúbka kaktusu', min: 5, max: 12, step: 0.5, value: 7.5, unit: 'mm' },
      { id: 'arms', label: 'Počet ramien', min: 0, max: 3, step: 1, value: 2 },
      { id: 'flower', label: 'Kvet (0/1)', min: 0, max: 1, step: 1, value: 1 },
      { id: 'seed', label: 'Náhoda', min: 1, max: 999, step: 1, value: 3 },
    ],
    build(p) {
      const r = rng(p.seed);
      const H = p.height, Rc = p.thick;
      const potR0 = Math.max(13, Rc * 1.9), potR1 = potR0 * 1.22, potH = potR0 * 1.1;
      const shapes = [
        { prim: roundCylinder([0, 0], potR0, potR1, 0, potH, 1.5), part: 0 },
        { prim: torus([0, 0, potH], potR1 - 0.5, 2), part: 0, k: 1 },
        { prim: roundCylinder([0, 0], potR1 - 1.8, potR1 - 1.8, potH - 4, potH + 1, 0.8), part: 1 },
        { prim: capsule([0, 0, potH - 2], [0, 0, H], Rc), part: 2, k: 1.5 },
      ];
      let a = r() * Math.PI * 2;
      for (let i = 0; i < p.arms; i++) {
        a += 2.4 + r() * 0.6;
        const zs = potH + (H - potH) * (0.3 + 0.22 * i + r() * 0.1);
        const reach = Rc * 1.7;
        const ra = Rc * 0.62;
        const elbow = [Math.cos(a) * reach, Math.sin(a) * reach, zs + ra * 0.6];
        const top = [elbow[0], elbow[1], Math.min(H - 2, zs + (H - zs) * 0.6 + ra * 1.5)];
        shapes.push({ prim: capsule([0, 0, zs], elbow, ra), part: 2, k: ra * 0.6 });
        shapes.push({ prim: capsule(elbow, top, ra), part: 2, k: ra * 0.5 });
      }
      if (p.flower) {
        const fc = [0, 0, H + Rc * 0.75];
        const pr = Math.max(2.2, Rc * 0.36);
        for (let i = 0; i < 5; i++) {
          const ang = (i / 5) * Math.PI * 2 + r();
          shapes.push({ prim: sphere([Math.cos(ang) * pr * 1.3, Math.sin(ang) * pr * 1.3, fc[2]], pr), part: 3, k: 0.5 });
        }
        shapes.push({ prim: sphere([0, 0, fc[2] + pr * 0.45], pr * 0.85), part: 4, k: 0.3 });
      }
      return shapes;
    },
  },
  {
    id: 'octopus',
    name: 'Chobotnička',
    parts: [
      { name: 'Telo', color: '#e76f9a' },
      { name: 'Oči', color: '#ffffff' },
      { name: 'Zreničky', color: '#1b1b1b' },
      { name: 'Líčka', color: '#ffb3c7' },
    ],
    params: [
      { id: 'size', label: 'Veľkosť', min: 30, max: 120, step: 1, value: 55, unit: 'mm' },
      { id: 'legs', label: 'Počet chápadiel', min: 5, max: 10, step: 1, value: 8 },
      { id: 'curl', label: 'Zatočenie chápadiel', min: 0, max: 1.5, step: 0.05, value: 0.8 },
      { id: 'seed', label: 'Náhoda', min: 1, max: 999, step: 1, value: 11 },
    ],
    build(p) {
      const r = rng(p.seed);
      const S = p.size;
      const hc = [0, 0, 0.55 * S], hr = [0.34 * S, 0.34 * S, 0.4 * S];
      const shapes = [
        { prim: ellipsoid(hc, hr), part: 0 },
        { prim: sphere([0, 0, 0.24 * S], 0.29 * S), part: 0, k: 0.15 * S },
      ];
      const M = 7;
      for (let t = 0; t < p.legs; t++) {
        const a0 = (t / p.legs) * Math.PI * 2 + Math.PI / p.legs;
        const dir = r() < 0.5 ? 1 : -1;
        let prev = null, prevR = 0;
        for (let m = 0; m <= M; m++) {
          const u = m / M;
          const ang = a0 + dir * p.curl * u * u * 1.6;
          const rad = 0.18 * S + u * 0.42 * S;
          const z = 0.16 * S * (1 - u) + 0.045 * S + (u > 0.8 ? (u - 0.8) * 0.35 * S * p.curl : 0);
          const c = [Math.cos(ang) * rad, Math.sin(ang) * rad, z];
          const rr = Math.max(1.2, 0.085 * S * (1 - u * 0.62));
          if (prev) shapes.push({ prim: roundCone(prev, c, prevR, rr), part: 0, k: 0.03 * S });
          prev = c; prevR = rr;
        }
      }
      const onHead = (d, out = 0) => [hc[0] + d[0] * (hr[0] + out), hc[1] + d[1] * (hr[1] + out), hc[2] + d[2] * (hr[2] + out)];
      for (const s of [1, -1]) {
        const d = norm(0.9, 0.36 * s, 0.05);
        shapes.push({ prim: sphere(onHead(d, -0.045 * S), 0.1 * S), part: 1, k: 0.2 });
        shapes.push({ prim: sphere(onHead(d, 0.035 * S), 0.05 * S), part: 2, k: 0.15 });
        const cd = norm(0.82, 0.55 * s, -0.25);
        shapes.push({ prim: ellipsoid(onHead(cd, -0.02 * S), [0.035 * S, 0.06 * S, 0.04 * S], [0, 0, 34 * s]), part: 3 });
      }
      return shapes;
    },
  },
];

export function presetById(id) {
  return PRESETS.find((p) => p.id === id) || PRESETS[0];
}

export function defaultParams(preset) {
  return Object.fromEntries(preset.params.map((q) => [q.id, q.value]));
}

export function makeScene(preset, params, colors) {
  const p = { ...defaultParams(preset), ...params };
  return {
    name: preset.name,
    parts: preset.parts.map((part, i) => ({ name: part.name, color: (colors && colors[i]) || part.color })),
    shapes: preset.build(p),
  };
}
