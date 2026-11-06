// Herné konštanty prototypu. Hodnoty sa doladia testovaním.

const params = new URLSearchParams(location.search);

// Hrana kocky v blokoch. 4096³ ≈ 68,7 miliardy blokov, približne ako Curiosity (~69 mld.).
// Na testovanie dokončenia vrstvy: ?size=24
export const EDGE = clampEven(parseInt(params.get('size') || '4096', 10));

// Strana dlaždice (chunku) v blokoch. Stav kocky sa ukladá a posiela po dlaždiciach.
export const TILE = 64;

// Šírka okna blokov, ktoré sa kreslia ako skutočné 3D kocky pri priblížení.
export const WINDOW = 96;

// Výška kamery nad stenou, pod ktorou sa prepne na detailné 3D bloky.
export const NEAR_HEIGHT = 110;

// Rozlíšenie prehľadovej textúry steny (koľko "pixelov" na stranu).
export const OVERVIEW_RES = 512;

// Paleta vrstiev od povrchu po jadro (lineárne sa prelína podľa hĺbky).
export const LAYER_PALETTE = [0x737786, 0x5b5e70, 0x45415a, 0x3a2d66, 0x2c2152, 0x221a40, 0x9a6cff];

export const LAYER_NAMES = ['Bridlica', 'Čadič', 'Obsidián', 'Tieňový kryštál', 'Súmrak', 'Prázdnota', 'Jadro'];

// Životy bloku podľa hĺbky (0 = povrch, 1 = jadro).
export function blockHp(depth01) {
  return 2 + Math.floor(depth01 * 10);
}

// Odmena v prachu za blok podľa hĺbky.
export function blockReward(depth01) {
  return 1 + Math.floor(depth01 * 20);
}

function clampEven(n) {
  if (!Number.isFinite(n)) n = 4096;
  n = Math.max(8, Math.min(8192, n));
  return n % 2 ? n + 1 : n;
}
