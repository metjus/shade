# Shade

Prehliadačová mining hra pre [shade.sk](https://shade.sk). Všetci hráči spolu ťažia jednu obrovskú tieňovú kocku, vrstvu po vrstve, až k tajomstvu v strede.

Hra má dva režimy. Keď vedľa `index.html` beží server (`server/`, PHP + MySQL), všetci ťažia jednu spoločnú kocku a postup sa ukladá. Bez servera (napr. otvorená ako súbor alebo ukážka) beží lokálne so simulovanými hráčmi.

## Spustenie

```bash
cd client
npm install
npm run dev      # vývojový server
npm run build    # vytvorí jeden súbor client/dist/index.html
```

`client/dist/index.html` je samostatný súbor, dá sa nahrať priamo na hosting.

Parametre v adrese:

- `?size=24` menšia kocka na testovanie dokončenia vrstiev a jadra (predvolene 2048).

## Ovládanie

- Z diaľky: ťahanie otáča kockou, koliesko alebo dva prsty približujú, klik na stenu priblíži k tomu miestu.
- Zblízka: klik ťaží blok, ťahanie posúva po stene, pravé tlačidlo (alebo Shift) otáča.
- Ťažiť sa dá iba aktuálna vrstva. Klik na blok v diere (vrstva pod ňou) nerobí nič.

## Ako sa kreslí taká veľká kocka

Kocka má 2048 × 2048 × 2048 ≈ 8,6 miliardy blokov (pri hrane 4096 by to bolo ≈ 68,7 miliardy, ako Curiosity). Nikdy sa nekreslí celá:

- **Z diaľky** (`render/FarCube.js`) je každá stena jedna plocha. Mriežku blokov kreslí shader a prehľadová textúra 512 × 512 stmavuje miesta, kde sa už ťažilo.
- **Zblízka** (`render/NearPatch.js`) sa v okne 96 × 96 blokov okolo miesta, kam sa hráč pozerá, kreslia skutočné 3D bloky s prasklinami. Mimo okna ostáva plocha.
- **Stav** (`world/ShellState.js`) sa ukladá iba pre aktuálnu vrstvu (dutý plášť), riedko po dlaždiciach 64 × 64 blokov. Nedotknutá dlaždica nezaberá pamäť. Rovnaké dlaždice bude posielať server, aby klient sťahoval iba to, čo vidí.

## Štruktúra

```
client/
  index.html
  src/
    config.js            veľkosť kocky, dlaždice, životy a odmeny blokov, krompáče a ceny (ladenie tempa)
    main.js              scéna, herná slučka, HUD
    world/faces.js       súradnice stien, zásah lúča do kocky
    world/ShellState.js  stav vrstvy po dlaždiciach
    render/FarCube.js    steny z diaľky (shader + prehľadová textúra)
    render/NearPatch.js  3D bloky zblízka, praskliny, zvýraznenie
    render/Effects.js    úlomky a záblesky
    render/CameraRig.js  kamera: otáčanie, približovanie, posun po stene
    render/lights.js     spoločné svetlá pre bloky aj steny
    game/Economy.js      prach, krompáč (level → sila a plocha), baníci
    game/Simulation.js   simulovaní hráči (len lokálny režim)
    game/Online.js       online režim: dávky kliknutí, dlaždice a rozbitia ostatných zo servera
    net/ServerClient.js  volania API, token hráča

server/                PHP + MySQL server, návod na nasadenie v server/README.md
```

## Známe zjednodušenia prototypu

- Hranové bloky patria každej stene zvlášť (na hranách sa počítajú dvakrát).
- V lokálnom režime všetko počíta prehliadač. V online režime rozhoduje server, prehliadač len hneď ukáže výsledok.
- Účty sú zatiaľ len hosťovské (token v prehliadači). Prihlásenie príde neskôr.

## Ďalší krok

Nasadiť server na Hostcreators (`server/README.md`), potom aliancie, tajomstvo v strede a preklady (EN).
