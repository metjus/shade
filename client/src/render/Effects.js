import * as THREE from 'three';

const DMAX = 1500;
const GMAX = 1500;

function radialTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/**
 * Častice pri údere a rozbití bloku.
 *  - debris: matné kocky osvetlené scénou (bežné úlomky)
 *  - glow: svietiace kocky bez tieňa (iskry, žeravé uhlíky, ľad, zlato)
 *  - puffs: mäkké obláčiky (dym)
 *  - flashes: krátky záblesk
 * Smer "hore" je normála steny, gravitácia ťahá do kocky.
 */
export class Effects {
  constructor(scene) {
    const box = new THREE.BoxGeometry(1, 1, 1);
    this.debris = this.makeMesh(box, new THREE.MeshLambertMaterial(), DMAX, scene);
    this.glow = this.makeMesh(box, new THREE.MeshBasicMaterial({ toneMapped: false }), GMAX, scene);
    this.parts = [];

    const flashTex = radialTexture([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,.45)'], [1, 'rgba(255,255,255,0)']]);
    const puffTex = radialTexture([[0, 'rgba(255,255,255,.9)'], [0.5, 'rgba(255,255,255,.45)'], [1, 'rgba(255,255,255,0)']]);
    this.flashes = this.makeSprites(scene, flashTex, THREE.AdditiveBlending, 40);
    this.puffs = this.makeSprites(scene, puffTex, THREE.NormalBlending, 80);

    this.q = new THREE.Quaternion();
    this.sc = new THREE.Vector3();
    this.m = new THREE.Matrix4();
  }

  makeMesh(geo, mat, cap, scene) {
    const m = new THREE.InstancedMesh(geo, mat, cap);
    for (let i = 0; i < cap; i++) m.setColorAt(i, new THREE.Color(0));
    m.count = 0;
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(m);
    return m;
  }

  makeSprites(scene, map, blending, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, blending, transparent: true, depthWrite: false, opacity: 0 }));
      s.visible = false;
      scene.add(s);
      out.push({ s, t: 1, speed: 0.05, from: 1, to: 2, alpha: 1, vel: new THREE.Vector3() });
    }
    return out;
  }

  /**
   * Všeobecný výbuch častíc.
   * o: { n, speed, size, colors: [Color], glow, gravity (násobok), up (koľko letia von zo steny), decay, spin, spread }
   */
  spawn(p, normal, o) {
    const cols = o.colors;
    for (let i = 0; i < o.n; i++) {
      if (this.parts.length >= DMAX + GMAX) this.parts.shift();
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
        .multiplyScalar(o.spread ?? 1).addScaledVector(normal, o.up ?? 1.1).normalize();
      this.parts.push({
        p: p.clone().addScaledVector(normal, 0.4),
        v: dir.multiplyScalar(o.speed * (0.6 + Math.random() * 0.8)),
        g: normal.clone().multiplyScalar(-0.006 * (o.gravity ?? 1)),
        r: new THREE.Euler(Math.random() * 3, Math.random() * 3, 0),
        w: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.4 * (o.spin ?? 1)),
        life: 1,
        decay: (o.decay ?? 0.027) * (0.7 + Math.random() * 0.6),
        size: o.size * (0.6 + Math.random() * 0.7),
        col: cols[(Math.random() * cols.length) | 0].clone(),
        glow: !!o.glow,
        drag: o.drag ?? 0.985,
      });
    }
  }

  /** Bežný drobný prach pri údere (bez rozbitia). */
  burst(p, normal, color, n, speed, size) {
    this.spawn(p, normal, { n, speed, size, colors: [new THREE.Color(color)] });
  }

  flash(p, color, big, scale = 1) {
    const f = this.flashes.find((x) => x.t >= 1) || this.flashes[0];
    f.t = 0;
    f.speed = big ? 0.025 : 0.07;
    f.from = (big ? 3 : 0.7) * scale;
    f.to = (big ? 10 : 2.5) * scale;
    f.alpha = big ? 1 : 0.85;
    f.vel.set(0, 0, 0);
    f.s.position.copy(p);
    f.s.material.color.copy(color).lerp(new THREE.Color(0xffffff), 0.35);
    f.s.visible = true;
  }

  /** Obláčik dymu, ktorý sa rozšíri a stúpa von zo steny. */
  puff(p, normal, color, size, alpha) {
    const f = this.puffs.find((x) => x.t >= 1) || this.puffs[0];
    f.t = 0;
    f.speed = 0.012 + Math.random() * 0.01;
    f.from = size * 0.5;
    f.to = size * (1.6 + Math.random() * 0.8);
    f.alpha = alpha;
    f.vel.copy(normal).multiplyScalar(0.02 + Math.random() * 0.02)
      .add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.03));
    f.s.position.copy(p).addScaledVector(normal, 0.5);
    f.s.material.color.copy(color);
    f.s.material.rotation = Math.random() * 6.28;
    f.s.visible = true;
  }

  update() {
    const { q, sc, m } = this;
    let nd = 0, ng = 0;
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const p of this.parts) {
      p.v.add(p.g);
      p.v.multiplyScalar(p.drag);
      p.p.add(p.v);
      p.r.x += p.w.x; p.r.y += p.w.y; p.r.z += p.w.z;
      p.life -= p.decay;
      const s = p.size * Math.min(1, p.life * 2.2);
      q.setFromEuler(p.r);
      sc.set(s, s, s);
      m.compose(p.p, q, sc);
      if (p.glow) {
        if (ng >= GMAX) continue;
        this.glow.setMatrixAt(ng, m);
        this.glow.setColorAt(ng, p.col);
        ng++;
      } else {
        if (nd >= DMAX) continue;
        this.debris.setMatrixAt(nd, m);
        this.debris.setColorAt(nd, p.col);
        nd++;
      }
    }
    for (const [mesh, n] of [[this.debris, nd], [this.glow, ng]]) {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }

    for (const list of [this.flashes, this.puffs]) {
      for (const f of list) {
        if (f.t >= 1) { f.s.visible = false; continue; }
        f.t += f.speed;
        const k = Math.min(1, f.t);
        const sz = f.from + (f.to - f.from) * (list === this.puffs ? Math.sqrt(k) : k);
        f.s.scale.set(sz, sz, sz);
        f.s.position.add(f.vel);
        f.s.material.opacity = (1 - k) * f.alpha;
      }
    }
  }
}
