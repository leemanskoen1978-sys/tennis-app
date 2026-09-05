---
phase: 04-excel-export
plan: 04
subsystem: het-aanwezigheidsblad-en-de-werkmap
tags: [xlsx, aanwezigheid, pivot, historiek, werkmap, lib]

requires:
  - "04-01: buildWorkbook(bladen)"
  - "04-02: ExportKolom, koppenVan, Opzoektabellen, opzoektabellen, bladLessen"
  - "04-03: bladUrenPerTrainer, bladGroepen"
  - "lib/aanwezigheid.ts: aanwezigheidVan — de drie standen"
  - "lib/groups.ts: lessonPlayerIds — wie er die dag bij stond"
  - "lib/lesgroepen.ts: lessenVanGroep — de lessen van een groep, op tijd"
provides:
  - "bladAanwezigheid(groepen, bookings, tabellen) — blad Aanwezigheid, per groep een blok met de lesdata in de kolommen en de spelers in de rijen"
  - "ExportGegevens + exportWerkmap(g) — één aanroep, één xlsx met vier bladen"
affects:
  - "04-05: het exportscherm roept exportWerkmap aan en geeft het bestand aan lib/share"
  - "fase 5: de importer leest blad Lessen en blad Groepen van dit bestand terug"

tech-stack:
  added: []
  patterns:
    - "een gekantelde tabel wordt met de hand als XlsxCel[][] gebouwd in plaats van de kolomtabel te verbuigen"
    - "de rijen van een historisch blad komen uit de lessen zelf, nooit uit het rooster van nu"
    - "boekingen in één gang op groep gebucket; lessenVanGroep sorteert daarna de emmer, niet de hele lijst"
    - "de werkmapfunctie rekent niets uit: opzoektabellen één keer, dan vier bladfuncties achter elkaar"

key-files:
  created: []
  modified:
    - lib/export-trainingen.ts
    - lib/export-trainingen.test.ts

key-decisions:
  - "De spelersrijen van blad Aanwezigheid komen uit lessonPlayerIds over de lessen van de periode; het roosterveld van de lesgroep wordt niet gelezen. Een test bewijst het in twee richtingen: iemand er vandaag bij zetten verandert het blad niet, en wie eruit gehaald is blijft staan"
  - "Blad Aanwezigheid wordt met de hand als XlsxCel[][] gebouwd en niet via naarRijen: elk groepsblok heeft zijn eigen aantal lesmomenten, en een kolomtabel gaat er nu juist van uit dat elke rij dezelfde kolommen heeft"
  - "Eén codepad voor ingevuld en voor leeg-afdrukbaar (D-12): geen vlag en geen tweede blad. Een periode waarin nog niets is afgevinkt levert vanzelf een lege, afdrukbare tabel op"
  - "X en afw als tekens, en een werkelijk lege cel bij niet ingevuld — geen 0 en geen streepje: er moet ruimte zijn om met de hand in te schrijven, en een streepje leest als 'ik heb gekeken en er was niemand'"
  - "Een geannuleerde les krijgt geen kolom: er is die dag niets gebeurd om af te vinken, en een lege kolom met een datum erboven laat een vervanger denken dat hij iets vergat"
  - "De groepsblokken staan op naam gesorteerd, net als blad Groepen, zodat twee exports van hetzelfde seizoen naast elkaar te leggen zijn"
  - "exportWerkmap rekent niets uit: opzoektabellen één keer, dan de vier bladfuncties in de volgorde Lessen, Uren per trainer, Aanwezigheid, Groepen"

requirements-completed: [EXP-01, EXP-04, EXP-06]

duration: ~25min
completed: 2026-09-06
---

# Phase 04 Plan 04: Blad "Aanwezigheid" en de werkmap Summary

**Het enige blad van deze fase zonder voorbeeld in de codebase staat er, en het draagt de val
van de fase: de spelersrijen komen uit de lessen van de periode zelf en nooit uit het rooster
van vandaag — plus `exportWerkmap`, dat met één aanroep de vier bladen in één xlsx zet.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 automatisch (beide TDD)
- **Files created:** 0
- **Files modified:** 2
- **Tests:** 1132 → 1152 (+20 in `lib/export-trainingen.test.ts`, 52 → 72)

## Wat er gebouwd is

### Taak 1 — blad "Aanwezigheid"

- `interface AanwezigheidBlok` — één groepsblok: de groepsnaam, de lesdata als `dd/mm`, en per
  speler zijn naam met zijn standen.
- `aanwezigheidBlokken(groepen, bookings, tabellen)` — bucket de boekingen in **één** gang op
  `group_id` (de afgezegde lessen vallen daar al weg), sorteert de groepen op naam, en laat
  `lessenVanGroep` daarna de emmer van díe groep op tijd zetten. Dat is met opzet: de functie
  die overal in de app "de lessen van deze groep, op tijd" beantwoordt blijft de bron van die
  sortering, maar ze loopt over de kleine emmer en niet over de hele boekingenlijst — anders is
  het bij tientallen groepen en duizenden lessen een herscan per groep (T-04-11).
