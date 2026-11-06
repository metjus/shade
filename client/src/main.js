import * as THREE from 'three';
import { EDGE, blockReward } from './config.js';
import { ShellState } from './world/ShellState.js';
import { FACES, cellCenter } from './world/faces.js';
import { FarCube } from './render/FarCube.js';
import { NearPatch } from './render/NearPatch.js';
import { Effects } from './render/Effects.js';
import { BREAK_EFFECTS } from './render/breakEffects.js';
import { CameraRig } from './render/CameraRig.js';
import { stateColor, layerName } from './render/palette.js';
import { addLights } from './render/lights.js';
import { Economy } from './game/Economy.js';
import { Simulation } from './game/Simulation.js';
import { ServerClient } from './net/ServerClient.js';
import { Online } from './game/Online.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.floor(n).toLocaleString('sk-SK');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- scéna ----------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1e5);
addLights(scene);

// online, ak beží server (shade.sk), inak lokálny režim so simulovanými hráčmi
const net = new ServerClient();
const hello = await net.hello();
const state = new ShellState(hello ? hello.cube.edge : EDGE);
if (hello) { state.setLayer(hello.cube.layer); state.mined = hello.cube.mined; }
const far = new FarCube(scene, state);
const patch = new NearPatch(scene, state);
const fx = new Effects(scene);
const rig = new CameraRig(camera, canvas, () => state.size);
const eco = new Economy();
const sim = new Simulation(state);
let online = null;
if (hello) eco.applyServer(hello.player);

// ---------- UI ----------
const feedEl = $('feed');
function log(html) {
  const li = document.createElement('li');
  li.innerHTML = html;
  feedEl.prepend(li);
  while (feedEl.children.length > 6) feedEl.lastChild.remove();
}

function floater(x, y, text) {
  if (reduceMotion) return;
  const d = document.createElement('div');
  d.className = 'float';
  d.textContent = text;
  d.style.left = x + 'px';
  d.style.top = y + 'px';
  $('app').appendChild(d);
  setTimeout(() => d.remove(), 950);
}

const upEl = $('upgrades');
const buttons = {};
for (const [id, u] of Object.entries(Economy.UPGRADES)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn';
  b.innerHTML = `<span><b>${u.name} <span class="lvl"></span></b><small></small></span><span class="c"></span>`;
  b.addEventListener('click', async () => {
    const before = eco.tier;
    if (online) {
      if (!eco.canBuy(id)) return;
      try { await online.buy(id); } catch { log('Nákup sa nepodaril, skús to znova'); renderHud(); return; }
    } else if (!eco.buy(id)) return;
    if (id === 'pickaxe' && eco.tier !== before) log(`<span class="me">Ty</span> máš nový krompáč: <b>${eco.tier.name}</b> (${eco.tier.w}×${eco.tier.h})`);
    else if (id === 'miners') log(`<span class="me">Ty</span> si najal tieňového baníka`);
    renderHud();
  });
  upEl.appendChild(b);
  buttons[id] = b;
}

$('lcount').textContent = fmt(state.layerCount);
$('edge').textContent = `${fmt(state.edge)} × ${fmt(state.edge)} × ${fmt(state.edge)}`;
if (hello) $('mode').hidden = true;

function renderHud() {
  $('dust').textContent = fmt(eco.dust);
  $('power').textContent = eco.power;
  $('reach').textContent = `${eco.tier.w}×${eco.tier.h}`;
  $('tier').textContent = eco.tier.name;
  $('miners').textContent = eco.miners;
  for (const [id, b] of Object.entries(buttons)) {
    b.querySelector('.lvl').textContent = eco.levelText(id);
    b.querySelector('small').textContent = eco.describe(id);
    b.querySelector('.c').textContent = eco.isMaxed(id) ? 'max' : fmt(eco.cost(id));
    b.disabled = !eco.canBuy(id);
  }
  renderShop();
  $('online').textContent = fmt(online ? onlineCount : sim.online);
  $('lidx').textContent = fmt(state.layer + 1);
  $('lname').textContent = layerName(state.depth01);
  const pct = state.progress() * 100;
  $('lpct').textContent = pct.toFixed(pct < 1 ? 6 : 2).replace('.', ',') + ' %';
  $('lbar').style.width = pct + '%';
  $('remaining').textContent = fmt(state.remaining());
  $('hint').textContent = rig.near
    ? 'Klikaj na bloky. Ťahaním sa posúvaš po stene, pravým tlačidlom otáčaš.'
    : 'Priblíž kolieskom, dvoma prstami alebo kliknutím na stenu. Ťahaním otáčaš kockou.';
}

