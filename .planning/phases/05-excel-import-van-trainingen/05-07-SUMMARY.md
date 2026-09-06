---
phase: 05-excel-import-van-trainingen
plan: 07
subsystem: de poort — het echte bestand van de club en de heen-en-terugweg met de export
tags: [import, trainingen, acceptatie, koen.xlsx, herimport, export, geen-productiecode]
requires:
  - "lib/import-trainingen.ts: planImportLessen, leesLesRegels, kiesLessenBlad, lesSleutel, spelerSleutel (plan 05-04 t/m 05-06)"
  - "lib/xlsx-lezen.ts: leesWerkmap (plan 05-03)"
  - "lib/export-trainingen.ts: bladLessen, opzoektabellen (fase 4, ongewijzigd)"
  - "lib/xlsx.ts: buildXlsx (bestaand, ongewijzigd)"
  - "koen.xlsx: de echte seizoensplanning van de club, 1398 regels"
provides:
  - "lib/import-trainingen.test.ts: describe('koen.xlsx — de acceptatie van IMP-10')"
  - "lib/import-trainingen.test.ts: describe('koen.xlsx twee keer inlezen')"
  - "lib/import-trainingen.test.ts: describe('heen en terug met de export van fase 4')"
affects: []
tech-stack:
  added: []
  patterns:
    - "het echte bestand één keer lezen en één keer plannen per describe-blok, niet per bewering"
    - "de verwachte uitkomst als gegevenstabel bovenaan het blok, zodat een verschoven groep zichzelf benoemt"
    - "de toestand na een import met de hand nabouwen in de test, zodat de test puur blijft"
key-files:
  created: []
  modified: [lib/import-trainingen.test.ts]
decisions:
  - "Er is géén productiecode aangeraakt: `git diff` op lib/import-trainingen.ts, lib/export-trainingen.ts en lib/xlsx.ts is leeg. Alles wat de tabel van het plan voorspelde, klopte in de bytes"
  - "Van de twee wegen die taak 1 aanbood voor de tweede opzet is gekozen voor 'de meldingen als bewijs': koen.xlsx heeft geen kolom Baan, en er een verzinnen zou een nagebouwd bestand testen in plaats van het bestand waarvoor deze fase gebouwd is"
  - "De toestand na de eerste import wordt in het testbestand met de hand samengesteld en niet via de uitvoerder van plan 05-08: die schrijft weg, en deze test moet puur blijven — dezelfde reden waarom planImportLessen puur is"
  - "IMP-06 en IMP-10 blijven Pending in REQUIREMENTS.md: allebei zijn ze geformuleerd als iets wat de beheerder ziet ('de droogloop meldt'), en het scherm komt pas in 05-09. Dezelfde lijn als 05-04, 05-05 en 05-06"
metrics:
  duration: ~35 min
  completed: 2026-09-06
  tasks: 2
  tests_before: 1420
  tests_after: 1441
---

# Phase 5 Plan 07: De poort — Summary

Het echte bestand van de club gaat van de eerste byte tot het volledige plan door de hele keten,
en levert exact op wat de planner in de bytes geteld had: tien groepen uit zeven namen, 42
leerlingen, 325 lesmomenten, nul ingeplande lessen en precies twee soorten melding. En wat de
export van fase 4 schrijft, leest deze import ongewijzigd terug.

## Wat er gebouwd is

Alleen tests. `lib/import-trainingen.test.ts` (1358 → 1616 regels, 133 → 154 tests), drie nieuwe
`describe`-blokken:

