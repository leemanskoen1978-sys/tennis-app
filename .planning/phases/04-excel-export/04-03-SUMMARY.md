---
phase: 04-excel-export
plan: 03
subsystem: de-bladen-uren-en-groepen
tags: [xlsx, loon, uren, lesgroepen, groep-id, lib]

requires:
  - "04-02: ExportKolom, naarRijen, koppenVan, Opzoektabellen, WEEKDAGEN"
  - "lib/reports.ts: payoutsByCoach — de enige bron voor wie hoeveel kreeg"
provides:
  - "bladUrenPerTrainer(bookings, users) — blad Uren per trainer, met lessen, uren, loon en de waarschuwing bij een ontbrekend tarief"
  - "bladGroepen(groepen, bookings, tabellen) — blad Groepen, met Groep-ID"
affects:
  - "04-04: blad Aanwezigheid gebruikt dezelfde kolomtabel en dezelfde opzoektabellen"
  - "04-05: het exportscherm zet deze twee bladen naast bladLessen in één werkmap"
  - "fase 5: de importer leest het Groep-ID van blad Groepen terug"

tech-stack:
  added: []
  patterns:
    - "een blad dat een bestaand rapport toont, rekent niets zelf uit: één .map() over payoutsByCoach"
    - "de test vergelijkt de loonkolom met payoutsByCoach zelf, niet met een met de hand herhaald bedrag"
    - "tellen in één gang over de boekingen via een Map, nooit een herscan per groep"

key-files:
  created: []
  modified:
    - lib/export-trainingen.ts
    - lib/export-trainingen.test.ts

key-decisions:
  - "urenPerLesgever telt eerst minuten en deelt pas op het einde door 60, afgerond op twee decimalen: per les afronden laat een seizoen van lessen-van-vijftig-minuten driften, en 0,8333333333333334 leest niemand"
  - "Geen tweede sortering op blad Uren per trainer: payoutsByCoach sorteert al, en een andere volgorde dan Beheer → Rapport laat twee overzichten van dezelfde periode iets anders lijken te zeggen"
  - "Let op gaat wél door t() — het is schermtekst voor de lezer, geen kolomnaam die de import terugzoekt"
  - "Blad Groepen telt ook de geannuleerde lessen van een groep mee: dit blad beschrijft de planning, niet het loon"
  - "Type les en niet Niveau als kop op blad Groepen: hetzelfde begrip als op blad Lessen (LesGroep.level), en twee namen voor één ding maakt van een bestand een raadsel"
  - "Groep-ID blijft een tekstcel; als getal zou een lang cijferig id in wetenschappelijke notatie het bestand uit gaan en bij de herimport nergens meer op passen"

requirements-completed: [EXP-03, EXP-05, EXP-06]

duration: ~20min
completed: 2026-09-06
---

# Phase 04 Plan 03: "Uren per trainer" en "Groepen" Summary

**Twee bladen die vrijwel niets zelf uitrekenen: het loon komt regel voor regel uit
`payoutsByCoach`, de duur uit `bookingMinutes`, en op blad "Groepen" staat het `Groep-ID`
waaraan een herimport de groep terugvindt in plaats van er een tweede naast te zetten.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 automatisch (beide TDD)
- **Files created:** 0
- **Files modified:** 2
- **Tests:** 1112 → 1132 (+20 in `lib/export-trainingen.test.ts`, 32 → 52)

## Wat er gebouwd is

### Taak 1 — blad "Uren per trainer"

- `urenPerLesgever(bookings)` — de enige nieuwe berekening op het blad, en het zijn uren en
  geen geld. Ze loopt over `countedBookings(bookings)`, groepeert op `lesgeverId(b)` en telt
  `bookingMinutes(b)` op. Het commentaar zegt waarom dat mag: dezelfde sleutel én dezelfde
  lessenselectie als `payoutsByCoach`, dus "Uren" en "Lessen" tellen per definitie dezelfde
  lessen en kunnen niet uit elkaar lopen. De minuten worden pas op het einde door 60 gedeeld
  en op twee decimalen afgerond.
- `interface UrenRij` — `naam`, `lessen`, `uren`, `loon`, `letOp`.
- `urenRijen(bookings, users)` — één `.map()` over `payoutsByCoach(bookings, users)`, met de
  uren erbij uit de Map. Met opzet géén tweede sortering; het commentaar legt uit dat een
  andere volgorde dan Beheer → Rapport twee overzichten van dezelfde periode uiteen laat lopen.
  `letOp` is bij `missingRate` `t('Geen uurtarief ingevuld')`, anders leeg.
