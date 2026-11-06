# Shade server (PHP + MySQL)

Server pre spoločnú kocku. Beží na bežnom webhostingu (Hostcreators): PHP 7.4 alebo novšie, MySQL/MariaDB.

## Čo robí

- **Hráči**: hosťovský účet podľa náhodného tokenu v prehliadači (bez registrácie). Meno sa dá zmeniť.
- **Ťaženie**: hra posiela kliknutia každé 4 sekundy v dávke. Server ich overí (len aktuálna vrstva,
  najviac 12 kliknutí za sekundu), použije silu a plochu krompáča, pripíše prach.
- **Tieňoví baníci** ťažia na serveri okolo miesta, kde hráč naposledy ťažil, aj keď je offline (najviac 8 hodín).
- **Ostatní hráči**: hra dostane zmenené dlaždice v okolí a rozbitia ostatných s ich efektmi.
- **Vrstvy**: keď padne posledný blok vrstvy, server prepne všetkých na ďalšiu a zapíše udalosť.
- **Obchod**: vylepšenia a efekty rozbitia sa kupujú na serveri, takže sa nedajú podvrhnúť.

Pravidlá (ceny, levely, krompáče) sú v `src/Rules.php` a musia sedieť s `client/src/config.js`.

## Nasadenie na Hostcreators

1. V administrácii vytvor MySQL databázu a používateľa.
2. V phpMyAdmin otvor databázu a importuj `schema.sql`.
3. Skopíruj `src/config.sample.php` ako `src/config.php` a doplň prístup k databáze.
4. Postav hru: `cd client && npm install && npm run build`.
5. Nahraj cez FTP:
   ```
   (domovský priečinok)/
     shade-server/src/      ← obsah server/src (aj s config.php)
     shade-server/cache/    ← prázdny priečinok, musí byť zapisovateľný
     public_html/           ← webový priečinok domény shade.sk
       index.html           ← client/dist/index.html
       api.php              ← server/public/api.php
   ```
   `api.php` hľadá `../src`. Pri rozložení vyššie uprav prvý riadok v `api.php` na
   `__DIR__ . '/../shade-server/src'` a `cache_dir` v `config.php` na `__DIR__ . '/../cache'`.
   Ak sa nedá ísť mimo webového priečinka, nahraj `shade-server/` do `public_html/`; súbory `.htaccess`
   v `src/` a `cache/` zakážu prístup z webu.
6. Otvor shade.sk. Hore má byť počet hráčov online bez nápisu „(simulácia)“.

Prvé volanie založí kocku s hranou podľa `edge` v `config.php` (2048 = 8,6 miliardy blokov).

## Lokálne skúšanie

```
mysql shade < schema.sql
cp src/config.sample.php src/config.php   # a uprav prístup
cp ../client/dist/index.html public/
cd public && php -S 127.0.0.1:8099
php ../tests/smoke.php http://127.0.0.1:8099/api.php   # s 'edge' => 8 v config.php
```

Hra sa dá spustiť aj proti inému serveru: `index.html?api=https://shade.sk/api.php`
(doména musí byť v `allowed_origins`).

## Limity MVP

Každá synchronizácia na chvíľu zamkne riadok kocky, aby sa údery hráčov neprepísali. Jedna trvá
okolo 20 ms, takže to zvládne stovky hráčov naraz. Pri tisícoch hráčov sa kocka presunie
na Cloudflare Durable Objects (podľa konceptu).