- **De val, met commentaar erbij:** de spelersverzameling is één gang met `lessonPlayerIds`
  over de lessen van die groep. Het commentaar zegt in zoveel woorden dat het roosterveld van
  de lesgroep is wie er *nu* in de groep zit, dat wie er in maart bij stond in de lessen van
  maart staat, en wat het kost om dat te verwarren: een kind dat pas in mei bij kwam stond
  ineens op de lijst van oktober, en een kind dat in januari stopte was er nooit geweest — op
  een blad dat uitgeprint en ondertekend wordt.
- `standCel` — de drie standen als drie uitkomsten: `X` bij aanwezig, `afw` bij afwezig, en een
  tekstcel met een lege string bij `null`, met de reden erbij waarom die derde géén `0` of
  streepje wordt (D-01, D-12).
- `export function bladAanwezigheid(groepen, bookings, tabellen): XlsxBlad`, met
  `naam: 'Aanwezigheid'` als vaste Nederlandse letterlijke waarde. Koprij `Groep`, `Speler`,
  `Les 1` .. `Les N` waarbij N het hoogste aantal lessen van één groep is. Per groep een
  datumrij, dan één rij per speler, dan één lege rij. Breedtes: 22, 22 en de lesmomenten 7.

De blokindeling wordt met de hand als `XlsxCel[][]` gebouwd en niet via `naarRijen`. De afweging
staat als commentaar: elk blok heeft zijn eigen aantal gevulde kolommen, en de kolomtabel gaat
er nu juist van uit dat elke rij dezelfde kolommen heeft. Die tabel daarvoor verbuigen zou haar
voor de drie andere bladen minder duidelijk maken.

Gedrag dat in de tests vastligt: de koprij en de datumrij (`Groep 8`, `Datum`, `19/08`, `26/08`
— chronologisch, ook al staan de lessen in de verkeerde volgorde in de invoer); `X`, `afw` en de
echt lege cel op de juiste plaatsen; de spelers op naam gesorteerd; één lege rij na elk blok;
een groep zonder lessen krijgt geen blok; een verdwenen speler heet `Onbekend` en blijft staan;
een geannuleerde les levert geen extra kolom; de groep met de meeste lessen bepaalt het aantal
leskolommen; lege invoer geeft een leeg blad met alleen `Groep` en `Speler`.

En de verplichte val-test, in beide richtingen: twee spelers aan het rooster toevoegen levert
een **identiek** blad op (`toEqual`, en Wout en Nore staan er niet op), en een speler uit het
rooster halen laat Jules gewoon op het blad staan, omdat hij in de les van 19/08 zat.

### Taak 2 — `exportWerkmap`

- `export interface ExportGegevens` — `bookings`, `users`, `courts`, `groepen`, met het
  commentaar dat `bookings` al op de periode is afgebakend door het scherm (`bookingsInPeriod`
  uit `lib/period`), zodat alle vier de bladen over exact dezelfde selectie gaan en het bestand
  niet half over de ene en half over de andere periode kan lopen.
- `export function exportWerkmap(g: ExportGegevens): Uint8Array` — bouwt de opzoektabellen één
  keer en geeft ze door, roept de vier bladfuncties aan en levert
  `buildWorkbook([lessen, uren, aanwezigheid, groepen])`. Er wordt hier niets uitgerekend.
  Het commentaar legt de volgorde uit: "Lessen" vooraan omdat dat het blad is dat de import van
  fase 5 terugleest en waar de beheerder als eerste in kijkt.

Gedrag dat in de tests vastligt, met dezelfde kleine zip-lezer als in 04-02: de bytes beginnen
met de zip-handtekening; `sheet1.xml` tot en met `sheet4.xml` zitten erin; `xl/workbook.xml`
noemt `Lessen`, `Uren per trainer`, `Aanwezigheid`, `Groepen` in die volgorde; blad 1 bevat
`Mathis`, blad 2 `Koen`, blad 3 een `X` en blad 4 `Groep-ID`; de `Datum`-cel op blad 1 is
`<c r="A2" s="3">` (datumcel, geen `inlineStr`) en de `Loon`-cel op blad 2 `<c r="D2" s="2">`
(geldcel); lege invoer levert vier bladen met elk precies één rij (de koprij) en werpt niets;
twee aanroepen met dezelfde invoer leveren hetzelfde bestand.

## Deviations from Plan

Eén, en van dezelfde soort als in 04-02 en 04-03: een commentaar herschreven om een
grep-vangnet bruikbaar te houden.

**1. [Rule 3 — Blokkade] De val benoemd zonder het veld letterlijk te citeren**

