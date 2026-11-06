// Online režim: kliknutia sa posielajú na server v dávkach, server vracia zmenené dlaždice,
// rozbitia ostatných hráčov (s ich efektmi), udalosti a prehľad celej kocky.
import { TILE } from '../config.js';
import { decodeBase64 } from '../net/ServerClient.js';

const INTERVAL = 4000;
const HIDDEN_INTERVAL = 15000;

export class Online {
  constructor(net, state, eco, patch, hooks) {
    this.net = net;
    this.state = state;
    this.eco = eco;
    this.patch = patch;
    this.hooks = hooks;
    this.pending = [];       // kliknutia, ktoré ešte neodišli na server
    this.pendingDust = 0;    // prach z nich (zobrazuje sa hneď, server ho potvrdí)
    this.tileVer = new Map(); // dlaždica -> verzia, ktorú máme
    this.bid = 0;
    this.eid = 0;
    this.ov = null;
    this.busy = null;
    this.failures = 0;
    this.lbAt = 0;
  }

  key(f, tx, ty) { return `${f}:${tx}:${ty}`; }

  start() {
    const tick = async () => {
      await this.sync();
      setTimeout(tick, document.hidden ? HIDDEN_INTERVAL : INTERVAL);
    };
    tick();
  }

  click(f, u, v, dust) {
    this.pending.push([f, u, v]);
    this.pendingDust += dust;
    if (this.pending.length >= 48) this.sync();
  }

  /** Dlaždice pod oknom detailných blokov. */
  viewTiles() {
    const p = this.patch;
    if (!p.active || p.f < 0) return [];
    const out = [];
    const t0 = Math.floor(p.u0 / TILE), t1 = Math.floor((p.u0 + p.w - 1) / TILE);
    const s0 = Math.floor(p.v0 / TILE), s1 = Math.floor((p.v0 + p.w - 1) / TILE);
    for (let ty = s0; ty <= s1; ty++) for (let tx = t0; tx <= t1; tx++) {
      const v = this.tileVer.get(this.key(p.f, tx, ty));
      out.push([p.f, tx, ty, v ?? -1]);
    }
    return out;
  }

  sync() {
    if (this.busy) return this.busy;
    const sent = this.pending, sentDust = this.pendingDust;
    this.pending = [];
    this.pendingDust = 0;
    const view = this.viewTiles();
    const body = { layer: this.state.layer, clicks: sent, view, bid: this.bid, eid: this.eid, ov: this.ov };
    if (performance.now() - this.lbAt > 30000) { body.lb = 1; this.lbAt = performance.now(); }
    this.busy = this.net.call('sync', body)
      .then((r) => { this.failures = 0; this.apply(r, view); })
      .catch((e) => {
        // kliknutia sa nestratia, odídu pri ďalšom pokuse
        this.pending = sent.concat(this.pending);
        this.pendingDust += sentDust;
        if (++this.failures === 3) this.hooks.onOffline?.();
        if (e.code === 'unknown_token') location.reload();
      })
      .finally(() => { this.busy = null; });
    return this.busy;
  }

  apply(r, view) {
    const st = this.state, c = r.cube;
    if (c.layer !== st.layer) {
      st.setLayer(c.layer);
      this.tileVer.clear();
      this.pending = [];
      this.pendingDust = 0;
      this.ov = null;
      this.hooks.onLayer();
    } else {
      for (const [f, tx, ty, ver, b64] of r.tiles) {
        st.setTile(f, tx, ty, decodeBase64(b64));
        this.tileVer.set(this.key(f, tx, ty), ver);
      }
      // dlaždica, ktorá na serveri ešte neexistuje, je nedotknutá
      for (const [f, tx, ty, ver] of view) {
        const k = this.key(f, tx, ty);
        if (ver === -1 && !this.tileVer.has(k)) this.tileVer.set(k, 0);
      }
      st.mined = c.mined;
      // kliknutia, ktoré vznikli počas čakania na odpoveď, znova zobrazíme nad stavom zo servera
      const foot = this.eco.footprint();
      for (const [f, u, v] of this.pending) for (const [du, dv] of foot) st.hit(f, u + du, v + dv, this.eco.power);
      if (r.tiles.length) this.hooks.onTiles();
    }
    if (r.overview && r.overview.layer === st.layer) {
      this.ov = r.overview.stamp;
      const inView = new Set(this.viewTiles().map(([f, tx, ty]) => this.key(f, tx, ty)));
      st.applyOverview(r.overview.T, decodeBase64(r.overview.data), (f, tx, ty) => inView.has(this.key(f, tx, ty)));
    }
    this.eco.applyServer(r.player);
    this.eco.dust += this.pendingDust;
    for (const b of r.breaks) this.hooks.onBreak(...b);
    for (const [kind, text] of r.events) this.hooks.onEvent(kind, text);
    this.bid = r.bid;
    this.eid = r.eid;
    this.hooks.onStatus(r);
  }

  /** Kúpa na serveri. Najprv odošle čakajúce kliknutia, aby sedel prach. */
  async buy(item) {
    await this.sync();
    const r = await this.net.call('buy', { item });
    this.eco.applyServer(r.player);
    this.eco.dust += this.pendingDust;
    return r.player;
  }
}
