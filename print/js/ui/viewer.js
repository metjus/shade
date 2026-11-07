// three.js preview: print bed, color parts, exploded view for split prints. Z is up like on a printer.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';

export class Viewer {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 1, 5000);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(120, -160, 110);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0, 25);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(80, -120, 200);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.6);
    rim.position.set(-120, 120, 60);
    this.scene.add(rim);

    this.bed = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(256, 256), new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.9 }));
    plate.position.z = -0.05;
    this.bed.add(plate);
    const grid = new THREE.GridHelper(256, 26, 0x4a525c, 0x3a4048);
    grid.rotation.x = Math.PI / 2;
    this.bed.add(grid);
    this.scene.add(this.bed);

    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.meshes = [];
    this.explode = 0;

    this.resize();
    new ResizeObserver(() => this.resize()).observe(container);
    const loop = () => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    loop();
  }

  setTheme(dark) {
    this.scene.background = new THREE.Color(dark ? 0x15181c : 0xe9edf1);
  }

  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // parts: [{ positions, indices, color }]
  setParts(parts, { fit = false } = {}) {
    for (const m of this.meshes) { m.geometry.dispose(); m.material.dispose(); this.group.remove(m); }
    this.meshes = [];
    const all = new THREE.Box3();
    for (const p of parts) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(p.positions, 3));
      g.setIndex(new THREE.BufferAttribute(p.indices, 1));
      g.computeVertexNormals();
      g.computeBoundingBox();
      const mat = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.55, metalness: 0.0 });
      const mesh = new THREE.Mesh(g, mat);
      this.group.add(mesh);
      this.meshes.push(mesh);
      all.union(g.boundingBox);
    }
    this.box = all;
    if (!all.isEmpty()) {
      const c = all.getCenter(new THREE.Vector3());
      this.center = c;
      // center the model over the bed origin
      this.group.position.set(-c.x, -c.y, 0);
      for (const m of this.meshes) {
        const pc = m.geometry.boundingBox.getCenter(new THREE.Vector3());
        m.userData.dir = pc.sub(c);
      }
      this.applyExplode();
      if (fit) this.fit();
    }
  }

  setColors(colors) {
    this.meshes.forEach((m, i) => colors[i] && m.material.color.set(colors[i]));
  }

  setExplode(v) {
    this.explode = v;
    this.applyExplode();
  }

  applyExplode() {
    if (!this.box) return;
    const size = this.box.getSize(new THREE.Vector3()).length();
    for (const m of this.meshes) {
      const d = m.userData.dir || new THREE.Vector3();
      const len = d.length();
      const dir = len > 1e-6 ? d.clone().divideScalar(len) : new THREE.Vector3(0, 0, 1);
      m.position.copy(dir.multiplyScalar(this.explode * size * 0.45));
      if (this.explode > 0 && m.position.z + m.geometry.boundingBox.min.z < 0) m.position.z = -m.geometry.boundingBox.min.z;
    }
  }

  fit() {
    const size = this.box.getSize(new THREE.Vector3());
    const r = Math.max(size.x, size.y, size.z, 20);
    this.controls.target.set(0, 0, size.z * 0.45);
    const dir = new THREE.Vector3(0.55, -0.75, 0.48).normalize();
    this.camera.position.copy(this.controls.target).add(dir.multiplyScalar(r * 2.6));
    this.controls.update();
  }
}
