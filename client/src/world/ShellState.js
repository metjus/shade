import { TILE, OVERVIEW_RES, blockHp } from '../config.js';

const MINED = 255;

/**
 * Stav kocky. Ťaží sa vždy jedna vrstva (dutý plášť). Plášť má 6 stien po size × size blokov.
 * Bloky sa ukladajú riedko po dlaždiciach TILE × TILE: nedotknutá dlaždica nezaberá pamäť.
 * Rovnaké delenie na dlaždice použije server, aby klient sťahoval len to, čo práve vidí.
 *
 * Hodnota bloku: 0 = celý, 1..254 = prijaté poškodenie, 255 = vyťažený.
 * Zjednodušenie prototypu: hranové bloky patria každej stene zvlášť.
 */
export class ShellState {
  constructor(edge) {
    this.edge = edge;
    this.layer = 0;
    this.listeners = new Set();
    this.resetLayer();
  }

  get size() { return this.edge - 2 * this.layer; }
  get layerCount() { return this.edge / 2; }
  /** 0 na povrchu, 1 v jadre. */
  get depth01() { return this.layerCount <= 1 ? 1 : this.layer / (this.layerCount - 1); }
  get isCore() { return this.layer === this.layerCount - 1; }

  resetLayer() {
    const s = this.size;
    this.tiles = new Map();
    this.mined = 0;
    this.total = 6 * s * s;
    this.hp = blockHp(this.depth01);
    this.overviewRes = Math.min(s, OVERVIEW_RES);
    const R = this.overviewRes;
    this.overview = Array.from({ length: 6 }, () => new Uint8Array(R * R));
    this.overviewCount = Array.from({ length: 6 }, () => new Uint32Array(R * R));
    this.cellsPerTexel = (s / R) * (s / R);
    this.dirtyOverview = new Set();
  }

  /** Blokov, ktoré v kocke ešte zostávajú (aktuálna vrstva aj všetko pod ňou). */
  remaining() {
    const s = this.size;
    return s * s * s - this.mined;
  }

  progress() { return this.mined / this.total; }

  key(f, tx, ty) { return (f * 4096 + ty) * 4096 + tx; }

  cell(f, u, v) {
    const t = this.tiles.get(this.key(f, (u / TILE) | 0, (v / TILE) | 0));
    return t ? t[(v % TILE) * TILE + (u % TILE)] : 0;
  }

  isMined(f, u, v) { return this.cell(f, u, v) === MINED; }

  damage01(f, u, v) {
    const c = this.cell(f, u, v);
    return c === MINED ? 1 : c / this.hp;
  }

  /**
   * Úder do bloku. Vráti null, ak sa nedá ťažiť (mimo steny alebo už vyťažený),
   * inak { killed, damage01 }.
   */
  hit(f, u, v, dmg) {
    const s = this.size;
    if (u < 0 || v < 0 || u >= s || v >= s) return null;
    const k = this.key(f, (u / TILE) | 0, (v / TILE) | 0);
    let t = this.tiles.get(k);
    if (!t) { t = new Uint8Array(TILE * TILE); this.tiles.set(k, t); }
    const i = (v % TILE) * TILE + (u % TILE);
    if (t[i] === MINED) return null;
    const val = t[i] + dmg;
    let res;
    if (val >= this.hp) {
      t[i] = MINED;
      this.mined++;
      this.bumpOverview(f, u, v);
      res = { killed: true, damage01: 1 };
    } else {
      t[i] = val;
      res = { killed: false, damage01: val / this.hp };
    }
    for (const fn of this.listeners) fn(f, u, v, res);
    return res;
  }

  bumpOverview(f, u, v) {
    const R = this.overviewRes, s = this.size;
    const x = Math.min(R - 1, Math.floor((u * R) / s));
    const y = Math.min(R - 1, Math.floor((v * R) / s));
    const i = y * R + x;
    const c = ++this.overviewCount[f][i];
    this.overview[f][i] = Math.min(255, Math.round((255 * c) / this.cellsPerTexel));
    this.dirtyOverview.add(f);
  }

  isLayerDone() { return this.mined >= this.total; }

  advanceLayer() {
    if (this.isCore) return false;
    this.layer++;
    this.resetLayer();
    return true;
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
}
