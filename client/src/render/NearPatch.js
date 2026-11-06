import * as THREE from 'three';
import { WINDOW } from '../config.js';
import { cellCenter, FACES } from '../world/faces.js';
import { layerColor } from './palette.js';

const MINED = 255;

function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Textúra praskliny v troch stupňoch (2, 4 a 7 ramien, posledný stupeň s odbočkami).
function crackTexture(stage) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = rng(1337);
  const arms = [2, 4, 7][stage], len = [26, 40, 58][stage];
  const paths = [];
  for (let i = 0; i < arms; i++) {
    let x = 64 + (r() - 0.5) * 14, y = 64 + (r() - 0.5) * 14, a = (i / arms) * Math.PI * 2 + r() * 0.8;
    const p = [[x, y]];
    const steps = 4 + Math.floor(r() * 3);
    for (let s = 0; s < steps; s++) {
      a += (r() - 0.5) * 0.9;
      const d = (len / steps) * (0.7 + r() * 0.6);
      x += Math.cos(a) * d; y += Math.sin(a) * d;
      p.push([x, y]);
      if (stage === 2 && s === 2 && r() < 0.6) {
        let bx = x, by = y, ba = a + (r() < 0.5 ? 1 : -1) * 0.9;
        const b = [[bx, by]];
        for (let k = 0; k < 3; k++) { ba += (r() - 0.5) * 0.8; bx += Math.cos(ba) * 7; by += Math.sin(ba) * 7; b.push([bx, by]); }
        paths.push(b);
      }
    }
    paths.push(p);
  }
  g.lineCap = 'round'; g.lineJoin = 'round';
  const stroke = (col, w, o) => {
    g.strokeStyle = col; g.lineWidth = w;
    for (const p of paths) { g.beginPath(); g.moveTo(p[0][0] + o, p[0][1] + o); for (const q of p.slice(1)) g.lineTo(q[0] + o, q[1] + o); g.stroke(); }
  };
  stroke('rgba(200,180,255,.22)', 3.2, 1.2);
  stroke('rgba(0,0,0,.9)', [2, 2.6, 3.2][stage], 0);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

// Povrch bloku: tmavší okraj (škára) a jemné svetlo na hornej hrane. Bloky sa dotýkajú, takže nevidno pozadie.
function blockTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,1)';
  g.fillRect(3, 3, 58, 4);
  g.fillStyle = 'rgba(0,0,0,.10)';
  g.fillRect(3, 55, 58, 6);
  g.strokeStyle = 'rgba(0,0,0,.55)';
  g.lineWidth = 4;
  g.strokeRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * Detailné 3D bloky v okne okolo miesta, kam sa hráč pozerá zblízka.
 * Mimo okna kreslí stenu FarCube, takže počet blokov na obrazovke ostáva malý aj pri obrovskej kocke.
 */
