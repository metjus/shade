import * as THREE from 'three';
import { FACES } from '../world/faces.js';
import { layerColor } from './palette.js';
import { lightFor } from './lights.js';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Stena kocky z diaľky: jedna plocha, mriežka blokov kreslená v shaderi (mizne, keď sú bloky menšie ako pixel)
// a prehľadová textúra, ktorá stmaví miesta, kde už hráči vyťažili bloky.
// V okne uWin sa stena nekreslí, tam sú skutočné 3D bloky (NearPatch).
const fragmentShader = /* glsl */ `
  uniform float uSize;
  uniform sampler2D uOverview;
  uniform vec3 uBase;
  uniform vec3 uHole;
  uniform vec3 uLight;
  uniform vec4 uWin;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv * uSize;
    if (c.x >= uWin.x && c.x < uWin.z && c.y >= uWin.y && c.y < uWin.w) discard;
    float m = texture2D(uOverview, vUv).r;
    vec3 col = mix(uBase, uHole, m);
    vec2 g = abs(fract(c) - 0.5);
    vec2 fw = fwidth(c);
    float lw = 0.06;
    vec2 edge = smoothstep(vec2(0.5 - lw) - fw, vec2(0.5 - lw), g);
    float fade = 1.0 - smoothstep(0.12, 0.45, max(fw.x, fw.y));
    col *= 1.0 - 0.45 * max(edge.x, edge.y) * fade;
    col *= uLight;
    gl_FragColor = linearToOutputTexel(vec4(col, 1.0));
  }
`;

export class FarCube {
  constructor(scene, state) {
    this.state = state;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.faces = [];
    this.rebuild();
  }

  rebuild() {
    for (const m of this.faces) { m.geometry.dispose(); m.material.dispose(); this.group.remove(m); }
    this.faces = [];
    const st = this.state, s = st.size, h = s / 2, R = st.overviewRes;
    const base = layerColor(st.depth01);
    const next = st.isCore ? new THREE.Color(0x000000) : layerColor(Math.min(1, (st.layer + 1) / (st.layerCount - 1)));
    const hole = next.clone().multiplyScalar(0.55);

    for (let f = 0; f < 6; f++) {
      const F = FACES[f];
      const corner = (u, v) => F.n.clone().multiplyScalar(h).addScaledVector(F.a, u - h).addScaledVector(F.b, v - h);
      const pts = [corner(0, 0), corner(s, 0), corner(0, s), corner(s, s)];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap((p) => [p.x, p.y, p.z]), 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
      geo.setIndex([0, 1, 2, 2, 1, 3]);
      geo.computeBoundingSphere();

      const tex = new THREE.DataTexture(st.overview[f], R, R, THREE.RedFormat, THREE.UnsignedByteType);
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearFilter;
      tex.unpackAlignment = 1;
      tex.needsUpdate = true;

      const mat = new THREE.ShaderMaterial({
        vertexShader, fragmentShader,
        uniforms: {
          uSize: { value: s },
          uOverview: { value: tex },
          uBase: { value: base.clone() },
          uHole: { value: hole },
          uLight: { value: lightFor(F.n) },
          uWin: { value: new THREE.Vector4(-1, -1, -1, -1) },
        },
      });
      const mesh = new THREE.Mesh(geo, mat);
      this.group.add(mesh);
      this.faces.push(mesh);
    }
  }

  /** Okno (v blokoch), kde sa stena nekreslí, lebo ho nahrádzajú 3D bloky. f = -1 vypne okno. */
  setWindow(f, u0, v0, u1, v1) {
    this.faces.forEach((m, i) => m.material.uniforms.uWin.value.set(...(i === f ? [u0, v0, u1, v1] : [-1, -1, -1, -1])));
  }

  update() {
    const st = this.state;
    if (!st.dirtyOverview.size) return;
    for (const f of st.dirtyOverview) this.faces[f].material.uniforms.uOverview.value.needsUpdate = true;
    st.dirtyOverview.clear();
  }
}
