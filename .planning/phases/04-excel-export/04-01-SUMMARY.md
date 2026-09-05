---
phase: 04-excel-export
plan: 01
subsystem: gereedschap-voor-de-export
tags: [xlsx, werkmap, tabbladen, weeknummer, iso-8601, lib]

requires: []
provides:
  - "buildWorkbook(bladen) — N werkbladen in één xlsx-bestand, met de tabvolgorde van de aanroeper en zonder botsende tabnamen"
  - "isoWeeknummer(iso) — het ISO-weeknummer van een dag, ook aan beide kanten van de jaarwissel"
affects:
  - "04-02 en verder: de vier bladen van het exportbestand en de kolom Weeknr van blad Lessen"

tech-stack:
  added: []
  patterns:
    - "een nieuwe functie ernaast in plaats van een ruimere signatuur, zodat bestaande aanroepers met hun tests niet omvallen (D-07)"
    - "de drie vaste strings van buildXlsx als drie lussen over dezelfde bladenlijst; zip/crc32/utf8/bladXml/stijlenXml zijn al blad-onafhankelijk en blijven onaangeraakt"
    - "één gedeelde styles.xml voor alle bladen: een bedrag en een datum blijven op élk blad wat ze zijn"
    - "de week hoort bij het jaar van haar donderdag; week 1 is de week waarin 4 januari valt"

key-files:
  created: []
  modified:
    - lib/xlsx.ts
    - lib/xlsx.test.ts
    - lib/datetime.ts
    - lib/datetime.test.ts

key-decisions:
  - "buildWorkbook accepteert readonly XlsxBlad[] — hetzelfde bladtype dat buildXlsx al kent, alleen meervoudig; er is geen tweede vorm bijgekomen"
  - "Bij één blad levert buildWorkbook byte-voor-byte hetzelfde bestand als buildXlsx; dat is als test vastgelegd en bewijst dat er in de lussen niets is weggevallen"
  - "uniekeBladnamen is niet geëxporteerd en laat bladnaam() ongemoeid: bladnaam() maakt één naam schoon en weet niets van zijn buren, en dat blijft zo"
  - "Tabnaam-botsingen worden hoofdletterongevoelig geteld, want voor Excel zijn 'Lessen' en 'lessen' dezelfde tab"
  - "isoWeeknummer rekent op de lokale kalenderdag en telt in hele dagen (Date.UTC-verschil), niet in milliseconden: een zomertijdsprong maakt een dag 23 of 25 uur lang"

requirements-completed: [EXP-01, EXP-06]

duration: ~20min
completed: 2026-09-06
---

# Phase 04 Plan 01: Het gereedschap voor de export Summary

**`lib/xlsx.ts` schrijft nu een werkmap met meer dan één tabblad — `buildWorkbook` náást het
letterlijk onveranderde `buildXlsx` — en `lib/datetime.ts` weet in welke ISO-week een dag valt,
inclusief de jaarwissel waar een zelfgeschreven weeknummer altijd misgaat.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 automatisch (beide TDD)
- **Files created:** 0
- **Files modified:** 4
- **Tests:** 1060 → 1080 (+11 voor `buildWorkbook`, +9 voor `isoWeeknummer`)

## Wat er gebouwd is

### Taak 1 — `buildWorkbook` naast `buildXlsx`

`lib/xlsx.ts` (85 regels erbij, nul regels gewijzigd — `git diff --stat` toont alleen inserties):

- `export function buildWorkbook(bladen: readonly XlsxBlad[]): Uint8Array`, onder `buildXlsx`.
  De drie vaste strings die elk precies één blad hardcodeerden zijn drie lussen geworden:
  één `<Override PartName="/xl/worksheets/sheetN.xml" .../>` per blad in `[Content_Types].xml`,
  één `<sheet name=".." sheetId="N" r:id="rIdN"/>` per blad in `xl/workbook.xml`, en
  `rId1..rIdN` naar `worksheets/sheetN.xml` gevolgd door `rId(N+1)` naar `styles.xml` in
  `xl/_rels/workbook.xml.rels`. De `zip()`-aanroep krijgt de vijf vaste onderdelen plus één
  `xl/worksheets/sheetN.xml` per blad.
- `stijlenXml()` wordt één keer geschreven en door alle bladen gedeeld — daarmee blijft een
  `geld`-cel op blad 2 een getal met twee decimalen en een `datum`-cel een datumserie (EXP-06).
- `uniekeBladnamen(bladen)` is de enige nieuwe helper: niet geëxporteerd, roept per blad
  `bladnaam()` aan en hangt bij een botsing ` (2)`, ` (3)` … aan, binnen de 31 tekens die een
  tabnaam mag zijn. De eerste houdt zijn naam. Excel weigert een werkmap met twee gelijke tabs
  in zijn geheel, dus dit is geen nettigheid maar een openingsvoorwaarde.
- `buildXlsx`, `zip()`, `crc32()`, `utf8()`, `bladXml()`, `stijlenXml()`, `celXml()`,
  `datumNaarSerie()`, `kolomLetter()` en `bladnaam()` zijn niet aangeraakt. Het kopcommentaar
  bovenaan het bestand is ongewijzigd; `buildWorkbook` heeft zijn eigen doc-commentaar dat
  uitlegt waaróm hij ernaast staat (D-07: `lib/csv.ts` en Historiek roepen `buildXlsx` aan met
  hun eigen tests eromheen).