export class NearPatch {
  constructor(scene, state) {
    this.state = state;
    const cap = WINDOW * WINDOW;
    this.blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ map: blockTexture() }), cap);
    for (let i = 0; i < cap; i++) this.blocks.setColorAt(i, new THREE.Color(0));
    this.blocks.frustumCulled = false;
    this.blocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.blocks);

    const crackGeo = new THREE.BoxGeometry(1.012, 1.012, 1.012);
    this.cracks = [0, 1, 2].map((s) => {
      const m = new THREE.InstancedMesh(crackGeo, new THREE.MeshBasicMaterial({
        map: crackTexture(s), transparent: true, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      }), cap);
      m.frustumCulled = false;
      m.count = 0;
      scene.add(m);
      return m;
    });

    this.hover = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.03, 1.03, 1.03)),
      new THREE.LineBasicMaterial({ color: 0x63e6d4, transparent: true, opacity: 0.9 }),
    );
    this.hover.visible = false;
    scene.add(this.hover);

    this.f = -1; this.u0 = 0; this.v0 = 0; this.w = 0;
    this.active = false;
    this.dirty = true;
    this.kicks = new Map(); // kľúč bloku -> sila cuknutia 1..0
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.pos = new THREE.Vector3();

    state.onChange((f, u, v, res) => {
      if (!this.active || f !== this.f) return;
      if (u < this.u0 || v < this.v0 || u >= this.u0 + this.w || v >= this.v0 + this.w) return;
      if (!res.killed) this.kicks.set(v * 65536 + u, 1);
      else this.kicks.delete(v * 65536 + u);
      this.dirty = true;
    });
  }

  setActive(on) {
    this.active = on;
    this.blocks.visible = on;
    for (const c of this.cracks) c.visible = on;
    if (!on) this.hover.visible = false;
  }

  /** Posunie okno tak, aby jeho stred bol blízko bloku (cu, cv) na stene f. Vráti true, ak sa okno zmenilo. */
  focus(f, cu, cv) {
    const s = this.state.size, w = Math.min(WINDOW, s);
    const inside = f === this.f && w === this.w
      && Math.abs(cu - (this.u0 + w / 2)) < w / 2 - 20
      && Math.abs(cv - (this.v0 + w / 2)) < w / 2 - 20;
    if (inside) return false;
    this.f = f; this.w = w;
    this.u0 = Math.max(0, Math.min(s - w, Math.round(cu - w / 2)));
    this.v0 = Math.max(0, Math.min(s - w, Math.round(cv - w / 2)));
    this.kicks.clear();
    this.dirty = true;
    return true;
  }

  reset() { this.f = -1; this.dirty = true; this.kicks.clear(); }

  contains(f, u, v) {
    return f === this.f && u >= this.u0 && v >= this.v0 && u < this.u0 + this.w && v < this.v0 + this.w;
  }

  /** Obrys plochy, ktorú zasiahne úder (w × h blokov podľa krompáča). */
  setHover(hit, w = 1, h = 1) {
    const st = this.state;
    if (!hit || !this.active || !this.contains(hit.f, hit.u, hit.v) || st.isMined(hit.f, hit.u, hit.v)) { this.hover.visible = false; return; }
    const F = FACES[hit.f];
    cellCenter(hit.f, hit.u, hit.v, st.size, 0, this.hover.position);
    const ou = -Math.floor((w - 1) / 2) + (w - 1) / 2, ov = -Math.floor((h - 1) / 2) + (h - 1) / 2;
    this.hover.position.addScaledVector(F.a, ou).addScaledVector(F.b, ov);
    const abs = (v) => new THREE.Vector3(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z));
    this.hover.scale.copy(abs(F.n)).add(abs(F.a).multiplyScalar(w)).add(abs(F.b).multiplyScalar(h));
    this.hover.visible = true;
  }

  update() {
    if (!this.active) return;
    if (this.kicks.size) {
      for (const [k, val] of this.kicks) { const n = val - 0.12; if (n <= 0) this.kicks.delete(k); else this.kicks.set(k, n); }
      this.dirty = true;
    }
    if (!this.dirty || this.f < 0) return;
    this.dirty = false;
    this.rebuild();
  }

  rebuild() {
    const st = this.state, s = st.size, f = this.f, F = FACES[f];
    const base = layerColor(st.depth01);
    const below = st.isCore ? null : layerColor(Math.min(1, (st.layer + 1) / (st.layerCount - 1))).multiplyScalar(0.8);
    const { dummy, color, pos } = this;
    const black = new THREE.Color(0);
    let n = 0;
    const cn = [0, 0, 0];
    const q = new THREE.Quaternion();
    const up = F.n;

    for (let v = this.v0; v < this.v0 + this.w; v++) {
      for (let u = this.u0; u < this.u0 + this.w; u++) {
        const c = st.cell(f, u, v);
        if (c !== MINED) {
          const kick = this.kicks.get(v * 65536 + u) || 0;
          const sc = 1 - 0.14 * kick;
          cellCenter(f, u, v, s, 0, pos);
          dummy.position.copy(pos);
          dummy.quaternion.identity();
          dummy.scale.setScalar(sc);
          dummy.updateMatrix();
          this.blocks.setMatrixAt(n, dummy.matrix);
          color.copy(base).lerp(black, (c / st.hp) * 0.35);
          this.blocks.setColorAt(n, color);
          n++;
          if (c > 0) {
            const stage = Math.min(2, Math.floor((c / st.hp) * 3));
            // náhodné otočenie praskliny podľa súradníc, aby nevyzerali všetky rovnako
            const rot = ((u * 73856093) ^ (v * 19349663)) & 3;
            q.setFromAxisAngle(up, (rot * Math.PI) / 2);
            dummy.quaternion.copy(q);
            dummy.updateMatrix();
            this.cracks[stage].setMatrixAt(cn[stage]++, dummy.matrix);
          }
        } else if (below) {
          cellCenter(f, u, v, s, 1, pos);
          dummy.position.copy(pos);
          dummy.quaternion.identity();
          dummy.scale.setScalar(1);
          dummy.updateMatrix();
          this.blocks.setMatrixAt(n, dummy.matrix);
          this.blocks.setColorAt(n, below);
          n++;
        }
      }
    }
    this.blocks.count = n;
    this.blocks.instanceMatrix.needsUpdate = true;
    this.blocks.instanceColor.needsUpdate = true;
    this.cracks.forEach((m, i) => { m.count = cn[i]; m.instanceMatrix.needsUpdate = true; });
  }
}
