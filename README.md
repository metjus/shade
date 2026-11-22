# shade.sk

Marketingový asistent pre ľudí, ktorí nie sú marketéri: jednotlivcov, indie vývojárov a malé firmy,
ktoré chcú zviditeľniť svoj web, softvér, hru alebo e-shop.

## MVP (prvá verzia)

Používateľ vyplní krátke zadanie:

- názov a typ projektu (web, softvér, hra, e-shop, služba…), voliteľne URL,
- čo to robí a pre koho to je,
- hlavný cieľ na 30 dní a rozpočet (0 €, do 100 €, do 1 000 €),
- jazyk výstupu (SK / EN).

Dostane na jednej stránke:

1. **Pozicionovanie**: jedna veta, čo produkt je, hlavné prínosy a tón komunikácie.
2. **Cieľové skupiny** a kde ich nájsť.
3. **3–5 kanálov** zoradených podľa priority, s dôvodom a prvým krokom.
4. **Plán na 30 dní** po týždňoch, s úlohami na odškrtnutie.
5. **8–10 nápadov na obsah**.
6. **Hotové príspevky** pre top 3 kanály, s tlačidlom Kopírovať.
7. **Rýchle výhry**, ktoré sa dajú urobiť ešte dnes.

Plán sa dá vytlačiť alebo uložiť ako PDF. Nič sa neukladá na server; rozpísané zadanie si pamätá len prehliadač.

Mimo MVP (nápady na ďalšie kroky): účty a uložené plány, analýza existujúceho webu z URL,
kalendár publikovania, priame publikovanie na siete, sledovanie výsledkov, platené plány.

## Jazyky (i18n)

UI je pripravené na viac jazykov. Preklady sú v `lang/<kod>.json` (zatiaľ `sk` a `en`).
Jazyk sa vyberá cez `?lang=`, cookie alebo hlavičku prehliadača (čeština dostane slovenčinu).
Jazyk výstupu plánu sa volí zvlášť, takže slovenský tvorca si môže nechať vygenerovať anglické príspevky
pre zahraničné publikum. Nový jazyk = nový JSON súbor + kód v `Shade\I18n::SUPPORTED` + možnosť vo formulári.

## Ako to funguje

- PHP 8.1+, bez frameworku, beží na bežnom webhostingu (napr. Websupport).
- `public/` je koreň webu: `index.php` (formulár), `assets/` (JS, CSS), `api/generate.php` (JSON API).
- `src/ClaudeGenerator.php` volá Claude API cez oficiálne PHP SDK so štruktúrovaným JSON výstupom
  (schéma v `src/PlanSchema.php`). Ak model požiadavku odmietne, server ju skúsi na záložnom modeli
  (`fallbacks: "default"`).
- `src/DemoGenerator.php` vráti šablónový plán, keď nie je nastavený API kľúč. Prototyp sa tak dá
  vyskúšať hneď a zadarmo.

## Spustenie lokálne

```bash
composer install
php -S localhost:8000 -t public
```

Bez kľúča beží DEMO režim. Pre AI režim:

```bash
cp config.example.php config.php   # a doplň kľúč, alebo nastav premennú ANTHROPIC_API_KEY
```

V `config.php` sa dá zmeniť model (`claude-opus-5-5` predvolene) a `effort` (`low` je rýchlejší a lacnejší).

## Nasadenie

Nahraj celý repozitár (vrátane `vendor/` po `composer install --no-dev`) a nastav document root na `public/`.
`config.php` nikdy necommituj.
