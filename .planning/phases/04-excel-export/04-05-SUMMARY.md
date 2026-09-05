---
phase: 04-excel-export
plan: 05
subsystem: het-exportscherm
tags: [export, xlsx, beheer, scherm, i18n, toegang]

requires:
  - "04-04: exportWerkmap(g) — één aanroep, één xlsx met vier bladen"
  - "lib/share.ts: shareXlsx, xlsxWordtOndersteund — de weg naar de gebruiker (D-13)"
  - "lib/period.ts: currentPeriod, bookingsInPeriod, periodLabel, periodFilename"
  - "components/ui/PeriodPicker.tsx"
  - "lib/rechten.ts: isAdmin"
provides:
  - "app/admin/export.tsx — het exportscherm achter de beheerdersgrens"
  - "de tegel Beheer → Club → Trainingen exporteren, alleen voor de beheerder"
  - "de Engelse tegenhangers van elke nieuwe zin"
affects:
  - "fase 5: het bestand dat hier ontstaat is het bestand dat de importer terugleest"

tech-stack:
  added: []
  patterns:
    - "een toegangsgrens die vóór élke hook moet staan wordt een buitenste component met de schermlogica in een tweede component erachter"
    - "een exportscherm toont de omvang van zijn selectie voor je klikt, met een .length en niet met eigen rekenwerk"

key-files:
  created:
    - app/admin/export.tsx
  modified:
    - app/admin/index.tsx
    - app/_layout.tsx
    - lib/i18n-en.ts

key-decisions:
  - "De beheerdersgrens staat in een buitenste component vóór elke hook; alles achter de grens zit in ExportInhoud. De vorm van app/admin/lesgroepen/index.tsx (vroege return, Screen scroll={false}, mutedzin) blijft, maar daar staan de hooks er nog vóór — hier mocht dat niet, want het plan vraagt de grens vóór álle schermlogica en useMemo/useState kunnen niet ná een voorwaardelijke return"
  - "Het scherm gebruikt useSimpleData rechtstreeks en geen useAgendaScope/CoachFilter: de export is club-breed (D-01), want de import van fase 5 leest een heel seizoen van alle trainers terug"
  - "De kaart telt lessen én lesgroepen, met de zin erbij dat de lesgroepen niet aan de periode hangen — ze staan allemaal in het bestand, met hún lessen binnen de periode. Dat is wat exportWerkmap werkelijk doet; een telling die 'groepen in de periode' suggereert zou het bestand verkeerd voorstellen"
  - "Op een telefoon staat er een zin in plaats van een knop; Historiek verbergt de knop daar stilletjes omdat de CSV blijft staan, maar hier zou er dan niets overblijven en dat leest als een kapot scherm"
  - "'Excel (.xlsx)' krijgt een Engelse regel die gelijk is aan de Nederlandse — zonder regel zou de knop als enige zin op dit scherm ontbreken en dat leest als vergeten"

requirements-completed: [EXP-01]

duration: ~20min
completed: 2026-09-06
---

# Phase 04 Plan 05: Het exportscherm Summary

**De vier bladen van 04-04 komen nu bij de beheerder terecht: Beheer → Club → "Trainingen
exporteren", één periode, één bestand — met de grens op het scherm zelf, want er is deze fase
geen tabel en dus geen policy die de fout achteraf nog opvangt.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 automatisch af, 1 checkpoint (menselijke controle) open
- **Files created:** 1
- **Files modified:** 3
- **Tests:** 1152 → 1152 (dit plan voegt geen tests toe; het is scherm, geen rekenwerk)

## Wat er gebouwd is

### Taak 1 — `app/admin/export.tsx`

- Kopcommentaar: één periode, één bestand met vier bladen, en waarom dit club-breed is en niet
  per trainer zoals Historiek — de import van fase 5 leest een heel seizoen terug, en een
  bestand met de helft van de trainers halveert die geschiedenis stilzwijgend.
- **De grens, vóór alle andere schermlogica.** `ExportScreen` haalt alleen `currentUser` op en
  geeft bij een niet-beheerder meteen `<Screen scroll={false}>` met
  `t('Exporteren is alleen voor de beheerder.')` terug. Het commentaar van
  `app/admin/lesgroepen/index.tsx` is overgenomen, met de aanvulling die dit scherm apart maakt:
  daar weigert de databank de trainer daarna óók, hier niet — deze fase voegt geen tabel toe,
  dus dit ís de enige grens (D-06, T-04-12/T-04-13).