// ---------- ťaženie ----------
const tmpPos = new THREE.Vector3();
const tmpCol = new THREE.Color();

/** Jeden úder do bloku. who = 'me' alebo meno simulovaného hráča. Vráti výsledok zo ShellState. */
function strike(f, u, v, dmg, who, showFx, effect = 'basic') {
  const res = state.hit(f, u, v, dmg);
  if (!res) return null;
  if (showFx) {
    cellCenter(f, u, v, state.size, 0, tmpPos);
    stateColor(state, 0, tmpCol);
    const n = FACES[f].n;
    if (res.killed) {
      (BREAK_EFFECTS[effect] || BREAK_EFFECTS.basic).play(fx, tmpPos, n, tmpCol, state.isCore);
    } else {
      fx.burst(tmpPos, n, tmpCol, who === 'me' ? 4 : 2, 0.05, 0.06);
    }
  }
  if (res.killed && who === 'me') eco.dust += blockReward(state.depth01);
  return res;
}

function checkLayer(who) {
  if (!state.isLayerDone()) return;
  if (online) { online.sync(); return; } // vrstvu posúva server
  const name = who === 'me' ? '<span class="me">Ty</span>' : `<b>${who}</b>`;
  if (state.isCore) {
    log(`${name} rozbil jadro a otvoril stred kocky`);
    $('end').hidden = false;
    return;
  }
  log(`Vrstva <b>${fmt(state.layer + 1)}</b> je vyťažená. Posledný blok: ${name}`);
  state.advanceLayer();
  far.rebuild();
  patch.reset();
  sim.resize();
}

// ---------- obchod: efekty rozbitia ----------
const shopEl = $('shop');
const shopItems = {};
for (const [id, e] of Object.entries(BREAK_EFFECTS)) {
  const row = document.createElement('div');
  row.className = 'shop-item';
  const buy = document.createElement('button');
  buy.type = 'button';
  buy.className = 'btn';
  buy.innerHTML = `<span><b>${e.name}</b></span><span class="c"></span>`;
  buy.addEventListener('click', async () => {
    if (online) {
      const had = eco.ownedEffects.has(id);
      if (!had && eco.dust < eco.effectPrice(id)) return;
      try { await online.buy('effect:' + id); } catch { log('Nákup sa nepodaril, skús to znova'); return; }
      if (!had) log(`<span class="me">Ty</span> si kúpil efekt <b>${e.name}</b>`);
      renderHud();
      return;
    }
    const r = eco.useEffect(id);
    if (r === 'bought') log(`<span class="me">Ty</span> si kúpil efekt <b>${e.name}</b>`);
    renderHud();
  });
  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'chip';
  prev.textContent = 'Ukážka';
  prev.title = 'Prehrá efekt na stene, na ktorú sa pozeráš';
  prev.addEventListener('click', () => {
    const h = rig.focusHit;
    if (!h) return;
    cellCenter(h.f, h.u, h.v, state.size, 0, tmpPos);
    e.play(fx, tmpPos, FACES[h.f].n, stateColor(state, 0, tmpCol), false);
  });
  row.append(buy, prev);
  shopEl.appendChild(row);
  shopItems[id] = buy;
}

// na mobile je obchod na začiatku zbalený, aby nezakrýval kocku
if (window.matchMedia('(max-width: 760px)').matches) document.querySelector('.shop').open = false;

function renderShop() {
  for (const [id, b] of Object.entries(shopItems)) {
    const owned = eco.ownedEffects.has(id);
    const active = eco.effect === id;
    b.querySelector('.c').textContent = active ? 'používaš' : owned ? 'nasadiť' : fmt(eco.effectPrice(id));
    b.classList.toggle('active', active);
    b.disabled = !owned && eco.dust < eco.effectPrice(id);
  }
}

let dive = null;
rig.onClick = (x, y) => {
  const hit = rig.pickCell(x, y);
  if (!hit) return;
  if (!rig.near) { dive = { x, y, n: 26 }; return; }
  if (!patch.contains(hit.f, hit.u, hit.v)) return;
  const before = eco.dust;
  let any = false;
  for (const [du, dv] of eco.footprint()) if (strike(hit.f, hit.u + du, hit.v + dv, eco.power, 'me', true, eco.effect)) any = true;
  const gained = eco.dust - before;
  if (online && any) online.click(hit.f, hit.u, hit.v, gained);
  const rect = canvas.getBoundingClientRect();
  if (gained > 0) floater(x - rect.left, y - rect.top, '+' + fmt(gained));
  checkLayer('me');
  renderHud();
};
let hoverReq = null;
rig.onHover = (x, y) => { hoverReq = x == null ? null : [x, y]; if (x == null) patch.setHover(null); };

