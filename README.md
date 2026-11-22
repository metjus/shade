# shade.sk

Marketingový pracovný priestor pre vlastné projekty (web, softvér, hra…).
Zatiaľ je určený pre jedného používateľa. Keď sa osvedčí, otvorí sa aj ostatným.
Nástroj beží na subdoméne a na shade.sk zatiaľ ostáva úvodná stránka.

## Čo vie

- **Profily projektov.** O čom projekt je, pre koho, tón, jazyky a ukážky tvojich príspevkov (hlas značky).
  AI dostane profil pri každej požiadavke.
- **Plán na 30 dní.** Pozicionovanie, kanály podľa priority a úlohy rozložené do 4 týždňov
  s dátumami a odškrtávaním. Nový plán nadviaže na splnené úlohy, zverejnené príspevky a ich výsledky.
- **Dnes.** Úlohy na dnes a meškajúce, príspevky naplánované na dnes, najbližších 7 dní
  a stále aktuálne (evergreen) príspevky, ktoré sa oplatí zdieľať znova.
- **Kalendár obsahu.** Mesačný prehľad naplánovaných konceptov a zverejnených príspevkov zo všetkých projektov.
- **Banka nápadov.** Rýchly zápis nápadu, neskôr jedným klikom „Spraviť príspevky“. Pribúdajú aj z každého plánu.
- **Jeden obsah do viacerých kanálov.** Z devlogu alebo novinky vzniknú príspevky pre vybrané kanály
  a jazyky (SK/EN), každý podľa zvyklostí kanála a s tipom na zverejnenie.
- **3 iné háčiky.** Varianty príspevku s iným úvodom na A/B test alebo opätovné zdieľanie.
- **Výsledky.** Pri zverejnenom príspevku si zapíšeš zobrazenia, reakcie, kliky a poznámku.
  Najlepšie príspevky AI zohľadní v ďalšom pláne.
- **Orientačné časy zverejnenia** pre každý kanál.

Inšpirované funkciami nástrojov Buffer, Hootsuite, Later, FeedHive a Publer (kalendár, AI texty podľa kanála,
hlas značky, banka nápadov, recyklácia evergreen obsahu, jednoduchá analytika). Zámerne chýba automatické
publikovanie na siete, spoločná schránka, sledovanie konkurencie a schvaľovanie, ktoré pre jedného človeka nie sú potrebné.

## Technicky

- PHP 8.1+ bez frameworku, SQLite (`data/shade.sqlite`, vytvorí sa sama), document root `public/`.
- AI: Claude API cez oficiálne PHP SDK, štruktúrovaný JSON výstup. Bez API kľúča beží ukážkový režim so šablónami.
- UI v slovenčine a angličtine (`lang/*.json`), ďalší jazyk = ďalší súbor.

## Spustenie lokálne

```bash
composer install
php bin/set-password.php            # nastaví heslo do aplikácie
cp config.example.php config.php    # doplň ANTHROPIC kľúč (bez neho ukážkový režim)
php -S localhost:8000 -t public public/router.php
```

V `config.php` je model (`claude-opus-5-5` predvolene) a `effort`. Lacnejšia voľba je napríklad
`claude-sonnet-5-5` alebo `claude-haiku-5-5`. V konzole Anthropicu si nastav mesačný limit výdavkov.

## Nasadenie na subdoménu

1. Nahraj repozitár aj s `vendor/` (po `composer install --no-dev`).
2. Document root subdomény nastav na `public/` (Apache použije `public/.htaccess`).
3. Na serveri spusti `php bin/set-password.php` a vytvor `config.php`.
4. Priečinok `data/` musí byť zapisovateľný pre PHP a nesmie byť verejne dostupný (je mimo `public/`).
