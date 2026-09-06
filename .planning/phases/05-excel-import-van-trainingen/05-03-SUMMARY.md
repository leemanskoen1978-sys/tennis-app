---
phase: 05-excel-import-van-trainingen
plan: 03
subsystem: de xlsx-lezer — de zip-wandeling, de XML-ontleding en de datum/tijd-omrekening
tags: [import, xlsx, zip, xml, sharedstrings, datum, tijd, geen-pakket]
requires:
  - "lib/inflate.ts: inflate(bytes, verwachteLengte?) (plan 05-01)"
  - "lib/xlsx.ts: crc32, kolomLetter, datumNaarSerie, buildXlsx, zip (bestaand)"
provides:
  - "lib/xlsx-lezen.ts: leesZip(bytes) — de ingangen van een zip, uitgepakt en op hun crc32 nagerekend"
  - "lib/xlsx-lezen.ts: leesWerkmap(bytes) — de bladen met hun naam en een rooster van rauwe teksten"
  - "lib/xlsx-lezen.ts: leesBlad(xml, gedeeld), leesSharedStrings(xml), letterNaarKolom(letters), ontsnapTerug(tekst), bytesNaarTekst(bytes)"
  - "lib/xlsx-lezen.ts: serieNaarDatum(serie), fractieNaarTijd(fractie)"
affects: []
tech-stack:
  added: []
  patterns:
    - "de offset uit de centrale map, maar de naam- en extra-lengte uit de lokale kop — de twee spreken elkaar tegen in een echt bestand van Excel"
    - "elke uitlezing van een lengte of offset eerst tegen bytes.length, want elk getal in een zip komt uit het bestand zelf"
    - "de controlesom die het bestand zelf meedraagt als test: het enige bewijs dat de uitpakker klopt op een bestand dat je nooit gezien hebt"
    - "rauwe teksten uit de lezer, geen omzetting naar getallen — de betekenis van een kolom is de zaak van de import"
    - "het echte koen.xlsx als fixture in plaats van een nagebouwd voorbeeld (D-19)"
key-files:
  created: [lib/xlsx-lezen.ts, lib/xlsx-lezen.test.ts]
  modified: []
decisions:
  - "De naamlengte en de extra-lengte komen uit de lokale kop, alleen de offset uit de centrale map: in koen.xlsx staat centraal overal extra-lengte 0 terwijl de lokale kop van [Content_Types].xml er 520 heeft (en drie andere ingangen 264). Bewezen met een crc-gecontroleerde test op precies die ingang."
  - "Elke ingang wordt na het uitpakken op zijn eigen crc32 uit de lokale kop nagerekend; een verschil is een fout, geen waarschuwing (T-05-06)"
  - "fractieNaarTijd rondt eerst de tótale minuten af en splitst pas dan: 0.58333333333333337 × 24 = 13.999999999999998, en Math.floor daarvan geeft 13 (D-20)"
  - "serieNaarDatum geeft kale jaar/maand/dag-getallen en geen Date — een Date sleept een tijdzone mee en een avondles wordt dan de dag ervoor (D-15)"
  - "De bladnaam wordt via r:id en xl/_rels/workbook.xml.rels aan zijn bestand gekoppeld, nooit op volgorde geraden: in koen.xlsx heet het blad Sheet1 en het bestand worksheets/sheet1.xml, maar dat is toeval en geen regel"
  - "Een ingang met vlagbit 3 (data-descriptor, lengtes pas ná de gegevens) wordt geweigerd in plaats van geraden"
  - "ontsnapTerug zet &amp; als laatste terug, anders wordt &amp;lt; het teken < in plaats van de tekst &lt;"
  - "lib/import-trainingen.ts bestaat bewust nog niet: de lezer wordt eerst bewezen (D-19)"
metrics:
  duration: ~40 min
  completed: 2026-09-06
  tasks: 3
  tests_before: 1249
  tests_after: 1287
---

# Phase 5 Plan 03: De xlsx-lezer — Summary

