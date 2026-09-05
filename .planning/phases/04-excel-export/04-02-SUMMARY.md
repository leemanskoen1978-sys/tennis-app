---
phase: 04-excel-export
plan: 02
subsystem: het-kolomformaat-van-de-export
tags: [xlsx, lessen, kolomformaat, round-trip, import-sjabloon, lib]

requires:
  - "04-01: buildWorkbook(bladen) en isoWeeknummer(iso)"
provides:
  - "ExportKolom, naarRijen, koppenVan, Opzoektabellen, opzoektabellen — de bouwstenen die de vier bladen delen"
  - "bladLessen(bookings, tabellen) — blad Lessen in exact het kolomformaat van .planning/IMPORT-SJABLOON.md"
affects:
  - "04-03 en 04-04: de drie andere bladen bouwen op dezelfde kolomtabel en dezelfde opzoektabellen"
  - "04-05: het exportscherm roept opzoektabellen + bladLessen aan"
  - "fase 5: de importer leest deze koprij en dit Groep-ID terug"

tech-stack:
  added: []
  patterns:
    - "één kolomtabel per blad (kop én cel naast elkaar) naar het model van CsvColumn in lib/csv.ts"
    - "één generieke celvertaler voor alle bladen — geen vier eigen celbouwers"
    - "de opzoektabellen één keer vóór de lus; nooit een .find() per rij"
    - "de koprij en de tabnaam als vaste Nederlandse literals: dit is een bestandsformaat, geen schermtekst"

key-files:
  created:
    - lib/export-trainingen.ts
    - lib/export-trainingen.test.ts
  modified: []

key-decisions:
  - "naarRijen en koppenVan zijn wél geëxporteerd: de test loopt de terugval (onbruikbare datum, getal dat er geen is) rechtstreeks na, op de regel zelf en niet via een blad dat toevallig een datumkolom heeft"
  - "De koprij en de tabnaam Lessen gaan niet door t(); een Engelse koprij zou een export onleesbaar maken voor de eigen import (EXP-07)"
  - "De Nederlandse weekdagnamen komen uit een vaste tabel in het bestand, niet uit toLocaleDateString: hetzelfde seizoen op twee toestellen moet twee gelijke bestanden geven"
  - "Een baan die verdwenen is (court_id wijst nergens heen) heet Onbekend; een les zonder court_id houdt Baan leeg — dat is wat het sjabloon voorschrijft. Indoor/Outdoor blijft in beide gevallen leeg"
  - "De zip-lezer uit lib/xlsx.test.ts is overgenomen in het nieuwe testbestand, met de reden erbij: hij is testgereedschap en hoort niet geëxporteerd te worden door de schrijver"

requirements-completed: [EXP-02, EXP-06, EXP-07]

duration: ~25min
completed: 2026-09-06
---

# Phase 04 Plan 02: Blad "Lessen" Summary

**`lib/export-trainingen.ts` bestaat: één kolomtabel, één celvertaler en één plek waar de
opzoektabellen gebouwd worden — en daarbovenop `bladLessen`, dat elke les uitklapt naar één
regel per leerling in exact de zestien koppen die de import van fase 5 terugleest.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 automatisch (beide TDD)
- **Files created:** 2
- **Files modified:** 0
- **Tests:** 1080 → 1112 (+32 in `lib/export-trainingen.test.ts`)

## Wat er gebouwd is

### Taak 1 — de gedeelde bouwstenen

`lib/export-trainingen.ts` opent met een kopcommentaar van acht regels dat de grens van de
module uitlegt: puur rekenwerk zonder databank en zonder scherm, dat zelf geen loon, geen prijs
en geen lesgever uitrekent maar het aan `lib/reports`, `lib/payments` en `lib/lesgever` vraagt.

- `export interface ExportKolom<R>` — `label`, `value`, `getal?`, `geld?`, `datum?`, `breedte`,
  letterlijk het model van `CsvColumn` in `lib/csv.ts`.
- `naarRijen(kolommen, items)` — de generieke celvertaler, dezelfde logica als
  `lib/csv.ts::toXlsx`: datum, dan getal/geld, anders tekst. Eén keer voor alle vier de bladen.
  Een onbruikbare datum en een getal dat geen eindig getal is vallen terug op de tekstvorm van
  die kolom.
