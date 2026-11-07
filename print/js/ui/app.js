// UI glue: controls -> worker (geometry) -> viewer + export.
import { PRESETS, presetById, defaultParams } from '../core/presets.js';
import { export3MFCompressed } from '../export/threemf.js';
import { exportOBJ } from '../export/obj.js';
import { Viewer } from './viewer.js';

const $ = (id) => document.getElementById(id);
const PLA_DENSITY = 1.24; // g/cm³
const STORE_KEY = 'shade-print-v1';

const state = loadState() || {
  presetId: PRESETS[0].id,
  params: {},
  colors: {},
  mode: 'ams',
  clearance: 0.2,
  pinType: 'filament',
  voxel: 0.6,
  explode: 0.35,
};
state.maxTriangles ??= 2_000_000;

let result = null;
let reqId = 0;
let busy = false;
let pending = false;
let firstFit = true;
let startedAt = 0;

const viewer = new Viewer($('viewer'));
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
viewer.setTheme(darkQuery.matches);
darkQuery.addEventListener?.('change', (e) => viewer.setTheme(e.matches));

let worker = makeWorker();
function makeWorker() {
  const w = new Worker(new URL('../worker.js', import.meta.url), { type: 'module' });
  w.onmessage = onResult;
  w.onerror = (e) => setStatus('Chyba generátora: ' + (e.message || e), 'error');
  return w;
}

// ---------------- controls ----------------

function preset() { return presetById(state.presetId); }
function params() { return { ...defaultParams(preset()), ...(state.params[state.presetId] || {}) }; }
function colors() {
  const custom = state.colors[state.presetId] || [];
  return preset().parts.map((p, i) => custom[i] || p.color);
}

function renderPresets() {
  const box = $('presets');
  box.innerHTML = '';
  for (const p of PRESETS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'preset' + (p.id === state.presetId ? ' active' : '');
    b.innerHTML = `<span class="dots">${p.parts.map((q) => `<i style="background:${q.color}"></i>`).join('')}</span>${p.name}`;
    b.onclick = () => { state.presetId = p.id; firstFit = true; renderAll(); regenerate(); };
    box.appendChild(b);
  }
}

function renderParams() {
  const box = $('params');
  box.innerHTML = '';
  const values = params();
  for (const q of preset().params) {
    const row = document.createElement('label');
    row.className = 'row';
    const out = document.createElement('output');
    const fmt = (v) => (q.step < 1 ? Number(v).toFixed(2) : v) + (q.unit ? ' ' + q.unit : '');
    out.textContent = fmt(values[q.id]);
    const input = document.createElement('input');
    Object.assign(input, { type: 'range', min: q.min, max: q.max, step: q.step, value: values[q.id] });
    input.oninput = () => {
      out.textContent = fmt(input.value);
      setParam(q.id, Number(input.value));
    };
    row.append(q.label, out, input);
    box.appendChild(row);
  }
}

function setParam(id, v) {
  state.params[state.presetId] = { ...(state.params[state.presetId] || {}), [id]: v };
  regenerateSoon();
}

function renderColors() {
  const box = $('colors');
  box.innerHTML = '';
  const cs = colors();
  preset().parts.forEach((p, i) => {
    const row = document.createElement('label');
    row.className = 'color';
    const input = document.createElement('input');
    input.type = 'color';
    input.value = cs[i];
    input.oninput = () => {
      const list = colors();
      list[i] = input.value;
      state.colors[state.presetId] = list;
      applyColors();
      saveState();
    };
    const slot = document.createElement('span');
    slot.className = 'slot';
    slot.textContent = state.mode === 'single' ? '' : `filament ${i + 1}`;
    row.append(input, p.name, slot);
    box.appendChild(row);
  });
}

function renderMode() {
  for (const r of document.querySelectorAll('input[name=mode]')) r.checked = r.value === state.mode;
  $('splitOptions').hidden = state.mode !== 'split';
  $('clearance').value = state.clearance;
  $('clearanceOut').textContent = state.clearance.toFixed(2) + ' mm';
  $('pinType').value = state.pinType;
  $('quality').value = String(state.voxel);
  $('maxTris').value = String(state.maxTriangles);
  $('explode').value = state.explode;
  const hint = {
    ams: 'V Bambu Studiu sa otvorí ako jeden objekt, každý farebný diel má priradený filament 1, 2, 3… podľa poradia farieb vľavo.',
    split: 'Každý farebný diel je samostatný objekt. Vytlač ich postupne podľa farby, vlož kúsky filamentu do otvorov a zlep.',
    single: 'Celý model ako jeden kus pre tlač jednou farbou.',
  }[state.mode];
  $('exportHint').textContent = hint;
}

