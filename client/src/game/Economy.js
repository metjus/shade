// Ekonomika hráča v prototype (v hre ju bude počítať server, klient len zobrazuje).
import { PICKAXE_TIERS, UPGRADE_COSTS } from '../config.js';

export class Economy {
  constructor() {
    this.dust = 0;
    this.levels = { pickaxe: 0, miners: 0 };
  }

  static UPGRADES = {
    pickaxe: { name: 'Vylepšiť krompáč' },
    miners: { name: 'Tieňový baník', desc: '+1 úder za sekundu' },
  };

  /** Poškodenie jedného úderu. */
  get power() { return 1 + this.levels.pickaxe; }
  /** Údery za sekundu od baníkov. */
  get miners() { return this.levels.miners; }

  get tier() {
    let t = PICKAXE_TIERS[0];
    for (const x of PICKAXE_TIERS) if (this.levels.pickaxe >= x.level) t = x;
    return t;
  }

  get nextTier() { return PICKAXE_TIERS.find((x) => x.level > this.levels.pickaxe) || null; }

  /** Posuny blokov, ktoré zasiahne jeden úder (okolo kliknutého bloku). */
  footprint() {
    const { w, h } = this.tier;
    const out = [];
    const u0 = -Math.floor((w - 1) / 2), v0 = -Math.floor((h - 1) / 2);
    for (let dv = 0; dv < h; dv++) for (let du = 0; du < w; du++) out.push([u0 + du, v0 + dv]);
    return out;
  }

  describe(id) {
    if (id === 'miners') return Economy.UPGRADES.miners.desc;
    const n = this.nextTier;
    const lvl = this.levels.pickaxe;
    if (!n) return `level ${lvl} · +1 sila`;
    return `level ${lvl} · na leveli ${n.level}: ${n.name} (${n.w}×${n.h})`;
  }

  cost(id) {
    const c = UPGRADE_COSTS[id];
    return Math.round(c.base * Math.pow(c.mult, this.levels[id]));
  }

  canBuy(id) { return this.dust >= this.cost(id); }

  buy(id) {
    if (!this.canBuy(id)) return false;
    this.dust -= this.cost(id);
    this.levels[id]++;
    return true;
  }
}
