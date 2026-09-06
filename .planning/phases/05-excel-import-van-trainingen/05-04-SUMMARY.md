---
phase: 05-excel-import-van-trainingen
plan: 04
subsystem: de kolomtabel van de trainingenimport — de koprij, de cellen en het sjabloon
tags: [import, trainingen, koprij, datum, uur, sjabloon, geen-pakket]
requires:
  - "lib/xlsx-lezen.ts: leesWerkmap, serieNaarDatum, fractieNaarTijd, GelezenBlad (plan 05-03)"
  - "lib/xlsx.ts: buildXlsx, XlsxCel (bestaand, ongewijzigd)"
provides:
  - "lib/import-trainingen.ts: KolommenLessen, LESSEN_KOPPEN, KopregelLessen, leesKopregelLessen"
  - "lib/import-trainingen.ts: ImportFoutLessen, bestandAfgekeurdLessen"
  - "lib/import-trainingen.ts: leesDatumCel(waarde), leesUurCel(waarde), kiesLessenBlad(bladen)"
  - "lib/import-trainingen.ts: LesRegel, GelezenLessen, leesLesRegels(rijen)"
  - "lib/import-trainingen.ts: voorbeeldTrainingenXlsx() — het sjabloon van IMP-01"
affects: []
tech-stack:
  added: []
  patterns:
    - "de koprij is de enige waarheid over waar wat staat; de kolomvolgorde doet er niet toe"
    - "een Map en geen object-letterlijk voor de kopnamen — geen Object-eigenschap kan een kolom lijken"
    - "een aparte Set van bewust genegeerde koppen, zodat de eigen export geen ruis oplevert"
    - "elke celvorm in twee gedaantes: zoals Excel hem opslaat én zoals de export hem schrijft"
    - "één regel in het bestand levert precies één mededeling op — nooit twee"
    - "het sjabloon en de lezer in hetzelfde bestand, want ze zijn dezelfde tabel van twee kanten"
key-files:
  created: [lib/import-trainingen.ts, lib/import-trainingen.test.ts]
  modified: []
decisions:
  - "Een tijdbreuk wordt herkend aan `^0*\\.\\d+$` en niet aan 'is het een getal': `09.30` is half tien en geen 9,3 dagen, terwijl `0.625` juist wél de breuk is die Excel zelf in de cel zet"
  - "leesDatumCel rekent zelf uit hoeveel dagen een maand heeft in plaats van een Date te vertrouwen: `new Date(2026, 1, 31)` wordt stilzwijgend 3 maart, en dat trekt een seizoen scheef zonder foutmelding"
  - "De dag staat vóór de maand, want dat is wat Nederlandse Excel schrijft; er is geen manier om 03/12/2026 zonder die afspraak te lezen"
  - "`Trainer`, `Lesgever`, `Speler`, `Niveau` en dergelijke zijn aliassen en geen onbekende koppen — het onbekende-geval is met `Lesbegeleider` getest"
  - "Acht koppen staan in KOPPEN_GENEGEERD (de vier van koen.xlsx plus Einduur, Gaf de les, Spelers, Status van de export): melden zou élke echte import met een lijstje ruis openen"
  - "bestandAfgekeurdLessen neemt een structurele vorm `{ regels, fouten }` aan in plaats van een concreet type, zodat plan 05-06 hem aan het volledige plan kan hangen zonder hem te herschrijven"
  - "De helper koenBytes() staat opnieuw in dit testbestand: elk lib/*.ts heeft precies één lib/*.test.ts ernaast, en een derde bestand met alleen testgerei zou die regel voor drie regels code doorbreken"
  - "Geen kolom voor de lesduur in het sjabloon (D-05): een kolom die altijd hetzelfde is, is een kolom die op regel 700 verkeerd ingevuld wordt"
metrics:
  duration: ~35 min
  completed: 2026-09-06
  tasks: 3
  tests_before: 1287
  tests_after: 1339
---

# Phase 5 Plan 04: De kolomtabel van de trainingenimport — Summary

De negen kolommen van `.planning/IMPORT-SJABLOON.md` staan in code: de koprij wijst ze aan
ongeacht volgorde, spelling of hoofdletters, de 1398 regels van `koen.xlsx` komen er zonder één
fout doorheen, en het sjabloon dat de app aanbiedt wordt door de import van diezelfde app
foutloos teruggelezen.

## Wat er gebouwd is

**`lib/import-trainingen.ts` (496 regels)**

