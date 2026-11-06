import * as THREE from 'three';
import { LAYER_PALETTE, LAYER_NAMES } from '../config.js';

const cols = LAYER_PALETTE.map((h) => new THREE.Color(h));

/** Farba vrstvy podľa hĺbky 0..1 (plynulý prechod paletou, jadro má vlastnú farbu). */
export function layerColor(depth01, out = new THREE.Color()) {
  if (depth01 >= 1) return out.copy(cols[cols.length - 1]);
  const x = depth01 * (cols.length - 2);
  const i = Math.floor(x);
  return out.copy(cols[i]).lerp(cols[Math.min(i + 1, cols.length - 2)], x - i);
}

export function layerName(depth01) {
  if (depth01 >= 1) return LAYER_NAMES[LAYER_NAMES.length - 1];
  return LAYER_NAMES[Math.min(LAYER_NAMES.length - 2, Math.floor(depth01 * (LAYER_NAMES.length - 1)))];
}