- `UREN_KOLOMMEN` — precies vijf: `Trainer` (tekst), `Lessen` (getal), `Uren` (getal),
  `Loon (EUR)` (getal + `geld`), `Let op` (tekst). Met het commentaar erbij waarom er GEEN
  omzetkolom staat (D-05).
- `export function bladUrenPerTrainer(bookings, users): XlsxBlad`, `naam: 'Uren per trainer'`
  als vaste Nederlandse letterlijke waarde.

Er wordt op dit blad geen enkel bedrag uitgerekend: `grep -c 'hourly_rate'` staat op `0`.

Gedrag dat in de tests vastligt: de kolommen `Trainer`, `Lessen` en `Loon (EUR)` worden rij
voor rij vergeleken met `payoutsByCoach` op dezelfde fixtures — geen tweede verwachting met de
hand uitgerekend; een les met vervangster staat met haar uren én haar bedrag (22, haar tarief,
niet Koens 24) bij de vervangster en de vaste trainer krijgt er niets van; een geannuleerde
les van twee uur telt in geen enkele kolom mee; Sam, die geen tarief heeft, staat er met loon 0
én de zin "Geen uurtarief ingevuld"; `Loon (EUR)` is een geldcel en `Lessen`/`Uren` zijn
getalcellen; geen enkele kop bevat "omzet", "prijs" of "betaal".

### Taak 2 — blad "Groepen"

- `interface GroepRij` — `id`, `naam`, `niveau`, `dag`, `uur`, `trainer`, `spelers`, `lessen`.
- `groepRijen(groepen, bookings, tabellen)` — bepaalt eerst welke groepen op het blad horen
  (`actieveGroepen` ∪ de groepen die in `bookings` nog een les hebben) en telt de lessen in
  **één** gang over de boekingen via een Map `group_id → aantal`. De afweging staat als
  commentaar: `lessenVanGroep` per groep in een lus leest de hele boekingenlijst opnieuw voor
  elke groep, en dat is bij tientallen groepen en duizenden lessen een herscan per groep.
  De weekdag komt uit dezelfde `WEEKDAGEN`-tabel als blad "Lessen"; er is geen tweede gemaakt.
- `GROEPEN_KOLOMMEN` — precies acht: `Groep-ID`, `Groep`, `Type les`, `Dag`, `Uur`, `Trainer`,
  `Spelers` (getal), `Lessen in periode` (getal).
- `export function bladGroepen(groepen, bookings, tabellen): XlsxBlad`, `naam: 'Groepen'`.

Gedrag dat in de tests vastligt: `Groep-ID` is `LesGroep.id`; zondag = 0 levert "zondag" en
09:30 wordt `09:30`; een groep zonder `coach_id` houdt een lege `Trainer` (aanvaarde toestand,
dus geen "Onbekend"); een actieve groep zonder lessen staat er met 0 op; de gearchiveerde
groep met een les in de periode staat er wél op en die zonder les niet; de rijen staan op naam
gesorteerd; `Groep-ID` blijft een tekstcel.

## Deviations from Plan

**1. [Rule 3 — Blokkade] `lessenVanGroep` wordt genoemd, niet aangeroepen**

- **Gevonden bij:** taak 2, bij het schrijven van `groepRijen`.
- **Kwestie:** de frontmatter van het plan noemt een `key_link` naar `lessenVanGroep(`, maar
  de `<action>` van diezelfde taak schrijft uitdrukkelijk voor de lessen in één gang via een
  Map te tellen "en niet met `lessenVanGroep` per groep in een lus". Dit plan heeft nergens de
  lessen zelf nodig — alleen het aantal — dus een echte aanroep zou de instructie schenden.
- **Oplossing:** de specifieke instructie gevolgd, en `lessenVanGroep` genoemd in het
  commentaar dat de afweging uitlegt, met de reden erbij wanneer ze wél de juiste functie is
  (namelijk waar de lessen zelf nodig zijn — blad "Aanwezigheid" in 04-04). Er is dus geen
  import van `lib/lesgroepen` voor deze functie; `actieveGroepen` wordt wél echt aangeroepen.
- **Bestand:** `lib/export-trainingen.ts`
- **Commit:** `9b8ecfb`

**2. [Rule 3 — Blokkade] Het woord "Omzet" met hoofdletter uit een commentaar gehaald**

