import * as THREE from 'three';

// Efekty rozbitia bloku. Sú čisto kozmetické a ostatní hráči ich vidia, keď ťažia vedľa teba.
// layerCol = farba aktuálnej vrstvy, big = jadro (väčší výbuch).
const C = (...hex) => hex.map((h) => new THREE.Color(h));

export const BREAK_EFFECTS = {
  basic: {
    name: 'Základný',
    play(fx, p, n, layerCol, big) {
      fx.spawn(p, n, { n: big ? 40 : 10, speed: big ? 0.22 : 0.11, size: big ? 0.2 : 0.13, colors: [layerCol] });
      fx.flash(p, layerCol, big);
    },
  },
  sparks: {
    name: 'Fialové iskry',
    play(fx, p, n, layerCol, big) {
      const k = big ? 3 : 1;
      fx.spawn(p, n, { n: 22 * k, speed: 0.2, size: 0.08, colors: C(0xb79bff, 0x8a5cff, 0xe2d6ff, 0x63e6d4), glow: true, gravity: 0.6, decay: 0.035, spread: 1.6, up: 0.7 });
      fx.spawn(p, n, { n: 5 * k, speed: 0.08, size: 0.11, colors: [layerCol] });
      fx.flash(p, new THREE.Color(0x8a5cff), big, 1.2);
    },
  },
  fire: {
    name: 'Oheň',
    play(fx, p, n, layerCol, big) {
      const k = big ? 3 : 1;
      // žeravé uhlíky stúpajú von zo steny, tmavé úlomky padajú
      fx.spawn(p, n, { n: 16 * k, speed: 0.07, size: 0.11, colors: C(0xffb347, 0xff6a2b, 0xffe08a, 0xff3d1f), glow: true, gravity: -0.35, decay: 0.022, spread: 0.8, drag: 0.97 });
      fx.spawn(p, n, { n: 6 * k, speed: 0.1, size: 0.12, colors: C(0x2a1a14, 0x3b2418) });
      for (let i = 0; i < 2 * k; i++) fx.puff(p, n, new THREE.Color(0x3a2a2a), 0.9, 0.5);
      fx.flash(p, new THREE.Color(0xff7a2b), big, 1.3);
    },
  },
  frost: {
    name: 'Mráz',
    play(fx, p, n, layerCol, big) {
      const k = big ? 3 : 1;
      // ľadové črepiny letia pomaly a dlho sa točia
      fx.spawn(p, n, { n: 14 * k, speed: 0.09, size: 0.14, colors: C(0xdff6ff, 0x9fe3ff, 0xffffff, 0x7cc8ff), glow: true, gravity: 0.35, decay: 0.014, spin: 2, drag: 0.975 });
      fx.puff(p, n, new THREE.Color(0xcfeeff), 1.2, 0.35);
      fx.flash(p, new THREE.Color(0xbfe9ff), big, 1.1);
    },
  },
  smoke: {
    name: 'Tieňový dym',
    play(fx, p, n, layerCol, big) {
      const k = big ? 3 : 1;
      for (let i = 0; i < 5 * k; i++) fx.puff(p, n, new THREE.Color(i % 2 ? 0x1a1230 : 0x2c1f4a), 1.1, 0.85);
      fx.spawn(p, n, { n: 6 * k, speed: 0.05, size: 0.1, colors: C(0x120c20, 0x241a3a), gravity: 0.5 });
      fx.spawn(p, n, { n: 4 * k, speed: 0.04, size: 0.07, colors: C(0xa58bff), glow: true, gravity: -0.2, decay: 0.02 });
    },
  },
  gold: {
    name: 'Zlato',
    play(fx, p, n, layerCol, big) {
      const k = big ? 3 : 1;
      fx.spawn(p, n, { n: 12 * k, speed: 0.13, size: 0.15, colors: C(0xffd54a, 0xffc21a, 0xfff0a8), glow: true, gravity: 1.2, decay: 0.02, spin: 1.6 });
      fx.spawn(p, n, { n: 16 * k, speed: 0.2, size: 0.06, colors: C(0xffffff, 0xfff3c4), glow: true, gravity: 0.2, decay: 0.045, spread: 1.8, up: 0.5 });
      fx.flash(p, new THREE.Color(0xffd54a), big, 1.4);
    },
  },
};

export const EFFECT_IDS = Object.keys(BREAK_EFFECTS);