- `koppenVan(kolommen)` — de labels letterlijk, met het commentaar dat uitlegt waaróm hier geen
  `t()` staat terwijl `lib/csv.ts::csvHeader` dat wél doet: de import leest deze koprij om te
  bepalen welke kolom waar staat.
- `Opzoektabellen` + `opzoektabellen(users, courts, groepen)` — drie Maps, één keer gebouwd, met
  de reden erbij (een seizoen is enkele duizenden rijen; `koen.xlsx` alleen al 1398 voor één
  trainer).

`lib/export-trainingen.test.ts` begint met de fixtures die beide taken delen: acht `User`s (twee
trainers, zes spelers), twee `Court`s (één binnen, één buiten), één `LesGroep` en een
`booking()`-helper met lokale tijden zonder `Z`. Gewone objecten; geen `jest.mock`, geen
`jest.fn`.

### Taak 2 — blad "Lessen"

- `interface LesRij` — de uitgeklapte rij: één les × één leerling, met alle namen al opgezocht.
- `lesRijen(bookings, tabellen)` — één `.flatMap()` over de op tijd gesorteerde kopie van de
  boekingen, per boeking `lessonPlayerIds(b)` en per leerling één rij. De meegegeven lijst blijft
  ongemoeid. "Wie gaf de les" komt uitsluitend uit `lesgeverId(b)`, met een commentaar dat naar
  `lib/lesgever.ts` verwijst en zegt wat een tweede antwoord kost.
- `LESSEN_KOLOMMEN` — de zestien koppen uit het `<column_contract>`, in volgorde:
  `Datum`, `Weekdag`, `Weeknr`, `Uur`, `Einduur`, `Type les`, `Groep`, `Groep-ID`, `Coach`,
  `Gaf de les`, `Leerling`, `E-mail leerling`, `Baan`, `Indoor/Outdoor`, `Spelers`, `Status`.
  Geen `Locatie` (D-09). De weekdagnamen komen uit `WEEKDAGEN`, een vaste tabel, met de reden
  erbij.
- `export function bladLessen(bookings, tabellen): XlsxBlad` — `naam: 'Lessen'` als vaste
  Nederlandse literal, koppen uit `koppenVan`, rijen uit `naarRijen`, breedtes uit de tabel.

Gedrag dat vastligt in de tests: een privéles is één rij met lege `Groep`, leeg `Groep-ID` en
`Type les` = `Privéles`; een groepsles van zes wordt zes rijen met dezelfde datum, hetzelfde uur
en hetzelfde `Groep-ID`, betaler vooraan, `Spelers` = 6 op elke rij; een vervanger laat `Coach`
en `Gaf de les` verschillen en zonder vervanger staan ze gelijk; `Indoor`/`Outdoor` volgt
`courts.indoor` en is leeg zonder baan; een verdwenen speler, trainer of baan houdt zijn rij met
`Onbekend`; de rijen staan op tijd oplopend; `Weeknr` van 1 januari 2027 is 53.

`describe('Lessen — round-trip')` haalt het blad door `buildWorkbook` en leest de zip weer uit
elkaar met dezelfde lezer als `lib/xlsx.test.ts`: alle vijf verplichte koppen en alle vier de
optionele die de import leest staan erin, er zijn er precies zestien, `Locatie` zit er niet bij,
de `Datum`-cel is een datumcel (`<c r="A2" s="..."><v>...</v></c>`, geen `inlineStr`) en de
groepsles plus de privéles leveren samen zeven regels onder de koprij.

## Deviations from Plan

Eén, en klein:

**1. [Rule 3 — Blokkade] Het woord `taught_by_id` uit een commentaar gehaald**
- **Gevonden bij:** taak 2, bij het nalopen van de acceptatiecriteria.
- **Kwestie:** het commentaar bij `lesgeverId` citeerde het verboden patroon letterlijk
  (`b.taught_by_id ?? b.coach_id`), waardoor `grep -c 'taught_by_id'` op `1` stond in plaats van
  op `0`. De code deed het goede, de tekst niet.
