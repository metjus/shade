// Simulovaní hráči. V skutočnej hre sem prídu zmeny zo servera (polling každých 5 až 10 s).

const NAMES = ['Marek', 'Zuzka', 'Tomáš_CZ', 'Lucka', 'Peťo', 'Jirka', 'Bára', 'Šimon', 'Katka', 'Ondra', 'Dominik', 'Nela'];

export class Simulation {
  constructor(state) {
    this.state = state;
    this.crews = [];        // skupinky, ktoré kopú na jednom mieste (ako hráči v Curiosity)
    this.online = 1247;
  }

  /** Pridá partiu baníkov blízko okna, kde hráč práve ťaží, aby bolo vidieť, že nie je sám. */
  ensureNearby(patch) {
    if (!patch.active) return;
    const nearby = this.crews.filter((c) => patch.contains(c.f, c.u, c.v));
    if (nearby.length >= 3) return;
    this.crews.push({
      name: NAMES[(Math.random() * NAMES.length) | 0],
      f: patch.f,
      u: patch.u0 + 8 + ((Math.random() * (patch.w - 16)) | 0),
      v: patch.v0 + 8 + ((Math.random() * (patch.w - 16)) | 0),
      rate: 2 + Math.random() * 3,
      acc: 0,
    });
    if (this.crews.length > 40) this.crews.shift();
  }

  /** dt v sekundách. onHit(f, u, v, name) sa volá pre každý úder a vracia výsledok (null = blok už je vyťažený). */
  step(dt, onHit) {
    const s = this.state.size;
    this.online += Math.round((Math.random() - 0.5) * 3);
    // zvyšok sveta: náhodné partie kdekoľvek na kocke
    while (this.crews.length < 30) {
      this.crews.push({ name: NAMES[(Math.random() * NAMES.length) | 0], f: (Math.random() * 6) | 0, u: (Math.random() * s) | 0, v: (Math.random() * s) | 0, rate: 3 + Math.random() * 4, acc: 0 });
    }
    for (const c of this.crews) {
      c.acc += c.rate * dt;
      while (c.acc >= 1) {
        c.acc--;
        // partia kope okolo svojho miesta a pomaly sa posúva
        const r = 3;
        const u = Math.max(0, Math.min(s - 1, c.u + ((Math.random() * (2 * r + 1)) | 0) - r));
        const v = Math.max(0, Math.min(s - 1, c.v + ((Math.random() * (2 * r + 1)) | 0) - r));
        const res = onHit(c.f, u, v, c.name);
        if (!res && Math.random() < 0.3) { c.u = (Math.random() * s) | 0; c.v = (Math.random() * s) | 0; continue; }
        if (!res || Math.random() < 0.05) { c.u = Math.max(0, Math.min(s - 1, c.u + ((Math.random() * 3) | 0) - 1)); c.v = Math.max(0, Math.min(s - 1, c.v + ((Math.random() * 3) | 0) - 1)); }
      }
    }
  }

  resize() { this.crews = []; }
}