| Blok | Wat het bewijst |
|---|---|
| `koen.xlsx — de acceptatie van IMP-10` (11 tests) | Het echte bestand van bytes tot plan: 1398 regels zonder fout, tien groepen met hun eigen dag, uur, roster, lesmomenten en niveau, 42 spelers, nul lessen, en twintig meldingen die uitsluitend over de trainer en de baan gaan |
| `koen.xlsx twee keer inlezen` (5 tests) | Hetzelfde bestand tegen de toestand die het zelf opleverde: nul nieuwe groepen, nul nieuwe spelers, nul nieuwe lessen, tien keer `ongewijzigd` — en de derde ronde is gelijk aan de tweede |
| `heen en terug met de export van fase 4` (5 tests) | `bladLessen` → `buildXlsx` → `leesWerkmap` → `planImportLessen`: dezelfde groep terug, dezelfde drie lessen zonder verdubbeling, `Groep-ID` dat een hernoemde groep heel houdt, en een privéles die geen lesgroep wordt |

Alles gaat door één aanroep per blok: `koen.xlsx` wordt per `describe` één keer gelezen en één
keer gepland. 1398 rijen × elf beweringen zou elf keer hetzelfde werk zijn.

## De getallen, geteld op het echte bestand

De tabel uit het plan stond letterlijk in de test en klopte in één keer — geen enkel getal is
bijgesteld:

| Groep | weekdag | uur | spelers | lesmomenten | niveau |
| --- | --- | --- | --- | --- | --- |
| Groep 4 | woensdag | 14:00 | 2 | 33 | Duoles |
| Groep 12 | woensdag | 15:00 | 4 | 33 | Tienertennis geel |
| Groep 13 | woensdag | 16:00 | 6 | 33 | Oranje |
| Groep 8 | woensdag | 17:00 | 6 | 33 | Kidstennis oranje |
| Groep 26 | woensdag | 18:00 | 4 | 33 | Tienertennis geel |
| Groep 31 | vrijdag | 16:00 | 5 | 32 | Tienertennis geel |
| Groep 8 | vrijdag | 17:00 | 4 | 32 | Tienertennis geel |
| Groep 12 | vrijdag | 18:00 | 4 | 32 | Privéles |
| Groep 8 | vrijdag | 19:00 | 2 | 32 | Duoles |
| Groep 3 | vrijdag | 20:00 | 6 | 32 | Volwassenen - (her)starters |

Verder: **1398** gelezen regels, **0** fouten, **0** niet-herkende koppen, **0** dubbele koppen,
**42** nieuwe spelers (42 verschillende namen), **325** lesmomenten (5 × 33 + 5 × 32), **0**
ingeplande lessen, **0** overgeslagen, **20** meldingen — tien over de trainer `Leemans Koen`,
tien over de ontbrekende baan, en geen enkele over iets anders. Woensdaggroepen lopen van
2026-09-09 t/m 2027-06-23, vrijdaggroepen van 2026-09-11 t/m 2027-06-25. De drie groepen die
"Groep 8" heten hebben samen twaalf plaatsen en twaalf verschillende mensen: nul overlap.

Eén ding dat de tabel niet zegt en de test wel laat zien: de tien rosters tellen samen 43
plaatsen voor 42 mensen. Eén leerling zit dus in twee groepen — precies waarom een roster een
lijst ids is en geen eigendom van één groep.

## De twee ontbrekende schakels, apart bewezen

`koen.xlsx` kent geen kolom `Baan` en zijn coach heeft nog geen account. `LesGroep.coach_id` mag
leeg zijn en `LesGroep.court_id` ook — daarom komen de tien groepen er wél. `Booking.coach_id` en
`Booking.court_id` mogen dat niet — daarom komt er geen enkele les. Dat is geen tekortkoming van
de import maar de enige eerlijke uitkomst voor dit bestand.