- **Oplossing:** hetzelfde commentaar in woorden ("wie hier de velden van de boeking zelf zou
  uitlezen, zet een tweede antwoord naast het eerste"). De waarschuwing blijft, de grep-controle
  van T-04-04 blijft bruikbaar als vangnet.
- **Bestand:** `lib/export-trainingen.ts`
- **Commit:** `0a7d91d`

Verder niets: geen tabel, geen kolom, geen pakket, geen SQL.

## Bewuste keuze bij "exporteer alleen wat nodig is"

Het plan liet de keuze om `naarRijen` en `koppenVan` binnen het bestand te houden. Ze zijn wél
geëxporteerd, om één reden: de terugvalregels (een onbruikbare datum wordt geen cel met 1899
erin, een getal dat geen getal is wordt tekst) zijn regels van de celvertaler zelf. Ze via
`bladLessen` testen zou ze afhankelijk maken van de toevallige aanwezigheid van een datum- of
getalkolom op dát blad. De reden staat als commentaar bij `naarRijen`.

## Verification

```
npx jest lib/export-trainingen   → 1 suite, 32 tests groen (0.40 s)
npx tsc --noEmit                 → schoon (geen uitvoer, exit 0)
npm test                         → 47 suites, 1112 tests groen (1.29 s)
npx expo export --platform web   → Exported: .webbuild-check (exit 0), daarna verwijderd
git diff --stat package.json package-lock.json → leeg
```

Acceptatiecriteria, gemeten:

```
grep -c 'jest.mock\|jest.fn' lib/export-trainingen.test.ts                     0
grep -c "from './providers|../providers|../components|../app" ...ts            0
grep -cE "\.find\(\(" lib/export-trainingen.ts                                 0
head -6 lib/export-trainingen.ts | grep -c '^//'                               6   (≥4 gevraagd)
grep -c 'taught_by_id' lib/export-trainingen.ts                                0
grep -c 'lesgeverId' lib/export-trainingen.ts                                  4   (≥1 gevraagd)
grep -c "'Locatie'" lib/export-trainingen.ts                                   0
alle zestien koppen letterlijk aanwezig                                        geen uitvoer
grep -c "t('Datum')|t('Groep')|t('Leerling')|t('Groep-ID')" ...ts              0
grep -v '^\s*//' lib/export-trainingen.test.ts | grep -c "Privéles"            2   (≥1 gevraagd)
```

Geen SQL gedraaid, geen verbinding met Supabase, geen pakket geïnstalleerd.

## Threat Flags

Geen nieuwe aanvalsoppervlakte: puur rekenwerk in `lib/`, geen scherm, geen netwerk, geen tabel.

- **T-04-03** (kolomformaat) afgedekt: de round-trip-test vergelijkt de geschreven koprij met de
  letterlijke lijst uit `.planning/IMPORT-SJABLOON.md`; hernoemen laat de test omvallen.
- **T-04-04** (`Gaf de les`) afgedekt: `grep -c taught_by_id` staat op `0`, de attributie loopt
  uitsluitend via `lesgeverId`.
- **T-04-05** (`E-mail leerling`) geaccepteerd zoals gepland; het bestand ontstaat pas op het
  beheerdersscherm van 04-05.
- **T-04-SC** (npm-installs) afgedekt: `git diff package.json package-lock.json` is leeg.

## Known Stubs

Geen. `bladLessen` is af en volledig gedekt. De drie andere bladen (04-03, 04-04) en het scherm
(04-05) bestaan nog niet — dat is de planning, geen stub: `bladLessen` levert nu een werkmap met
één tabblad en dat blad is compleet.

## Commits

- `130f751` test(export): de bouwstenen van het exportbestand, met echte gegevens
- `8752e92` feat(export): één kolomtabel en één celvertaler voor alle bladen
- `9146e23` test(export): blad Lessen moet het kolomformaat van de import teruggeven
- `0a7d91d` feat(export): blad Lessen, één regel per les en leerling

## Self-Check: PASSED

- `lib/export-trainingen.ts` en `lib/export-trainingen.test.ts` — beide aanwezig.
- Alle vier de commits teruggevonden in `git log`.
