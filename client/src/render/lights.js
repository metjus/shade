import * as THREE from 'three';

// Jedno nastavenie svetiel pre 3D bloky aj pre steny z diaľky, aby mali rovnaký odtieň.
// three.js počíta difúzne svetlo s 1/π, preto sú intenzity v scéne násobené π.
export const AMBIENT = { color: new THREE.Color(0x8a80a0), intensity: 0.6 };
export const SUN = { color: new THREE.Color(0xffffff), intensity: 0.85, dir: new THREE.Vector3(0.45, 0.8, 0.55).normalize() };
export const RIM = { color: new THREE.Color(0xa58bff), intensity: 0.35, dir: new THREE.Vector3(-0.6, -0.3, 0.7).normalize() };

export function addLights(scene) {
  scene.add(new THREE.AmbientLight(AMBIENT.color, AMBIENT.intensity * Math.PI));
  for (const L of [SUN, RIM]) {
    const d = new THREE.DirectionalLight(L.color, L.intensity * Math.PI);
    d.position.copy(L.dir);
    scene.add(d);
  }
}

/** Celkové osvetlenie plochy s normálou n (rovnaký výsledok ako matný materiál v scéne). */
export function lightFor(n) {
  const out = AMBIENT.color.clone().multiplyScalar(AMBIENT.intensity);
  out.add(SUN.color.clone().multiplyScalar(SUN.intensity * Math.max(0, n.dot(SUN.dir))));
  out.add(RIM.color.clone().multiplyScalar(RIM.intensity * Math.max(0, n.dot(RIM.dir))));
  return out;
}