function renderAll() {
  renderPresets();
  renderParams();
  renderColors();
  renderMode();
}

document.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', () => {
  state.mode = r.value;
  renderMode();
  renderColors();
  regenerate();
}));
$('clearance').oninput = (e) => { state.clearance = Number(e.target.value); $('clearanceOut').textContent = state.clearance.toFixed(2) + ' mm'; regenerateSoon(); };
$('pinType').onchange = (e) => { state.pinType = e.target.value; regenerate(); };
$('quality').onchange = (e) => { state.voxel = Number(e.target.value); regenerate(); };
$('maxTris').onchange = (e) => { state.maxTriangles = Number(e.target.value); regenerate(); };
$('explode').oninput = (e) => { state.explode = Number(e.target.value); viewer.setExplode(state.mode === 'split' ? state.explode : 0); saveState(); };
$('randomize').onclick = () => {
  const p = preset();
  const values = {};
  for (const q of p.params) {
    if (q.id === 'seed') values[q.id] = 1 + Math.floor(Math.random() * 998);
    else {
      const span = (q.max - q.min) * 0.35;
      const v = q.value + (Math.random() * 2 - 1) * span;
      values[q.id] = Math.round(Math.min(q.max, Math.max(q.min, v)) / q.step) * q.step;
    }
  }
  state.params[state.presetId] = values;
  renderParams();
  regenerate();
};

// ---------------- generation ----------------

let timer = null;
function regenerateSoon() {
  clearTimeout(timer);
  timer = setTimeout(regenerate, 250);
}

function regenerate() {
  saveState();
  if (busy) { pending = true; return; }
  busy = true;
  pending = false;
  startedAt = performance.now();
  setStatus('Generujem model…', 'busy');
  worker.postMessage({
    id: ++reqId,
    presetId: state.presetId,
    params: params(),
    options: { mode: state.mode, voxel: state.voxel, clearance: state.clearance, pinType: state.pinType, maxTriangles: state.maxTriangles },
  });
}

function onResult(e) {
  busy = false;
  const msg = e.data;
  if (pending) { regenerate(); return; }
  if (!msg.ok) { setStatus('Nepodarilo sa vygenerovať model.', 'error'); console.error(msg.error); return; }
  result = { ...msg, presetId: state.presetId, mode: state.mode };
  const cs = colors();
  viewer.setParts(result.parts.map((p) => ({ positions: p.positions, indices: p.indices, color: p.index < 0 ? cs[0] : cs[p.index] })), { fit: firstFit });
  firstFit = false;
  viewer.setExplode(state.mode === 'split' ? state.explode : 0);
  renderReport();
  const t = performance.now() - startedAt;
  setStatus(`Hotovo za ${(t / 1000).toFixed(1)} s`, 'ok');
}

function applyColors() {
  if (!result) return;
  const cs = colors();
  viewer.setColors(result.parts.map((p) => (p.index < 0 ? cs[0] : cs[p.index])));
  renderReport();
}

// ---------------- report ----------------

function exportParts(only) {
  const cs = colors();
  return result.parts
    .filter((p, i) => only == null || i === only)
    .map((p) => ({ name: p.name, color: p.index < 0 ? cs[0] : cs[p.index], mesh: { positions: p.positions, indices: p.indices } }));
}

