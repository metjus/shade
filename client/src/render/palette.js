import * as THREE from 'three';
import { LAYER_COLORS, CORE_COLOR, LAYER_NAMES } from '../config.js';

const cols = LAYER_COLORS.map((h) => new THREE.Color(h));
const core = new THREE.Color(CORE_COLOR);
const black = new THREE.Color(0);

/** Farba vrstvy podľa jej poradia: farby sa striedajú dokola a smerom k jadru tmavnú. */
export function layerColorAt(layer, layerCount, out = new THREE.Color()) {
  if (layer >= layerCount - 1) return out.copy(core);
  const depth01 = layerCount <= 1 ? 0 : layer / (layerCount - 1);
  return out.copy(cols[layer % cols.length]).lerp(black, depth01 * 0.45);
}

/** Farba aktuálnej vrstvy (offset 0) alebo vrstvy pod ňou (offset 1). */
export function stateColor(st, offset = 0, out = new THREE.Color()) {
  return layerColorAt(st.layer + offset, st.layerCount, out);
}

export function layerName(depth01) {
  if (depth01 >= 1) return LAYER_NAMES[LAYER_NAMES.length - 1];
  return LAYER_NAMES[Math.min(LAYER_NAMES.length - 2, Math.floor(depth01 * (LAYER_NAMES.length - 1)))];
}
