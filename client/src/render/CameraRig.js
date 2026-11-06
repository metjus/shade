import * as THREE from 'three';
import { FACES, rayHitCube } from '../world/faces.js';
import { NEAR_HEIGHT } from '../config.js';

/**
 * Kamera okolo obrovskej kocky:
 *  - z diaľky ťahanie otáča kockou,
 *  - koliesko alebo dva prsty približujú k miestu pod kurzorom,
 *  - zblízka ťahanie posúva po stene a kamera sa pomaly natočí kolmo na stenu.
 * Pravé tlačidlo (alebo Shift) otáča vždy.
 */
export class CameraRig {
  constructor(camera, dom, getSize) {
    this.camera = camera;
    this.dom = dom;
    this.getSize = getSize;
    this.target = new THREE.Vector3();
    this.quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.5, 0.75, 0, 'YXZ'));
    this.dist = getSize() * 2.6;
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.pointers = new Map();
    this.lastInteract = 0;
    this.near = false;
    this.focusHit = null;
    this.onClick = null;
    this.onHover = null;
    this.bind();
  }

  get dir() { return new THREE.Vector3(0, 0, 1).applyQuaternion(this.quat); }

  rayFrom(clientX, clientY) {
    const r = this.dom.getBoundingClientRect();
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    return this.ray.ray;
  }

  pickCell(clientX, clientY) { return rayHitCube(this.rayFrom(clientX, clientY), this.getSize()); }

  rotate(dx, dy) {
    const k = 0.006;
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0).applyQuaternion(this.quat), -dx * k);
    const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0).applyQuaternion(this.quat), -dy * k);
    this.quat.premultiply(yaw).premultiply(pitch).normalize();
  }

  pan(dx, dy) {
    const hit = this.focusHit;
    if (!hit) return;
    const n = FACES[hit.f].n;
    const r = this.dom.getBoundingClientRect();
    const height = Math.max(1, this.camera.position.dot(n) - this.getSize() / 2);
    const wpp = (2 * height * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) / r.height;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.quat);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.quat);
    const move = right.multiplyScalar(-dx * wpp).addScaledVector(up, dy * wpp);
    move.addScaledVector(n, -move.dot(n));
    this.target.add(move);
  }

  zoomAt(clientX, clientY, factor) {
    const s = this.getSize();
    const hit = this.pickCell(clientX, clientY);
    const newDist = THREE.MathUtils.clamp(this.dist * factor, 14, s * 6);
    const k = newDist / this.dist;
    if (hit) {
      this.target.sub(hit.point).multiplyScalar(k).add(hit.point);
    }
    this.dist = newDist;
    if (factor > 1 && this.dist > s * 0.9) this.target.lerp(new THREE.Vector3(), 0.2);
  }

  bind() {
    const el = this.dom;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture?.(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: 0, rotate: e.button === 2 || e.shiftKey });
      this.lastInteract = performance.now();
    });
    el.addEventListener('pointermove', (e) => {
      this.lastInteract = performance.now();
      const p = this.pointers.get(e.pointerId);
      if (!p) { this.onHover?.(e.clientX, e.clientY); return; }
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const before = Math.hypot(a.x - b.x, a.y - b.y);
        p.x = e.clientX; p.y = e.clientY; p.moved += 10;
        const after = Math.hypot(a.x - b.x, a.y - b.y);
        if (before > 0 && after > 0) this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, before / after);
        return;
      }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      p.moved += Math.abs(dx) + Math.abs(dy);
      if (p.moved < 6) return;
      el.style.cursor = 'grabbing';
      if (this.near && !p.rotate) this.pan(dx, dy);
      else this.rotate(dx, dy);
    });
    const end = (e) => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      el.style.cursor = '';
      if (p && p.moved < 6 && this.pointers.size === 0 && e.type === 'pointerup' && e.button === 0) this.onClick?.(e.clientX, e.clientY);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', () => this.onHover?.(null));
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.lastInteract = performance.now();
      this.zoomAt(e.clientX, e.clientY, Math.exp(e.deltaY * 0.0015));
    }, { passive: false });
  }

  update(autoRotate) {
    const s = this.getSize(), h = s / 2, cam = this.camera;
    // cieľ nesmie odísť mimo kocku
    this.target.clampScalar(-h, h);

    if (autoRotate && !this.near && performance.now() - this.lastInteract > 3000) this.rotate(-0.35, 0);

    cam.quaternion.copy(this.quat);
    cam.position.copy(this.target).addScaledVector(this.dir, this.dist);

    // kamera ostáva mimo kocky
    let fi = 0, best = -Infinity;
    for (let f = 0; f < 6; f++) { const d = cam.position.dot(FACES[f].n); if (d > best) { best = d; fi = f; } }
    if (best < h + 2) cam.position.addScaledVector(FACES[fi].n, h + 2 - best);

    // na čo sa kamera pozerá (stred obrazovky)
    const centerRay = new THREE.Ray(cam.position.clone(), new THREE.Vector3(0, 0, -1).applyQuaternion(this.quat));
    this.focusHit = rayHitCube(centerRay, s);
    const height = this.focusHit ? cam.position.dot(FACES[this.focusHit.f].n) - h : Infinity;
    this.near = !!this.focusHit && height < NEAR_HEIGHT;

    // zblízka sa kamera pomaly natočí kolmo na stenu (s jemným náklonom), ako pri pohľade na stenu bane
    if (this.near) {
      // cieľ prilepíme na stenu, aby sa zblízka otáčalo a posúvalo okolo bodu na povrchu
      const nf = FACES[this.focusHit.f].n;
      this.target.addScaledVector(nf, h - this.target.dot(nf));
    }
    if (this.near && this.pointers.size === 0) {
      const n = FACES[this.focusHit.f].n;
      const curUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.quat);
      curUp.addScaledVector(n, -curUp.dot(n)).normalize();
      const eyeDir = n.clone().addScaledVector(curUp, -0.35).normalize();
      const m = new THREE.Matrix4().lookAt(eyeDir, new THREE.Vector3(), curUp);
      const goal = new THREE.Quaternion().setFromRotationMatrix(m);
      this.quat.slerp(goal, 0.06);
    }

    cam.near = Math.max(0.05, Math.min(this.dist, height) * 0.02);
    cam.far = this.dist + s * 3;
    cam.updateProjectionMatrix();
  }
}