- `ExportInhoud` draagt alles achter de grens: `useState<Period>(() => currentPeriod())`,
  `<PeriodPicker>`, en `useMemo(() => bookingsInPeriod(bookings, period), …)` — dezelfde
  periodefilter als Historiek en Rapport.
- Een `Card` met de omvang van de selectie: het aantal lessen in de periode en het aantal
  lesgroepen, allebei een `.length`, met de zin eronder dat de lesgroepen niet aan de periode
  hangen maar hun lessen wel.
- De knop in de vorm van `historiek.tsx`: alleen als `xlsxWordtOndersteund`, `disabled` zolang
  er geen lessen zijn, en bij indrukken
  `shareXlsx(periodFilename(period, 'xlsx'), exportWerkmap({ bookings: inPeriode, users, courts, groepen: lesGroepen }))`
  binnen een lokale `exporteer` met try/catch die de fout in een eigen `exportError` zet — los
  van de globale `error` van de provider, want een mislukte download is geen opslagfout.
- Geen `xlsxWordtOndersteund`: geen knop, maar `t('Een Excel-bestand maken kan alleen op de
  website.')` (T-04-15).
- Onder de knop de zin die de vier bladen bij naam noemt met `periodLabel(period)` erbij, en
  die vermeldt dat blad "Aanwezigheid" ook leeg uit te printen is als invullijst voor een
  vervanger zonder app (D-12) — dat is de reden dat het blad bestaat en niemand raadt dat.
- `lib/bestand.ts` wordt niet geïmporteerd (D-13); er wordt niets uitgerekend en geen blad
  samengesteld.

### Taak 2 — de tegel en de Engelse zinnen

- `app/admin/index.tsx`: in de groep **Club**, in een eigen
  `...(isAdmin(currentUser) ? [...] : [])`-blok naast `lesgroepen` en `leden`, de tegel
  "Trainingen exporteren" / "Eén Excel-bestand per periode", icoon `FileSpreadsheet` (nieuw in
  dit bestand, aan de bestaande importregel toegevoegd). Het commentaar zegt in de toon van de
  buren dat de tegel wegblijven wellevendheid is en geen bewaking.
- `lib/i18n-en.ts`: acht regels in de bestaande sectie "rapport en export", met de Nederlandse
  zin letterlijk als sleutel, en een commentaar dat de bladnamen bewust níet vertaald worden
  omdat de import ze op hun naam terugzoekt.

## Deviations from Plan

**1. [Rule 3 — Blokkade] De grens in een buitenste component in plaats van na de hooks**

- **Gevonden bij:** taak 1, bij het overnemen van de vorm van `app/admin/lesgroepen/index.tsx`.
- **Kwestie:** de `<action>` vraagt de grens "vóór alle andere schermlogica". In het analoog
  staan `useState`/`useMemo` er nog vóór — dat kan daar, maar het is niet wat dit plan vraagt.
  Hooks ná een voorwaardelijke `return` zetten is een regelovertreding van React en breekt bij
  de eerste hertekening.
- **Oplossing:** `ExportScreen` bevat alleen de grens en `ExportInhoud` alles daarachter. De
  vorm van het analoog (vroege `return`, `Screen scroll={false}`, `styles.muted`, het
  commentaar) blijft woordelijk; alleen de plaats van de hooks verschuift. De splitsing staat
  met reden in het bestand.
- **Bestand:** `app/admin/export.tsx`
- **Commit:** `a40285b`

**2. [Rule 2 — Ontbrekend en nodig] Het scherm geregistreerd in `app/_layout.tsx`**

- **Gevonden bij:** taak 1. `files_modified` van het plan noemt `app/_layout.tsx` niet, maar
  elk ander beheerscherm staat in de `SCREENS`-lijst daar. Zonder regel krijgt het scherm de
  routenaam "export" als kop in plaats van "Trainingen exporteren".
- **Oplossing:** één regel toegevoegd tussen `admin/boekingstijden` en `admin/leden`, met de
  vertaling die de tegel ook gebruikt.
- **Bestand:** `app/_layout.tsx`
- **Commit:** `a40285b`

