import * as THREE from 'three';

const DMAX = 1200;

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Úlomky a záblesky pri údere a rozbití bloku. Gravitácia smeruje do stredu kocky. */
export class Effects {
  constructor(scene) {
    this.debris = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), DMAX);
    for (let i = 0; i < DMAX; i++) this.debris.setColorAt(i, new THREE.Color(0));
    this.debris.count = 0;
    this.debris.frustumCulled = false;
    this.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.debris);
    this.parts = [];

    const tex = glowTexture();
    this.flashes = [];
    for (let i = 0; i < 32; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
      s.visible = false;
      scene.add(s);
      this.flashes.push({ s, t: 1, big: false });
    }
    this.q = new THREE.Quaternion();
    this.sc = new THREE.Vector3();
    this.m = new THREE.Matrix4();
  }

  /** p = svetová pozícia, normal = smer von zo steny (úlomky letia von a padajú späť). */
  burst(p, normal, color, n, speed, size) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length >= DMAX) this.parts.shift();
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().addScaledVector(normal, 1.1).normalize();
      this.parts.push({
        p: p.clone().addScaledVector(normal, 0.4),
        v: dir.multiplyScalar(speed * (0.6 + Math.random() * 0.8)),
        g: normal.clone().multiplyScalar(-0.006),
        r: new THREE.Euler(Math.random() * 3, Math.random() * 3, 0),
        w: new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4),
        life: 1,
        decay: 0.018 + Math.random() * 0.018,
        size: size * (0.6 + Math.random() * 0.7),
        col: new THREE.Color(color),
      });
    }
  }

  flash(p, color, big) {
    const f = this.flashes.find((x) => x.t >= 1) || this.flashes[0];
    f.t = 0;
    f.big = big;
    f.s.position.copy(p);
    f.s.material.color.copy(color).lerp(new THREE.Color(0xffffff), 0.35);
    f.s.visible = true;
  }

  update() {
    const { q, sc, m } = this;
    let n = 0;
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const p of this.parts) {
      p.v.add(p.g);
      p.v.multiplyScalar(0.985);
      p.p.add(p.v);
      p.r.x += p.w.x; p.r.y += p.w.y; p.r.z += p.w.z;
      p.life -= p.decay;
      const s = p.size * Math.min(1, p.life * 2.2);
      q.setFromEuler(p.r);
      sc.set(s, s, s);
      m.compose(p.p, q, sc);
      this.debris.setMatrixAt(n, m);
      this.debris.setColorAt(n, p.col);
      n++;
    }
    this.debris.count = n;
    this.debris.instanceMatrix.needsUpdate = true;
    this.debris.instanceColor.needsUpdate = true;

    for (const f of this.flashes) {
      if (f.t >= 1) { f.s.visible = false; continue; }
      f.t += f.big ? 0.025 : 0.07;
      const k = Math.min(1, f.t);
      const sz = (f.big ? 3 : 0.7) + (f.big ? 7 : 1.8) * k;
      f.s.scale.set(sz, sz, sz);
      f.s.material.opacity = (1 - k) * (f.big ? 1 : 0.85);
    }
  }
}
