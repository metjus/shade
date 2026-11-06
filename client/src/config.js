// Herné konštanty prototypu. Hodnoty sa doladia testovaním.

const params = new URLSearchParams(location.search);

// Hrana kocky v blokoch. 2048³ ≈ 8,6 miliardy blokov (4096 by bolo ≈ 68,7 mld., ako Curiosity).
// Na testovanie dokončenia vrstvy: ?size=24
export const EDGE = clampEven(parseInt(params.get('size') || '2048', 10));

// Strana dlaždice (chunku) v blokoch. Stav kocky sa ukladá a posiela po dlaždiciach.
export const TILE = 64;

// Šírka okna blokov, ktoré sa kreslia ako skutočné 3D kocky pri priblížení.
export const WINDOW = 96;

// Výška kamery nad stenou, pod ktorou sa prepne na detailné 3D bloky.
export const NEAR_HEIGHT = 110;

// Rozlíšenie prehľadovej textúry steny (koľko "pixelov" na stranu).
export const OVERVIEW_RES = 512;

// Farby vrstiev. Každá ďalšia vrstva má ďalšiu farbu v poradí (dokola) a smerom k jadru tmavne.
export const LAYER_COLORS = [0x737786, 0x3f7a78, 0x8a5a44, 0x5d7046, 0x4a6390, 0x6d4a78, 0x8c7c5a, 0x7a3b4a];
export const CORE_COLOR = 0x9a6cff;

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
  if (!Number.isFinite(n)) n = 2048;
  n = Math.max(8, Math.min(8192, n));
  return n % 2 ? n + 1 : n;
}

// Krompáč: každý level pridá +1 silu úderu. Na týchto leveloch sa zmení na lepší krompáč,
// ktorý jedným úderom zasiahne viac blokov (šírka × výška plochy).
// Toto je hlavné miesto na ladenie tempa ťaženia.
export const PICKAXE_TIERS = [
  { level: 0, name: 'Drevený', w: 1, h: 1 },
  { level: 5, name: 'Železný', w: 2, h: 1 },
  { level: 10, name: 'Oceľový', w: 2, h: 2 },
  { level: 20, name: 'Obsidiánový', w: 3, h: 3 },
  { level: 35, name: 'Tieňový', w: 4, h: 4 },
  { level: 50, name: 'Prázdnotový', w: 5, h: 5 },
];

// Ceny vylepšení: cena = base × mult ^ level
export const UPGRADE_COSTS = {
  pickaxe: { base: 15, mult: 1.22 },
  miners: { base: 40, mult: 1.6 },
};

// Maximálne levely vylepšení.
export const MAX_LEVELS = { pickaxe: 60, miners: 50 };

// Obchod: efekty rozbitia a ich cena v tieňovom prachu (v hre môžu byť niektoré aj za skutočné peniaze).
export const EFFECT_PRICES = { basic: 0, sparks: 2000, frost: 5000, fire: 10000, smoke: 25000, gold: 60000 };
