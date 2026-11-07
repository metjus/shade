# Shade Print: generátor farebných modelov na 3D tlač

Webový generátor organických farebných modelov, ktoré sú od začiatku pripravené na tlač. Všetko beží v prehliadači, takže na hosting (shade.sk) stačí nahrať priečinok `print/` ako statické súbory. PHP ani build krok nie sú potrebné.

## Čo vie
- **Predlohy:** hríb, vtáčik, húsenica, kaktus v kvetináči a chobotnička. Každá má parametre, farby a náhodné variácie.
- **Tri režimy tlače:**
  - *Viac farieb naraz (AMS):* jeden objekt s farebnými dielmi, ktoré sa presne dotýkajú.
  - *Bez AMS, rozrezať na diely:* každá farba je samostatný diel s vôľou (predvolene 0,2 mm) a zarovnávacími kolíkmi. Kolíky sú buď otvory na kúsok filamentu 1,75 mm, alebo vytlačený kolík s otvorom.
  - *Jedna farba:* celý model ako jeden kus.
- **Kontrola tlačiteľnosti:** každá sieť je uzavretá (watertight, manifold), model má rovnú spodnú plochu na podložke a zobrazí sa hmotnosť PLA aj počet kúskov.
- **Export:**
  - *3MF pre Bambu Studio:* projekt s priradenými filamentmi 1..N v `Metadata/model_settings.config`.
  - *3MF s farbami:* štandard 3MF s `basematerials` a farbou na trojuholníkoch (OrcaSlicer, PrusaSlicer, Bambu 2.x).
  - *OBJ:* farby vo vrcholoch a názvy materiálov. Os Z smeruje hore, pri importe do Blenderu nastav Up axis = Z.

## Architektúra
Kód je rozdelený tak, aby jadro šlo neskôr použiť aj mimo webu, napríklad v moste do Blenderu.

```
js/core/      čisté JS moduly bez závislostí (bežia v prehliadači aj v Node)
  sdf.js        primitíva so signed distance a vyhodnotenie scény po farebných dieloch
  presets.js    parametrické predlohy (tvary + farby)
  model.js      vzorkovanie, rozdelenie podľa farieb, vôľa a kolíky, výstup dielov
  mesher.js     marching tetrahedra, odstránenie úlomkov, vyhladenie s projekciou na povrch
  check.js      kontrola uzavretosti, objem a ostrovy
js/export/    3MF (štandard + Bambu), OBJ, ZIP writer
js/ui/        rozhranie a three.js náhľad
js/worker.js  generovanie vo Web Workeri
vendor/       three.js 0.160 (lokálna kópia, bez CDN)
```

Farebné diely vznikajú z jedného poľa vzdialeností. Každý bod telesa patrí farbe, ktorej tvar je najbližšie. Hranice dielov preto na seba presne sedia a v režime bez AMS sa každý diel zmenší o polovicu vôle.

## Testy
```
cd print
node tests/core.test.js        # všetky predlohy a režimy: uzavreté siete, nič pod podložkou
node tests/export.test.js out  # vzorové 3MF a OBJ súbory do priečinka out/
```

Lokálne spustenie: `python3 -m http.server` v priečinku `print/` a otvoriť http://localhost:8000.