| Blok | Wat het doet |
|---|---|
| Kopcommentaar | Waar de grens ligt: geen databank, geen scherm, geen bestand. Rijen tekst plus de huidige lijsten erin, een plan eruit (D-10) |
| `KolommenLessen` + `metKolomvelden` | Vijf verplichte velden (`datum`, `uur`, `groep`, `coach`, `leerling`) en vier optionele; `LESSEN_KOPPEN` eraan vastgeknoopt, met de Babel-reden voor een functie in plaats van `satisfies` |
| `KOPNAMEN_LESSEN` | Een `Map<string, keyof KolommenLessen>` met 28 schrijfwijzen, inclusief `groep-id`, `typeles`, `e-mailleerling`, `leerlingemail` |
| `KOPPEN_GENEGEERD` | Een `Set` van acht koppen die meelezen en niets betekenen: `weekdag`, `weeknr`, `weeknummer`, `einduur`, `locatie`, `indoor/outdoor`, `gafdeles`, `spelers`, `status` |
| `leesKopregelLessen` | De koprij als enige waarheid; eerste kolom wint, tweede in `dubbel` (T-05-08). `nietHerkend` en `dubbel` worden óók gevuld als een verplichte kolom ontbreekt |
| `ImportFoutLessen` | Regelnummer plus een vaste zin met `{plaatshouders}` en aparte `vars` — nooit een aaneengeplakte tekst, zodat het scherm er `t(reden, vars)` op kan doen |
| `bestandAfgekeurdLessen` | Precies één fout op regel 1 en geen enkele gelezen regel |
| `leesDatumCel` | Serienummer via `serieNaarDatum`, of `DD/MM/JJJJ` met `/`, `-` of `.`. Eigen `dagenInMaand` met schrikkelregel |
| `leesUurCel` | Tijdbreuk via `fractieNaarTijd`, of `HH:MM` / `H:MM` / `HH.MM`. Buiten 0-23 en 0-59 is `null` |
| `kiesLessenBlad` | Het blad `Lessen` (hoofdletterongevoelig), anders het eerste — want het bestand van de club heet `Sheet1` |
| `LesRegel` + `leesLesRegels` | Eén lineaire pas (T-05-10). Getrimde tekstvelden, ontbrekende optionele kolommen als lege tekst en niet `undefined` |
| `KOPPEN_SJABLOON` + `voorbeeldTrainingenXlsx` | Blad `Lessen`, negen Nederlandse koppen, twee regels van dezelfde les met twee leerlingen |

**`lib/import-trainingen.test.ts` (420 regels, 52 tests)** — geen `jest.mock`, geen `jest.fn`,
geen `Date.UTC`. Met `koenBytes()` voor het echte bestand.

## De volgordediscipline in `leesLesRegels`

Overgenomen uit `planImport`, want één regel in het bestand hoort tot precies één mededeling te
leiden — anders wordt een lijst van 1400 regels een lijst van 3000 meldingen die niemand naloopt:

1. Koprij-lijstjes eerst overnemen, dán pas afhaken op een ontbrekende verplichte kolom.
2. Een rij waarvan élke cel leeg is (ook bij alleen witruimte) wordt stil overgeslagen.
3. Datum, uur, coach, leerling — elk met een eigen `continue`, dus geen tweede melding op een
   rij die toch al afvalt.
4. Een lege `Groep` is uitdrukkelijk géén fout: dat is een privéles (IMPORT-SJABLOON).

## Wat `koen.xlsx` opleverde

| Vraag | Antwoord |
|---|---|
| Regels | 1398 `LesRegel`s |
| Fouten | 0 |
| `nietHerkend` | leeg — `Weekdag`, `Weeknr`, `Locatie` en `Indoor/Outdoor` zijn bewust genegeerd |
| Regel 2 | 9 september 2026, 14:00, `Duoles`, `Groep 4`, `Leemans Koen`, `de Clippele Antoine` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `HH.MM` werd als kommagetal gelezen**

- **Found during:** taak 2
- **Issue:** `<behavior>` vraagt zowel `0.58333333333333337` (tijdbreuk) als `09.30` (half tien).
  Met de voor de hand liggende regel "is het een getal, dan een breuk" werd `09.30` het getal
  9,3 — groter dan één, dus `null`, en dus een onleesbaar uur op elke regel van een bestand dat
  de punt als scheiding gebruikt.
- **Fix:** een tijdbreuk wordt herkend aan `^0*\.\d+$` (ze is per definitie kleiner dan één dag);
  al het andere gaat langs het `HH:MM`/`HH.MM`-patroon. In het twijfelgeval `0.30` wint de breuk,
  want dat is wat Excel zelf in de cel zet. De reden staat als commentaar bij de functie.
- **Files modified:** `lib/import-trainingen.ts`
- **Commit:** cd49368

**2. [Rule 1 - Bug] Een test noemde `Trainer` onbekend**

- **Found during:** taak 1
- **Issue:** de test voor "vult `nietHerkend` ook als een verplichte kolom ontbreekt" gebruikte
  `Trainer` als onbekende kop, terwijl dat een volstrekt redelijke schrijfwijze voor `Coach` is
  en dus een alias hoort te zijn. De test had gelijk over het gedrag en ongelijk over het
  voorbeeld.