- **Gevonden bij:** taak 1, bij het schrijven van het commentaar boven de spelersverzameling.
- **Kwestie:** de `<action>` vraagt een commentaar dat de val benoemt en citeert daarbij
  `LesGroep.roster`. Het acceptatiecriterium van dezelfde taak eist dat
  `grep -c '\.roster' lib/export-trainingen.ts` op `1` blijft — alleen de telling `Spelers` op
  blad "Groepen" mag dat veld lezen. Het veld letterlijk in het commentaar zetten zou die
  telling op `2` brengen en het vangnet van T-04-09 onbruikbaar maken: wie later per ongeluk
  het rooster zou lezen, zou dat niet meer aan de grep zien.
- **Oplossing:** de val staat er voluit, maar in woorden: "het roosterveld van de lesgroep",
  met de verwijzing naar het kopcommentaar van `lib/lesgroepen` erbij. De waarschuwing is
  volledig, de grep-controle blijft bruikbaar, en de test bewijst het gedrag in twee richtingen.
- **Bestand:** `lib/export-trainingen.ts`
- **Commit:** `64e847e`

**2. Kleine correctie in een eigen testverwachting (geen afwijking van het plan)**

De test "geeft evenveel leskolommen als de groep met de meeste lessen" verwachtte de datumrij
van Groep 8 op rij 3; met de lege scheidingsrij erbij is dat rij 4. De verwachting is
rechtgezet in dezelfde GREEN-stap, en de lege rij wordt er nu expliciet in nagekeken.

Verder niets: geen tabel, geen kolom, geen pakket, geen SQL, geen verbinding met Supabase.

## Verification

```
npx jest lib/export-trainingen  → 1 suite, 72 tests groen (0,63 s)
npx tsc --noEmit                → schoon (geen uitvoer, exit 0)
npm test                        → 47 suites, 1152 tests groen (1,47 s)
npx expo export --platform web  → Exported: .webbuild-check (exit 0), daarna verwijderd
git diff --stat package.json package-lock.json → leeg
```

Acceptatiecriteria, gemeten:

```
grep -c '\.roster' lib/export-trainingen.ts                         1   (exact 1 gevraagd)
grep -c 'lessonPlayerIds' lib/export-trainingen.ts                  4   (>=2 gevraagd)
grep -c 'aanwezigheidVan' lib/export-trainingen.ts                  3   (>=1 gevraagd)
grep -v '^\s*//' ...test.ts | grep -c 'roster'                      9   (>=2 gevraagd)
grep -c 'omitAttendance\|leegAfdrukken' lib/export-trainingen.ts    0
grep -c 'export function exportWerkmap' lib/export-trainingen.ts    1
grep -c 'buildWorkbook' lib/export-trainingen.ts                    2   (>=1 gevraagd)
grep -c 'opzoektabellen(' lib/export-trainingen.ts                  2   (>=1, aanroep in exportWerkmap)
grep -v '^\s*//' ...test.ts | grep -c 'sheet4.xml'                  3   (>=1 gevraagd)
grep -v '^\s*//' ...test.ts | grep -c 'Uren per trainer'            5   (>=1 gevraagd)
grep -c "from './providers|../providers|../components|../app" ...ts 0
grep -cE '\.find\(\(' lib/export-trainingen.ts                      0
grep -c 'jest.mock\|jest.fn' lib/export-trainingen.test.ts          0
```

Geen SQL gedraaid, geen verbinding met Supabase, geen pakket geïnstalleerd.

## Threat Flags

Geen nieuwe aanvalsoppervlakte: puur rekenwerk in `lib/`, geen scherm, geen netwerk, geen tabel.

- **T-04-09** (historische aanwezigheid) afgedekt: de rijen komen uit `lessonPlayerIds` van de
  lessen zelf, `grep -c '\.roster'` staat op `1`, en de test bewijst het in twee richtingen.
- **T-04-10** (club-brede gegevens in één bestand) blijft zoals gepland: `exportWerkmap` is een
  functie in `lib/`; het bestand ontstaat pas op het beheerdersscherm van 04-05, achter `isAdmin`.
- **T-04-11** (een seizoen van de hele club) afgedekt: de opzoektabellen worden één keer in
  `exportWerkmap` gebouwd, er is geen `.find()` per rij, en blad "Aanwezigheid" buckert de
  boekingen in één gang in plaats van per groep de hele lijst te herlezen.
- **T-04-SC** (npm-installs) afgedekt: `git diff package.json package-lock.json` is leeg.

## Known Stubs

Geen. De vier bladen zijn af en `exportWerkmap` levert het volledige bestand. Er is nog geen
scherm dat de functie aanroept — dat is plan 04-05, en dat is planning, geen stub.

## Commits

- `a61e407` test(export): blad Aanwezigheid moet de spelers van toen tonen, niet die van nu
- `64e847e` feat(export): blad Aanwezigheid, met wie er die dag werkelijk bij stond
- `dcd0bb5` test(export): één aanroep moet vier bladen in één bestand geven
- `971747d` feat(export): één aanroep levert het bestand met de vier bladen

## Self-Check: PASSED

- `lib/export-trainingen.ts` en `lib/export-trainingen.test.ts` — beide aanwezig en gewijzigd.
- Alle vier de commits teruggevonden in `git log`.
</content>
</invoke>