**3. Op een telefoon een zin in plaats van stilte (geen afwijking, wel een keuze)**

`04-PATTERNS.md` noemt het verbergen van de knop als bestaande gewoonte van Historiek. Daar
blijft de CSV-knop staan; hier zou het blok leeg zijn. Het plan schrijft de zin ook expliciet
voor, en dat is gevolgd.

Verder niets: geen tabel, geen kolom, geen pakket, geen SQL, geen verbinding met Supabase.

## Verification

```
npx tsc --noEmit                → schoon (geen uitvoer, exit 0)
npm test                        → 47 suites, 1152 tests groen (2,0 s)
npx expo export --platform web  → Exported: .webbuild-check (exit 0), daarna verwijderd
                                  web bundle 3,79 MB
git diff --stat package.json package-lock.json → leeg
git diff --stat supabase-schema.sql            → leeg
```

Acceptatiecriteria, gemeten:

```
grep -c 'isAdmin' app/admin/export.tsx                                   2   (>=1 gevraagd)
grep -n 'isAdmin\|bookingsInPeriod' app/admin/export.tsx | head -1       regel 21: isAdmin
grep -c 'lib/bestand' app/admin/export.tsx                               0   (D-13)
grep -c 'shareXlsx\|xlsxWordtOndersteund' app/admin/export.tsx           4   (>=2 gevraagd)
grep -c 'exportWerkmap' app/admin/export.tsx                             1+1 (import + aanroep)
grep -c 'useAgendaScope\|CoachFilter' app/admin/export.tsx               0   (club-breed)
grep -cE '"[A-Z][a-z]+ [a-z]+"' app/admin/export.tsx                     0   (geen harde Engelse tekst)
grep -c 'buildXlsx\|buildWorkbook\|payoutsByCoach\|lesgeverId' …         0   (het scherm rekent niets uit)
grep -c "admin/export" app/admin/index.tsx                               1   (regel 98, in het isAdmin-blok van regel 97)
grep -c "Trainingen exporteren" lib/i18n-en.ts                           2
onvertaalde-zinnenlus over app/admin/export.tsx en app/admin/index.tsx   geen uitvoer
```

Geen SQL gedraaid, geen verbinding met Supabase, geen pakket geïnstalleerd.

## Threat Flags

Geen nieuwe aanvalsoppervlakte buiten wat het dreigingsregister al noemt.

- **T-04-12** (rechtstreekse URL) afgedekt in code: `if (!isAdmin(currentUser))` als eerste, vóór
  elke hook. De werkelijke controle met een trainersaccount staat open in taak 3.
- **T-04-13** (verborgen tegel als enige grens) afgedekt: beide staan er, en het commentaar op
  allebei de plaatsen zegt welke van de twee telt.
- **T-04-14** (club-breed bestand op de schijf) blijft aanvaard, zoals gepland.
- **T-04-15** (een seizoen op een telefoon) afgedekt: geen knop, wel een zin.
- **T-04-SC** (npm-installs) afgedekt: `git diff package.json package-lock.json` is leeg.

## Known Stubs

Geen. Het scherm haalt zijn gegevens uit `useSimpleData()` en levert een echt bestand.

## Open: taak 3 — met de hand nalopen

Taak 3 is met opzet een menselijke controle en is **niet** uitgevoerd: Excel openen, een kolom
optellen en een niet-beheerder de link laten intikken zijn niet te automatiseren binnen deze
codebase. De negen stappen staan in `04-05-PLAN.md` onder `<how-to-verify>`. Let op stap 1: de
dev-server praat met de échte Supabase van de club — kijken en downloaden, niets wijzigen.

## Commits

- `a40285b` feat(export): de beheerder kiest een periode en krijgt er één Excel-bestand van
- `0229663` feat(export): de tegel in Beheer, alleen voor de beheerder

## Self-Check: PASSED

- `app/admin/export.tsx` bestaat; `app/admin/index.tsx`, `app/_layout.tsx` en `lib/i18n-en.ts`
  zijn gewijzigd.
- Beide commits teruggevonden in `git log`.
- EXP-01 stond al als Complete in de traceerbaarheidstabel van `REQUIREMENTS.md` (gezet bij
  04-04, toen `exportWerkmap` af was); met dit plan is hij ook werkelijk bij de gebruiker
  aangekomen. De tabel is daarom ongewijzigd.