// ---------- slučka ----------
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
// na úzkej obrazovke (mobil) začneme ďalej, aby bola vidieť celá kocka
function fitStart() {
  const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  rig.dist = state.size * (aspect < 1 ? 2.2 / aspect : 2.6);
}
window.addEventListener('resize', resize);
resize();
fitStart();

let last = performance.now(), hudT = 0, minerAcc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (dive) { rig.zoomAt(dive.x, dive.y, 0.86); if (--dive.n <= 0 || rig.near) dive = null; }
  rig.update(!reduceMotion);

  // okno detailných blokov sleduje miesto, kam sa kamera pozerá
  if (rig.near) {
    const hit = rig.focusHit;
    patch.focus(hit.f, hit.u, hit.v);
    patch.setActive(true);
    far.setWindow(patch.f, patch.u0, patch.v0, patch.u0 + patch.w, patch.v0 + patch.w);
    if (!online) sim.ensureNearby(patch);
  } else {
    patch.setActive(false);
    far.setWindow(-1);
  }
  if (hoverReq && rig.pointers.size === 0) { patch.setHover(rig.pickCell(hoverReq[0], hoverReq[1]), eco.tier.w, eco.tier.h); hoverReq = null; }

  // ostatní hráči (v online režime prídu zo servera)
  if (!online) sim.step(dt, (f, u, v, name, effect) => {
    const res = strike(f, u, v, 1, name, patch.active && patch.contains(f, u, v), effect);
    if (res?.killed) {
      if (patch.contains(f, u, v) && Math.random() < 0.04) log(`<b>${name}</b> ťaží kúsok od teba`);
      checkLayer(name);
    }
    return res;
  });

  // tvoji baníci (v online režime ťažia na serveri)
  if (!online) minerAcc += eco.miners * dt;
  while (minerAcc >= 1) {
    minerAcc--;
    const s = state.size;
    let f, u, v;
    if (patch.active) { f = patch.f; u = patch.u0 + ((Math.random() * patch.w) | 0); v = patch.v0 + ((Math.random() * patch.w) | 0); }
    else { f = (Math.random() * 6) | 0; u = (Math.random() * s) | 0; v = (Math.random() * s) | 0; }
    strike(f, u, v, 1, 'me', patch.active, eco.effect);
    checkLayer('me');
  }

  patch.update();
  far.update();
  fx.update();
  renderer.render(scene, camera);

  hudT += dt;
  if (hudT > 0.15) { hudT = 0; renderHud(); }
  requestAnimationFrame(frame);
}

// ---------- server ----------
let onlineCount = 0;
if (hello) {
  online = new Online(net, state, eco, patch, {
    onTiles: () => { patch.dirty = true; },
    onLayer: () => { far.rebuild(); patch.reset(); renderHud(); },
    onBreak: (f, u, v, effect) => {
      if (!patch.active || !patch.contains(f, u, v)) return;
      // rozbitia z posledných sekúnd rozložíme v čase, aby nepraskli všetky naraz
      setTimeout(() => {
        cellCenter(f, u, v, state.size, 0, tmpPos);
        (BREAK_EFFECTS[effect] || BREAK_EFFECTS.basic).play(fx, tmpPos, FACES[f].n, stateColor(state, 0, tmpCol), state.isCore);
      }, Math.random() * 1500);
    },
    onEvent: (kind, text) => log(escapeHtml(text)),
    onStatus: (r) => { onlineCount = r.online; if (r.cube.opened) $('end').hidden = false; },
    onOffline: () => log('Spojenie so serverom vypadlo, skúšam znova…'),
  });
  online.start();
}

function escapeHtml(t) {
  return t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

log(hello
  ? `Vitaj v Shade, <b>${escapeHtml(eco.name)}</b>. Ťažíš spolu so všetkými ostatnými.`
  : 'Vitaj v Shade. Priblíž sa ku kocke a začni ťažiť.');
renderHud();
requestAnimationFrame(frame);

// prístup na ladenie z konzoly
window.shade = { state, rig, eco, patch, checkLayer, get online() { return online; } };