Van de twee wegen die taak 1 aanbood voor de tweede opzet is gekozen voor **de meldingen als
bewijs**, en dat staat ook zo in het commentaar bij de test. De trainer valt op te lossen zónder
het bestand aan te raken: de kolom `Coach` staat er, met de achternaam vooraan, en `zoekOpNaam`
vindt daar "Koen Leemans" bij — zet je dat account in de ledenlijst, dan verdwijnen tien van de
twintig meldingen en houden de tien over de baan over. De baan valt niet zo op te lossen: die
kolom bestaat niet in dit bestand, en er een verzinnen zou betekenen dat de acceptatietest van
IMP-10 een nagebouwd bestand test in plaats van het bestand van de club. Dat een baan op het
scherm gekoppeld wordt en niet in dit bestand, is precies wat die tien overgebleven meldingen
zeggen.

## Bevinding: een hernoemde groep wordt herkend, maar niet hernoemd

**Dit is de enige echte bevinding van dit plan, en ze hoort niet hier gerepareerd te worden.**

De heen-en-terugtest hernoemt `Groep 8` in het geëxporteerde blad naar `Groep 8 gevorderden` en
leest het terug. Wat goed gaat: dankzij `Groep-ID` wordt de bestaande groep herkend (D-03) — ze
komt níét als nieuwe groep binnen, en de halve club wordt dus niet verdubbeld. Dat is waar de
kolom voor bestaat en dat werkt.

Wat er ontbreekt: de groep komt binnen als **`ongewijzigd`** en niet als `bijgewerkt`.
`groepWijzigingen` (lib/import-trainingen.ts, plan 05-06) vergelijkt `name` bewust niet, met de
redenering "naam, weekdag en beginuur vormen de sleutel waarmee de groep herkend werd, dus ze
zijn per definitie gelijk". Die redenering klopt bij een match op de sleutel en klopt juist níét
bij een match op `Groep-ID` — dat is precies het geval waarin de naam mág verschillen. Gevolg:
een beheerder die een groep in de export hernoemt en het bestand terugstuurt, krijgt te zien dat
er niets verandert, en de groep houdt haar oude naam. Hetzelfde geldt voor `weekday` en
`start_hour`: ook die kunnen bij een `Groep-ID`-match verschillen en worden niet bijgewerkt.
IMP-07 ("een aangepaste groep wordt aangepast") is daarmee voor deze weg nog niet waar.

De test legt vast wat er vandáág gebeurt, met een commentaar dat naar deze samenvatting
verwijst — het plan verbiedt uitdrukkelijk productiecode in dit plan en zegt dat een fix hoort
in het plan waar de logica woont. Wie dit oppakt: `groepWijzigingen` uitbreiden met `name`,
`weekday` en `start_hour` wanneer `groep.bestaand` via `Groep-ID` gevonden werd, plus een test
dat een sleutelmatch daardoor géén ruis krijgt.

## Wat er níét mis bleek

Twee dingen waar dit plan expliciet naar zocht en die in orde waren:

- **De koppen van export en import lopen niet uiteen.** De zestien koppen die `bladLessen`
  schrijft komen ongewijzigd door `leesKopregelLessen`: negen met betekenis, zeven genegeerd, en
  `plan.waarschuwingen` van de heen-en-terugtest is leeg — geen ruis, geen onbekende kop.
- **Een privéles uit de export levert geen lesgroep op.** Een boeking zonder `group_id` wordt
  `Type les` = `Privéles` met een lege `Groep`, en die lege `Groep` is het teken dat er geen
  lesgroep hoort te ontstaan (D-08). Bewezen op een echt geschreven en teruggelezen bestand.

## Deviations from Plan

Geen. Beide taken zijn uitgevoerd zoals ze er stonden, alle acceptatiecriteria zijn gehaald, en
er is geen enkele regel productiecode aangeraakt. De keuze tussen de twee wegen in taak 1 was
door het plan zelf aan de uitvoerder gelaten en staat hierboven verantwoord.

### Bewust niet gedaan

**IMP-06 en IMP-10 blijven Pending in REQUIREMENTS.md.** Allebei zijn ze geformuleerd als iets
wat de beheerder ziet: IMP-10 eindigt op "de droogloop meldt precies die twee dingen en niets
anders", IMP-06 gaat over wat er ná het wegschrijven overblijft. Het rekenwerk is nu volledig
bewezen op het echte bestand, maar er wordt nog niets weggeschreven (plan 05-08) en er is nog
geen droogloopscherm (plan 05-09). Dezelfde lijn als 05-04, 05-05 en 05-06.