- **Gevonden bij:** taak 1, bij het nalopen van de acceptatiecriteria.
- **Kwestie:** het commentaar bij `UREN_KOLOMMEN` legde uit waarom er géén omzetkolom staat en
  begon een zin met "Omzet loopt op ...". Daardoor stond `grep -c 'Omzet'` op `1` in plaats van
  op `0` en was het vangnet van T-04-07 niet meer bruikbaar. De code deed het goede, de tekst
  niet — precies dezelfde soort afwijking als in 04-02.
- **Oplossing:** de zin herschreven ("De omzet loopt op het uurtarief van de baan ..."). De
  uitleg blijft volledig, de grep-controle blijft bruikbaar.
- **Bestand:** `lib/export-trainingen.ts`
- **Commit:** `8242072`

Verder niets: geen tabel, geen kolom, geen pakket, geen SQL, geen verbinding met Supabase.

## Verification

```
npx jest lib/export-trainingen lib/reports  → 2 suites, 87 tests groen (0,58 s)
npx tsc --noEmit                            → schoon (geen uitvoer, exit 0)
npm test                                    → 47 suites, 1132 tests groen (1,39 s)
npx expo export --platform web              → Exported: .webbuild-check (exit 0), daarna verwijderd
git diff --stat package.json package-lock.json → leeg
```

Acceptatiecriteria, gemeten:

```
grep -c 'payoutsByCoach' lib/export-trainingen.ts                     5   (>=1 gevraagd)
grep -c 'bookingMinutes' lib/export-trainingen.ts                     3   (>=1 gevraagd)
grep -c 'hourly_rate' lib/export-trainingen.ts                        0
grep -c 'bookingPrice|totalRevenue|countsAsRevenue|Omzet' ...ts       0
grep -c 'taught_by_id' lib/export-trainingen.ts                       0
grep -v '^\s*//' ...test.ts | grep -c 'payoutsByCoach'                5   (>=1 gevraagd)
grep -c "'Groep-ID'" lib/export-trainingen.ts                         2   (>=2 gevraagd)
grep -c 'actieveGroepen' lib/export-trainingen.ts                     2   (>=1 gevraagd)
grep -v '^\s*//' ...test.ts | grep -c 'archived: true'                1   (>=1 gevraagd)
grep -cE '\.find\(\(' lib/export-trainingen.ts                        0
grep -c 'jest.mock|jest.fn' lib/export-trainingen.test.ts             0
grep -cE "from '\.\./(providers|components|app)" ...ts                0
```

Geen SQL gedraaid, geen verbinding met Supabase, geen pakket geïnstalleerd.

## Threat Flags

Geen nieuwe aanvalsoppervlakte: puur rekenwerk in `lib/`, geen scherm, geen netwerk, geen tabel.

- **T-04-06** (loonbedragen) afgedekt: `grep -c hourly_rate` staat op `0` en de test vergelijkt
  de loonkolom met `payoutsByCoach` zelf. Wie hier een tweede berekening binnenbrengt, laat die
  test omvallen.
- **T-04-07** (omzet naast loon) afgedekt: `grep -c 'bookingPrice\|totalRevenue\|countsAsRevenue'`
  staat op `0`, en een test loopt alle koppen na op "omzet", "prijs" en "betaal".
- **T-04-08** (vervangen les) afgedekt: de groepering loopt via `payoutsByCoach` en dus via
  `lesgeverId`; een fixture met vervangster bewijst dat de vaste trainer niets krijgt.
- **T-04-SC** (npm-installs) afgedekt: `git diff package.json package-lock.json` is leeg.

## Known Stubs

Geen. Beide bladen zijn af en volledig gedekt. Blad "Aanwezigheid" (04-04) en het exportscherm
(04-05) bestaan nog niet — dat is de planning, geen stub.

## Commits

- `5c4f352` test(export): blad Uren per trainer moet hetzelfde loon tonen als het rapport
- `8242072` feat(export): blad Uren per trainer, met het loon uit het rapport zelf
- `95d667a` test(export): blad Groepen moet het groepskenmerk en de juiste groepen tonen
- `9b8ecfb` feat(export): blad Groepen, met het kenmerk waaraan een herimport ze herkent

## Self-Check: PASSED

- `lib/export-trainingen.ts` en `lib/export-trainingen.test.ts` — beide aanwezig en gewijzigd.
- Alle vier de commits teruggevonden in `git log`.