`lib/xlsx.test.ts`: een nieuw `describe('buildWorkbook', ...)` ná het onveranderde
`describe('buildXlsx', ...)`, met dezelfde `leesZip`/`inhoudVan`/`tekst` van bovenin — geen
tweede zip-lezer. Elf tests, allemaal op het bestand dat er werkelijk uitkomt: de acht
zip-ingangen in volgorde, de drie `<Override>`s, de tabvolgorde in `xl/workbook.xml`, elke
`rId` naar zijn eigen blad met de opmaak als laatste, de rijen op het blad waar ze horen,
`<v>27.5</v>` op blad 2, de datumserie op blad 2, drie keer dezelfde naam die drie
verschillende tabs oplevert, en — als vangnet — dat `buildWorkbook([blad])` byte-voor-byte
gelijk is aan `buildXlsx(blad)`.

### Taak 2 — `isoWeeknummer` in `lib/datetime.ts`

`lib/datetime.ts`:

- `export function isoWeeknummer(iso: Moment): number | null`, met de bestaande `parse()` voor
  de null-afhandeling — geen tweede ernaast. Geen `t()` en geen locale: een weeknummer is een
  getal, geen zin op het scherm.
- De rekenregel: zondag telt als dag 7, schuif naar de donderdag van dezelfde week (die
  donderdag bepaalt bij welk jaar de week hoort), en tel de weken sinds de maandag van de week
  waarin 4 januari van dát jaar valt. Alles op de lokale kalenderdag
  (`getFullYear/getMonth/getDate`), nooit UTC — dezelfde reden als bij `datumNaarSerie`: een les
  van 's avonds laat mag niet in de week ervoor belanden.
- Het verschil wordt in hele dagen geteld via een `Date.UTC`-verschil en niet in milliseconden
  op lokale tijd: bij een zomertijdsprong is een dag 23 of 25 uur en valt een deling op 24 uur
  net verkeerd uit.

`lib/datetime.test.ts`: `describe('isoWeeknummer', ...)` met ISO-strings zonder `Z`, in de stijl
van de buren. Negen tests: een gewone dag (18 aug 2026 → 34), 1 januari 2027 → 53 (week van
2026), 31 december 2025 → 1 (week van 2026), 31 december 2020 → 53 (een 53-wekenjaar),
4 januari → 1 in vier verschillende jaren, maandag en zondag van dezelfde week gelijk, een les
om 23:30 die niet naar de week ervoor schuift, een `Date` als invoer, en `null` bij onzin.

## Deviations from Plan

Geen. Beide taken zijn uitgevoerd zoals beschreven; er is niets bijgekomen dat het plan niet
noemde en niets weggelaten.

## Extra controle buiten de tests om

Het weeknummer is los van de eigen tests nagerekend tegen de bekende ISO-8601-voorbeelden uit
de literatuur (1977-01-01 → W53, 1978-01-02 → W01, 1979-12-31 → W01, 1980-12-29 → W01,
1981-12-31 → W53, 1982-01-03 → W53) en tegen twee invarianten over álle dagen van 1990 tot en
met 2060: 4 januari is elk jaar week 1, 28 december is elk jaar de laatste week, elk nummer
ligt tussen 1 en 53, en van maandag op maandag loopt het nummer met precies 1 op of terug naar
1. Nul afwijkingen. Dat script stond in de scratchpad en staat niet in de repo.

## Verification

```
npx tsc --noEmit                → schoon (geen uitvoer, exit 0)
npm test                        → 46 suites, 1080 tests, alles groen (1.3 s)
npx expo export --platform web  → Exported: .webbuild-check (exit 0), daarna verwijderd
git diff --stat package.json package-lock.json → leeg
git status --short              → leeg
```

Acceptatiecriteria, gemeten:

```
npx jest lib/xlsx lib/csv                                        2 suites, 100 tests groen
grep -c 'export function buildXlsx(blad: XlsxBlad): Uint8Array'  1   (signatuur ongewijzigd)
grep -c 'export function buildWorkbook' lib/xlsx.ts              1
grep -v '^//' lib/xlsx.test.ts | grep -c 'sheet3.xml'            4   (≥1 gevraagd)
grep -c 'jest.mock\|jest.fn' lib/xlsx.test.ts                    0
git diff --stat lib/xlsx.ts                                      85 inserties, 0 deleties

npx jest lib/datetime                                            20 tests groen
grep -c 'export function isoWeeknummer' lib/datetime.ts          1
grep -v '^//' lib/datetime.test.ts | grep -c '2027-01-01\|2025-12-31'  2   (≥1 gevraagd)
grep -c 'jest.mock\|jest.fn' lib/datetime.test.ts                0
```

Geen SQL gedraaid, geen verbinding met Supabase, geen pakket geïnstalleerd, geen tabel en geen
kolom erbij.

## Threat Flags

Geen nieuwe aanvalsoppervlakte: dit plan raakt alleen pure functies in `lib/` — geen scherm,
geen netwerk, geen tabel. T-04-01 (`buildXlsx` ongemoeid) is afgedekt: het bestand kent alleen
inserties en `npx jest lib/xlsx lib/csv` is groen. T-04-SC (npm-installs) is afgedekt:
`git diff package.json package-lock.json` is leeg.

## Known Stubs

Geen. Beide functies zijn af en volledig gedekt; ze wachten alleen nog op hun aanroeper in
04-02 en verder.

## Commits

- `7517308` test(export): een werkmap met meerdere tabbladen, weer uit elkaar gelezen
- `d3b9493` feat(export): vier tabbladen passen nu in één xlsx-bestand
- `76a1812` test(weeknummer): het weeknummer moet ook rond de jaarwissel kloppen
- `6994aba` feat(weeknummer): een dag weet in welke week hij valt

## Self-Check: PASSED

- `lib/xlsx.ts`, `lib/xlsx.test.ts`, `lib/datetime.ts`, `lib/datetime.test.ts` — alle vier
  aanwezig en gewijzigd.
- Alle vier de commits gevonden in `git log`.