`koen.xlsx` — het echte bestand van de club, 68.574 bytes uit Excel — leest uit tot 1399 rijen
met de bekende koprij, de bekende eerste rij, zeven groepen, één coach en 42 leerlingen, en elke
uitgepakte ingang klopt op de controlesom die de zip zelf meedraagt.

## Wat er gebouwd is

**`lib/xlsx-lezen.ts` (361 regels)**

| Blok | Wat het doet |
|---|---|
| Kopcommentaar | Het spiegelbeeld van `lib/xlsx.ts`: die mag onverpakt schrijven, een bestand van Excel is altijd ingepakt. De redenering van de zip-lezer in `lib/xlsx.test.ts` ("leesbaar voor een programma dat het formaat kent") blijft gelden; wat erbij komt is methode 8 en de crc-controle |
| `grens`, `u16`, `u32` | Elke uitlezing eerst tegen `bytes.length` — elk getal in een zip is onvertrouwde invoer (T-05-05) |
| `leesZip(bytes)` | Staart van de centrale map van achteren zoeken, per rij de offset pakken, dan de lokale kop lezen voor methode, lengtes, naamlengte en extra-lengte. Methode 0 = zoals ze staan, 8 = `inflate(...)`, iets anders = een fout die het nummer noemt. Daarna `crc32(inhoud)` tegen de crc uit de kop |
| `bytesNaarTekst(bytes)` | UTF-8 met de hand, spiegel van `utf8()` in `lib/xlsx.ts`, inclusief surrogaatparen — geen `TextDecoder`, om dezelfde reden |
| `ontsnapTerug(tekst)` | De vijf entiteiten van `xml()`, met `&amp;` als laatste en de reden erbij |
| `leesSharedStrings(xml)` | De `<si>`-blokken op volgorde, meerdere `<r><t>`-stukken aaneengeplakt. Het commentaar zegt waarom `<v>0</v>` de eerste tekst is en geen lege cel |
| `letterNaarKolom(letters)` | De omgekeerde van `kolomLetter`, 0-gebaseerd |
| `leesBlad(xml, gedeeld)` | Rijen op hun `r`-nummer, cellen op hun kolomletter. `t="s"` opzoeken, `t="inlineStr"` uit `<is><t>`, `t="str"` en geen `t` letterlijk uit `<v>`. Rauwe tekst, geen getallen |
| `leesWerkmap(bytes)` | `xl/workbook.xml` voor naam + `r:id`, `xl/_rels/workbook.xml.rels` voor `rId` → doel, `xl/sharedStrings.xml` als hij bestaat, dan elk blad. Het pad uit de relatie krijgt `xl/` ervoor omdat het relatief is aan die map |
| `serieNaarDatum(serie)` | Dagen sinds 30 december 1899, met de verzonnen schrikkeldag van 1900 opnieuw uitgelegd. Kale getallen, geen `Date` |
| `fractieNaarTijd(fractie)` | Eerst `Math.round(fractie * 24 * 60)`, dan pas splitsen — met `13.999999999999998` in het commentaar |

**`lib/xlsx-lezen.test.ts` (354 regels, 38 tests)** — met bovenaan `koenBytes()`, die het échte
bestand uit de projectmap leest, en een commentaar waarom dat het punt is (D-19). Geen
`jest.mock`, geen `jest.fn`, geen `Date.UTC` in de tests.

## Wat de lezer in `koen.xlsx` aantrof

| Vraag | Antwoord |
|---|---|
| Ingangen in de zip | 10, alle met opslagmethode 8 |
| `xl/worksheets/sheet1.xml` | 526.954 bytes, crc32 `0x35baed35` — klopt |
| `[Content_Types].xml` (520 bytes extra veld) | 1168 bytes, crc32 `0x689dee62` — klopt |
| Bladen | 1, met naam `Sheet1`, gevonden via `rId1` |
| Rijen | 1399, waarvan 1 koprij en 1398 gegevensrijen, alle met tien gevulde cellen |
| Koprij | `Datum, Weekdag, Weeknr, Uur, Type les, Groep, Coach, Leerling, Locatie, Indoor/Outdoor` |
| Rij 2 | `46274, woensdag, 37, 0.58333333333333337, Duoles, Groep 4, Leemans Koen, de Clippele Antoine, GANTOISE, Indoor` |
| Periode | 9 september 2026 tot en met 25 juni 2027 |
| Groepen | 7 verschillende |
| `Groep 8` | drie momenten: woensdag 17:00, vrijdag 17:00 en vrijdag 19:00 (D-02) |
| Coaches | 1: `Leemans Koen` |
| Leerlingen | 42 verschillende |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `buildXlsx` schrijft zes ingangen, niet tien**

