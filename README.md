# Shade

Prehliadačová mining hra pre [shade.sk](https://shade.sk). Všetci hráči spolu ťažia jednu obrovskú tieňovú kocku, vrstvu po vrstve, až k tajomstvu v strede.

Toto je **prototyp (fáza 0)**: beží iba v prehliadači, bez servera, a ostatní hráči sú simulovaní.

## Spustenie

```bash
cd client
npm install
npm run dev      # vývojový server
npm run build    # vytvorí jeden súbor client/dist/index.html
```

`client/dist/index.html` je samostatný súbor, dá sa nahrať priamo na hosting.

Parametre v adrese:

- `?size=24` menšia kocka na testovanie dokončenia vrstiev a jadra (predvolene 4096).

## Ovládanie

- Z diaľky: ťahanie otáča kockou, koliesko alebo dva prsty približujú, klik na stenu priblíži k tomu miestu.
- Zblízka: klik ťaží blok, ťahanie posúva po stene, pravé tlačidlo (alebo Shift) otáča.
- Ťažiť sa dá iba aktuálna vrstva. Klik na blok v diere (vrstva pod ňou) nerobí nič.

## Ako sa kreslí taká veľká kocka

Kocka má 4096 × 4096 × 4096 ≈ 68,7 miliardy blokov, podobne ako Curiosity (~69 miliárd). Nikdy sa nekreslí celá:

- **Z diaľky** (`render/FarCube.js`) je každá stena jedna plocha. Mriežku blokov kreslí shader a prehľadová textúra 512 × 512 stmavuje miesta, kde sa už ťažilo.
- **Zblízka** (`render/NearPatch.js`) sa v okne 96 × 96 blokov okolo miesta, kam sa hráč pozerá, kreslia skutočné 3D bloky s prasklinami. Mimo okna ostáva plocha.
- **Stav** (`world/ShellState.js`) sa ukladá iba pre aktuálnu vrstvu (dutý plášť), riedko po dlaždiciach 64 × 64 blokov. Nedotknutá dlaždica nezaberá pamäť. Rovnaké dlaždice bude posielať server, aby klient sťahoval iba to, čo vidí.

## Štruktúra

```
client/
  index.html
  src/
    config.js            veľkosť kocky, dlaždice, životy a odmeny blokov
    main.js              scéna, herná slučka, HUD
    world/faces.js       súradnice stien, zásah lúča do kocky
    world/ShellState.js  stav vrstvy po dlaždiciach
    render/FarCube.js    steny z diaľky (shader + prehľadová textúra)
    render/NearPatch.js  3D bloky zblízka, praskliny, zvýraznenie
    render/Effects.js    úlomky a záblesky
    render/CameraRig.js  kamera: otáčanie, približovanie, posun po stene
    render/lights.js     spoločné svetlá pre bloky aj steny
    game/Economy.js      prach a vylepšenia
    game/Simulation.js   simulovaní hráči (neskôr dáta zo servera)
```

## Známe zjednodušenia prototypu

- Hranové bloky patria každej stene zvlášť (na hranách sa počítajú dvakrát).
- Ekonomiku a zásahy počíta klient. V hre ich bude počítať server (PHP + MySQL na Hostcreators).
- Žiadne účty, ukladanie ani skutočné pripojenie hráčov.

## Ďalší krok

Server: PHP API `/api/tiles` (stav dlaždíc), `/api/sync` (dávka úderov každých 5 až 10 s), `/api/cube` (celkový stav vrstvy) a MySQL schéma. Pozri koncept hry.