**De hernoemingsbevinding hierboven is niet gerepareerd.** Zie de reden daar.

## Threat Flags

Geen nieuw aanvalsvlak: dit plan voegt alleen tests toe. Geen scherm, geen netwerk, geen tabel,
geen SQL, geen enkele Supabase-verbinding. De drie dreigingen die dit plan toegewezen kreeg:

| Threat ID | Waar |
|---|---|
| T-05-18 (een kolom die tussen export en import uit elkaar loopt) | De heen-en-terugtest schrijft met `bladLessen` en leest met `leesWerkmap` + `planImportLessen`; hernoemt iemand een kop aan één kant, dan valt `expect(rijen[0]).toEqual(KOP_EXPORT)` en de hele rondrit om |
| T-05-19 (een acceptatietest die minder controleert dan hij belooft) | De verwachte uitkomst staat als `KOEN_GROEPEN` bovenaan het blok, met de getallen die in de bytes geteld zijn; één test loopt de hele tabel af en noemt bij een verschil de groep bij naam |
| T-05-SC (npm-installs) | Niets geïnstalleerd; `git diff --stat package.json package-lock.json` is leeg |

## Known Stubs

Geen. Dit plan levert bewijs en geen functionaliteit; wat het niet doet (wegschrijven, een
scherm) doen 05-08 en 05-09.

## Deferred Issues

De hernoemingsbevinding (`groepWijzigingen` vergelijkt `name`, `weekday` en `start_hour` niet bij
een `Groep-ID`-match) staat hierboven uitgeschreven en is genoteerd in
`.planning/phases/05-excel-import-van-trainingen/deferred-items.md`.

`lib/goals.test.ts` → `newGoalId does not hand out the same id twice` bleef in deze run groen;
het staat sinds 05-06 als los genoteerd punt en is niet aangeraakt.

## Verification

```
npx tsc --noEmit                       → nul fouten
npx jest lib/import-trainingen         → 154 passed (was 133)
npm test                               → 52 suites, 1441 tests passed (was 1420)
TZ=UTC npx jest lib/import-trainingen  → 150 passed, 4 skipped (de tijdwisseltests van 05-06)
npx expo export --platform web         → gelukt (entry-bundle 3,81 MB)
git diff --stat package.json package-lock.json                        → leeg
git diff --stat lib/import-trainingen.ts lib/export-trainingen.ts lib/xlsx.ts → leeg
git diff --name-only HEAD~2 -- lib/    → alleen lib/import-trainingen.test.ts
```

Acceptatiecriteria per taak, alle gehaald:

```
taak 1
  grep -c 'IMP-10'                        → 4   (≥ 1)
  grep -c 'Kidstennis oranje'             → 3   (≥ 1)
  grep -c 'Volwassenen - (her)starters'   → 1   (≥ 1)
  grep -c '325'                           → 3   (≥ 1)
  git diff --stat lib/import-trainingen.ts → leeg

taak 2
  grep -c 'bladLessen'                    → 2   (≥ 1)
  grep -c 'Groep-ID'                      → 13  (≥ 1)
  grep -c 'twee keer inlezen'             → 2   (≥ 1)
  git diff --stat lib/import-trainingen.ts lib/export-trainingen.ts lib/xlsx.ts → leeg
```

## Self-Check: PASSED

- `lib/import-trainingen.test.ts` — FOUND
- `koen.xlsx` — FOUND
- 547fd9b `test(import-trainingen): het echte bestand van de club van bytes tot plan` — FOUND
- 98fc79d `test(import-trainingen): twee en drie keer inlezen, en de export weer inlezen` — FOUND