- **Found during:** taak 1
- **Issue:** `<behavior>` zei "leest terug tot dezelfde tien bestandsnamen die `buildXlsx` erin
  stopt". `buildXlsx` in `lib/xlsx.ts` schrijft er zes (`[Content_Types].xml`, `_rels/.rels`,
  `xl/workbook.xml`, `xl/_rels/workbook.xml.rels`, `xl/styles.xml`,
  `xl/worksheets/sheet1.xml`). De tien horen bij `koen.xlsx`.
- **Fix:** de heenweg-terugweg-test pint de zes echte namen; de tien staan in de test op
  `koen.xlsx`, waar ze thuishoren.
- **Files modified:** `lib/xlsx-lezen.test.ts`
- **Commit:** 7bb8635

**2. [Rule 2 - Ontbrekende afhandeling] Een ingang met een data-descriptor wordt geweigerd**

- **Found during:** taak 1
- **Issue:** `<fixture_feiten>` stelt vast dat `koen.xlsx` vlagbit 3 uit heeft staan. Staat dat
  bit bij een ander bestand wél aan, dan staan de lengtes in de lokale kop op nul en zoekt de
  lezer een ingang van nul bytes — een leeg blad zonder foutmelding.
- **Fix:** vlagbit 3 geeft nu een fout met de naam van de ingang erin.
- **Files modified:** `lib/xlsx-lezen.ts`
- **Commit:** 85c9f21

## Threat Flags

Geen. Er komt geen netwerk, geen bestandssysteem en geen schema bij: `lib/xlsx-lezen.ts` krijgt
bytes en geeft teksten terug. De drie dreigingen die het plan aan dit plan toewees zijn afgedekt:

| Threat ID | Waar |
|---|---|
| T-05-05 (misvormde centrale map) | `grens()` vóór elke uitlezing; twee tests op bytes die geen zip zijn |
| T-05-06 (inhoud past niet bij zijn controlesom) | `crc32(inhoud)` tegen de crc uit de lokale kop, per ingang |
| T-05-SC (npm-installs) | niets geïnstalleerd; `git diff --stat package.json package-lock.json` is leeg |

## Known Stubs

Geen. `lib/import-trainingen.ts` bestaat met opzet nog niet — dat is geen stub maar de kern van
D-19: de lezer staat vóór alles wat erop leunt.

## Verification

```
npx tsc --noEmit                → nul fouten
npx jest lib/xlsx-lezen         → 38 passed
npm test                        → 51 suites, 1287 tests passed
npx expo export --platform web  → gelukt (entry-bundle 3.81 MB)
git diff --stat package.json package-lock.json → leeg
git diff --stat lib/xlsx.ts     → leeg (de schrijver is ongewijzigd)
ls lib/import-trainingen.ts     → bestaat niet
```

## Self-Check: PASSED

- `lib/xlsx-lezen.ts` — FOUND
- `lib/xlsx-lezen.test.ts` — FOUND
- 7bb8635 `test(xlsx-lezen): het echte koen.xlsx moet uitpakken op zijn eigen controlesommen` — FOUND
- 85c9f21 `feat(xlsx-lezen): een werkmap van Excel uitpakken, ingepakt en al` — FOUND
- 1284ab3 `test(xlsx-lezen): gedeelde teksten, cellen op hun kolomletter, datum en uur` — FOUND
- 35cb97b `feat(xlsx-lezen): de cellen van een blad, met hun uur op het juiste uur` — FOUND
- f4a553e `test(xlsx-lezen): koen.xlsx bewijst zichzelf voor er importlogica bestaat` — FOUND