- **Fix:** `Trainer` blijft een alias; de test gebruikt nu `Lesbegeleider`.
- **Files modified:** `lib/import-trainingen.test.ts`
- **Commit:** 25ff83c

**3. [Rule 4 - niet gedaan, bewust] IMP-01 en IMP-02 blijven Pending in REQUIREMENTS.md**

- **Found during:** de afronding
- **Issue:** de frontmatter van dit plan noemt `requirements: [IMP-01, IMP-02]`. Maar IMP-01 is
  "de beheerder *kan een sjabloon downloaden*" en IMP-02 is "de beheerder *ziet een droogloop*" —
  allebei schermbeloftes. Dit plan levert de bytes en de regels; er is nog geen knop en nog geen
  overzicht.
- **Besluit:** niet afvinken. Een requirement dat als voltooid genoteerd staat terwijl niemand
  hem in de app kan gebruiken, is precies het soort stille onwaarheid dat deze planning wil
  voorkomen. Ze worden afgevinkt door het plan dat het scherm bouwt.
- **Files modified:** geen

## Threat Flags

Geen. Er komt geen netwerk, geen bestandssysteem en geen schema bij: `lib/import-trainingen.ts`
krijgt rijen tekst en geeft regels terug. De vier dreigingen die het plan aan dit plan toewees:

| Threat ID | Waar |
|---|---|
| T-05-08 (een kop die op een andere lijkt) | Alleen de koprij bepaalt de plek; de eerste kolom wint, de tweede komt in `dubbel`. Vier tests |
| T-05-09 (`E-mail leerling` in het sjabloon) | Verzonnen namen en adressen (`jonas@voorbeeld.be`), geen clubgegevens |
| T-05-10 (een blad met honderdduizend rijen) | `leesLesRegels` is één `for`-lus zonder geneste herscan |
| T-05-SC (npm-installs) | Niets geïnstalleerd; `git diff --stat package.json package-lock.json` is leeg |

## Known Stubs

Geen. Wat dit plan niet doet, doet het met opzet niet: er wordt nog geen les, groep of speler
gebouwd en er wordt niets tegen de club aan gehouden (bestaat deze coach? welke groep is dit?).
Dat is plan 05-06, en `bestandAfgekeurdLessen` is er al structureel op voorbereid.

## Verification

```
npx tsc --noEmit                → nul fouten
npx jest lib/import-trainingen  → 52 passed
npm test                        → 52 suites, 1339 tests passed
npx expo export --platform web  → gelukt (entry-bundle 3.81 MB)
git diff --stat package.json package-lock.json → leeg
git diff --stat lib/xlsx.ts     → leeg (de schrijver is ongewijzigd hergebruikt)
```

Acceptatiecriteria per taak, alle gehaald:

```
alle negen koppen letterlijk in import-trainingen.ts → geen uitvoer (dus alle negen aanwezig)
grep -c 'new Map<string, keyof KolommenLessen>'      → 1
grep -c 'KOPPEN_GENEGEERD'                           → 2
grep -c "from '../'" (buiten commentaar)             → 0
head -8 | grep -c '^//'                              → 8
grep -c 'jest.mock|jest.fn' (test)                   → 0
grep -c '0.58333333333333337' (test)                 → 1
grep -c '1398' (test)                                → 2
grep -c 'Date.UTC'                                   → 0
grep -c 'toISOString'                                → 0
grep -c 'serieNaarDatum|fractieNaarTijd'             → 5
grep -c '{waarde}|{naam}|{groep}'                    → 3
grep -c 'export function voorbeeldTrainingenXlsx'    → 1
grep -c "naam: 'Lessen'"                             → 1
grep -c "t('Datum')|t('Groep')|..."                  → 0
grep -c 'voorbeeldTrainingenXlsx' (test)             → 3
grep -c 'buildXlsx'                                  → 2
```

## Self-Check: PASSED

- `lib/import-trainingen.ts` — FOUND
- `lib/import-trainingen.test.ts` — FOUND
- 18e4a95 `test(import-trainingen): de koprij bepaalt waar wat staat, niet de volgorde` — FOUND
- 25ff83c `feat(import-trainingen): de koprij wijst de kolommen aan, de volgorde niet` — FOUND
- 3b41d71 `test(import-trainingen): een datum en een uur in beide vormen, en 1398 echte regels` — FOUND
- cd49368 `feat(import-trainingen): elke cel krijgt betekenis, of een regelnummer met een reden` — FOUND
- c3a0dc9 `test(import-trainingen): het sjabloon moet door de eigen import teruggelezen worden` — FOUND
- 9f6866d `feat(import-trainingen): een sjabloon dat de import zelf foutloos terugleest` — FOUND
