// Ekonomika hráča v prototype (v hre ju bude počítať server, klient len zobrazuje).

export class Economy {
  constructor() {
    this.dust = 0;
    this.power = 1;      // poškodenie jedného úderu
    this.reach = 0;      // dosah: 0 = 1 blok, 1 = 3×3, 2 = 5×5 ...
    this.miners = 0;     // údery za sekundu, ktoré robia baníci
    this.levels = { power: 0, reach: 0, miners: 0 };
  }

  static UPGRADES = {
    power: { name: 'Ostrejší krompáč', desc: '+1 sila úderu', base: 15, mult: 1.55 },
    reach: { name: 'Tieňový výbuch', desc: 'väčšia plocha úderu', base: 120, mult: 4.0, max: 4 },
    miners: { name: 'Tieňový baník', desc: '+1 úder za sekundu', base: 40, mult: 1.6 },
  };

  cost(id) {
    const u = Economy.UPGRADES[id];
    return Math.round(u.base * Math.pow(u.mult, this.levels[id]));
  }

  canBuy(id) {
    const u = Economy.UPGRADES[id];
    if (u.max != null && this.levels[id] >= u.max) return false;
    return this.dust >= this.cost(id);
  }

  buy(id) {
    if (!this.canBuy(id)) return false;
    this.dust -= this.cost(id);
    this.levels[id]++;
    if (id === 'power') this.power++;
    if (id === 'reach') this.reach++;
    if (id === 'miners') this.miners++;
    return true;
  }
}
