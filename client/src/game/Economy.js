// Ekonomika hráča v prototype (v hre ju bude počítať server, klient len zobrazuje).
import { PICKAXE_TIERS, UPGRADE_COSTS, MAX_LEVELS, EFFECT_PRICES } from '../config.js';

export class Economy {
  constructor() {
    this.dust = 0;
    this.levels = { pickaxe: 0, miners: 0 };
    this.ownedEffects = new Set(['basic']);
    this.effect = 'basic';
  }

  /** Stav hráča zo servera (online režim). */
  applyServer(p) {
    this.name = p.name;
    this.dust = p.dust;
    this.levels = { pickaxe: p.levels.pickaxe, miners: p.levels.miners };
    this.effect = p.effect;
    this.ownedEffects = new Set(p.effects);
  }

  maxLevel(id) { return MAX_LEVELS[id]; }
  isMaxed(id) { return this.levels[id] >= MAX_LEVELS[id]; }

  effectPrice(id) { return EFFECT_PRICES[id] ?? 0; }

  /** Kúpi efekt (ak ho hráč nemá) a nasadí ho. Vráti 'bought', 'equipped' alebo null. */
  useEffect(id) {
    if (this.ownedEffects.has(id)) { this.effect = id; return 'equipped'; }
    const price = this.effectPrice(id);
    if (this.dust < price) return null;
    this.dust -= price;
    this.ownedEffects.add(id);
    this.effect = id;
    return 'bought';
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

  levelText(id) { return `Lvl ${this.levels[id]}/${MAX_LEVELS[id]}`; }

  describe(id) {
    if (id === 'miners') return Economy.UPGRADES.miners.desc;
    const n = this.nextTier;
    if (this.isMaxed('pickaxe')) return 'najlepší krompáč';
    if (!n) return '+1 sila';
    return `+1 sila · lvl ${n.level}: ${n.name} (${n.w}×${n.h})`;
  }

  cost(id) {
    const c = UPGRADE_COSTS[id];
    return Math.round(c.base * Math.pow(c.mult, this.levels[id]));
  }

  canBuy(id) { return !this.isMaxed(id) && this.dust >= this.cost(id); }

  buy(id) {
    if (!this.canBuy(id)) return false;
    this.dust -= this.cost(id);
    this.levels[id]++;
    return true;
  }
}