function renderReport() {
  if (!result) return;
  const cs = colors();
  const rows = result.parts.map((p, i) => {
    const size = [0, 1, 2].map((c) => (p.bbox[c + 3] - p.bbox[c]).toFixed(0)).join(' × ');
    const grams = (p.volume / 1000) * PLA_DENSITY;
    const ok = p.openEdges === 0 && p.badEdges === 0;
    const small = state.mode === 'split' && p.volume < 30;
    const pieces = p.islands > 1 ? `${p.islands} kúsky` : '1 kus';
    return `<tr>
      <td><i class="sw" style="background:${p.index < 0 ? cs[0] : cs[p.index]}"></i></td>
      <td>${esc(p.name)}${small ? '<span class="warn" title="Malý diel: tlač pomaly, pomôže pinzeta a vteřinové lepidlo">malý</span>' : ''}</td>
      <td>${size} mm</td>
      <td>${grams < 1 ? grams.toFixed(2) : grams.toFixed(1)} g</td>
      <td>${pieces}</td>
      <td>${ok ? '<span class="good" title="Sieť je uzavretá a bez chýb">✓ uzavretý</span>' : '<span class="bad">chyba siete</span>'}</td>
      ${state.mode === 'split' ? `<td><button type="button" class="mini" data-part="${i}">3MF</button></td>` : ''}
    </tr>`;
  });
  const total = result.parts.reduce((s, p) => s + p.volume, 0) / 1000 * PLA_DENSITY;
  let pinsHtml = '';
  if (state.mode === 'split') {
    const pins = result.pins || [];
    if (!pins.length) pinsHtml = state.pinType === 'none' ? '' : '<p class="hint">Diely sú malé alebo tenké, kolíky sa nezmestili. Drž ich na mieste vďaka tvaru jamky a lepidlu.</p>';
    else if (state.pinType === 'filament') {
      const lens = pins.map((p) => p.cutLength);
      pinsHtml = `<p class="hint"><b>${pins.length}×</b> kúsok filamentu 1,75 mm, dĺžky ${[...new Set(lens)].sort((a, b) => a - b).map((l) => l.toFixed(1)).join(', ')} mm. Otvory sú v oboch dieloch.</p>`;
    } else pinsHtml = `<p class="hint"><b>${pins.length}×</b> vytlačený kolík priamo na dieli, protikus má otvor s vôľou ${state.clearance.toFixed(2)} mm.</p>`;
  }
  $('report').innerHTML = `
    <table><thead><tr><th></th><th>Diel</th><th>Rozmer</th><th>PLA</th><th>Kusy</th><th>Kontrola</th>${state.mode === 'split' ? '<th></th>' : ''}</tr></thead>
    <tbody>${rows.join('')}</tbody></table>
    <p class="hint">Spolu približne <b>${total.toFixed(1)} g</b> PLA pri 100 % výplni, v praxi menej. Sieť ${result.voxel.toFixed(2)} mm, ${fmtInt(result.stats.triangles)} trojuholníkov${result.stats.limited ? ' (zjemnenie obmedzené limitom)' : ''}.</p>
    ${pinsHtml}`;
  for (const b of $('report').querySelectorAll('button[data-part]')) {
    b.onclick = () => download3MF('bambu', Number(b.dataset.part));
  }
}

// ---------------- export ----------------

function baseName() {
  return `${preset().id}-${{ ams: 'farby', split: 'diely', single: 'jednofarebny' }[state.mode]}`;
}

async function download3MF(flavor, only) {
  if (!result) return;
  const parts = exportParts(only);
  const layout = state.mode === 'split' ? 'separate' : 'assembled';
  const bytes = await export3MFCompressed(parts, { title: preset().name, flavor, layout });
  const suffix = only != null ? '-' + slug(parts[0].name) : flavor === 'bambu' ? '-bambu' : '';
  save(new Blob([bytes], { type: 'model/3mf' }), `${baseName()}${suffix}.3mf`);
}

$('dlBambu').onclick = () => download3MF('bambu');
$('dl3mf').onclick = () => download3MF('standard');
$('dlObj').onclick = () => {
  if (!result) return;
  const { obj } = exportOBJ(exportParts(), { title: preset().name, layout: state.mode === 'split' ? 'separate' : 'assembled' });
  save(new Blob([obj], { type: 'text/plain' }), `${baseName()}.obj`);
};

function save(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

// ---------------- misc ----------------

function setStatus(text, kind) {
  const s = $('status');
  s.textContent = text;
  s.dataset.kind = kind || '';
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function fmtInt(n) {
  return n.toLocaleString('sk-SK');
}

function slug(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && s.presetId) return s;
  } catch { /* ignore */ }
  return null;
}

renderAll();
regenerate();
