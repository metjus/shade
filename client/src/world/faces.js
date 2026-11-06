import * as THREE from 'three';

// Šesť stien kocky. Každá má normálu n a dve osi a, b, ktoré určujú súradnice bloku (u, v) na stene.
// Platí a × b = n, takže všetky steny majú rovnakú orientáciu zvonka.
export const FACES = [
  { n: [1, 0, 0], a: [0, 0, -1], b: [0, 1, 0] },
  { n: [-1, 0, 0], a: [0, 0, 1], b: [0, 1, 0] },
  { n: [0, 1, 0], a: [1, 0, 0], b: [0, 0, -1] },
  { n: [0, -1, 0], a: [1, 0, 0], b: [0, 0, 1] },
  { n: [0, 0, 1], a: [1, 0, 0], b: [0, 1, 0] },
  { n: [0, 0, -1], a: [-1, 0, 0], b: [0, 1, 0] },
].map((f) => ({
  n: new THREE.Vector3(...f.n),
  a: new THREE.Vector3(...f.a),
  b: new THREE.Vector3(...f.b),
}));

const tmp = new THREE.Vector3();

/** Stred bloku (u, v) na stene f, pre kocku so stranou size; depth 0 = povrch, 1 = blok pod ním. */
export function cellCenter(f, u, v, size, depth = 0, out = new THREE.Vector3()) {
  const F = FACES[f];
  const h = size / 2;
  out.copy(F.n).multiplyScalar(h - 0.5 - depth);
  out.addScaledVector(F.a, u + 0.5 - h);
  out.addScaledVector(F.b, v + 0.5 - h);
  return out;
}

/**
 * Priesečník lúča s kockou so stranou size (stred v počiatku).
 * Vráti { f, u, v, point, t } pre prvú zasiahnutú stenu alebo null.
 */
export function rayHitCube(ray, size) {
  const h = size / 2;
  let best = null;
  for (let f = 0; f < 6; f++) {
    const F = FACES[f];
    const denom = ray.direction.dot(F.n);
    if (denom >= 0) continue; // stena je odvrátená
    const t = (h - ray.origin.dot(F.n)) / denom;
    if (t < 0 || (best && t >= best.t)) continue;
    tmp.copy(ray.direction).multiplyScalar(t).add(ray.origin);
    const pa = tmp.dot(F.a) + h;
    const pb = tmp.dot(F.b) + h;
    if (pa < 0 || pb < 0 || pa > size || pb > size) continue;
    best = { f, u: Math.min(size - 1, Math.floor(pa)), v: Math.min(size - 1, Math.floor(pb)), point: tmp.clone(), t };
  }
  return best;
}
