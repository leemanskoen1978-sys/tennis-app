---
phase: 05-excel-import-van-trainingen
plan: 05
subsystem: van regels naar lesgroepen en mensen — de sleutel, de spelers, de trainer en de baan
tags: [import, trainingen, lesgroepen, groepssleutel, spelers, trainer, baan, geen-pakket]
requires:
  - "lib/import-trainingen.ts: LesRegel, ImportFoutLessen, leesLesRegels (plan 05-04)"
  - "lib/lesgroepen.ts: groepSleutel, actieveGroepen (bestaand, ongewijzigd)"
  - "lib/students.ts: zoekOpNaam, zelfdeNaamOngeachtVolgorde, normalizeName (plan 05-02)"
  - "lib/contact.ts: normalizeEmail (bestaand, ongewijzigd)"
  - "lib/vakanties.ts: dagSleutel (bestaand, ongewijzigd)"
provides:
  - "lib/import-trainingen.ts: GeplandeGroep, groepenUitRegels(regels, bestaande)"
  - "lib/import-trainingen.ts: GroepStatus, GroepRosterVerschil, groepRosterVerschil(bestaand, roster)"
  - "lib/import-trainingen.ts: zoekTrainer(users, naam), zoekBaan(courts, waarde)"
  - "lib/import-trainingen.ts: GeplandeSpeler, spelersUitRegels(regels, users), nieuwLidUitSpeler(speler)"
  - "lib/import-trainingen.ts: GroepKoppeling, koppelingVoorGroep(groep, users, courts)"
affects: []
tech-stack:
  added: []
  patterns:
    - "de groepssleutel wordt aangeroepen en niet nagebouwd — één antwoord op 'welke groep is dit'"
    - "een emmer per groep, met het id van de bestaande groep als emmersleutel zodra we die kennen"
    - "de meest voorkomende waarde wint, en de eerste afwijkende regel is de melding"
    - "een lege cel is geen tweede mening: lege waarden tellen niet mee in die telling"
    - "opzoeken en aanmaken zijn twee verschillende functies, en trainers en banen hebben er maar één"
    - "één melding per groep in plaats van één per regel — 1398 regels is anders 2796 zinnen"
key-files:
  created: []
  modified: [lib/import-trainingen.ts, lib/import-trainingen.test.ts]
decisions:
  - "`sleutel` op GeplandeGroep blijft de áfgeleide sleutel uit groepSleutel, ook als een Groep-ID de groep aanwees; het samenvoegen gebeurt op een aparte emmersleutel `id:<id>` zodat regels mét en zónder Groep-ID van dezelfde groep in één emmer vallen"
  - "Een lege `Type les` of `Coach` telt niet mee bij 'de meest voorkomende wint': anders krijgt elke groep waarin één regel dat vakje leeg liet een waarschuwing over een verschil dat er niet is"
  - "De baan krijgt géén waarschuwing bij verschil tussen regels: welke baan een les krijgt mag per week wisselen, terwijl niveau en trainer eigenschappen van de groep zelf zijn"
  - "Twee bestaande leden die op dezelfde naam passen leveren géén ingang in `spelers` op — hem als nieuw lid opnemen zou een derde naamgenoot maken, en dat is erger dan hem overslaan met een melding"
  - "`groepRosterVerschil` is een extra export buiten de opsomming van het plan: het gedrag nieuw/ongewijzigd/bijgewerkt hoort bij dit plan, maar vraagt gebruiker-ids die pas ná `spelersUitRegels` bestaan — dus een eigen functie in plaats van een veld op GeplandeGroep"
  - "IMP-03 en IMP-04 blijven Pending in REQUIREMENTS.md, om dezelfde reden als IMP-01/IMP-02 bij plan 05-04: er wordt nog niets weggeschreven en er is nog geen droogloop op het scherm"
metrics:
  duration: ~30 min
  completed: 2026-09-06
  tasks: 2
  tests_before: 1339
  tests_after: 1379
---

# Phase 5 Plan 05: Van regels naar lesgroepen en mensen — Summary

De 1398 regels van `koen.xlsx` worden tien lesgroepen met zeven namen, 42 spelers en twintig
meldingen: "Groep 8" blijft drie groepen van zes, vier en twee mensen met nul overlap, en de
trainer wordt opgezocht in plaats van aangemaakt.

## Wat er gebouwd is

**`lib/import-trainingen.ts` (496 → 850 regels)**

| Blok | Wat het doet |
|---|---|
| `GeplandeGroep` | Een lesgroep zoals hij uit het bestand volgt: sleutel, bestaande tegenhanger, naam, niveau, weekdag, begintijd, coachnaam, baannaam, seizoen, leerlingnamen en de regels waar hij uit komt |
| `groepenUitRegels` | Eén pas over de regels; per groep een emmer. De sleutel komt uit `groepSleutel`, de weekdag uit `new Date(jaar, maand - 1, dag).getDay()` |
| `meestVoorkomend` | De winnende waarde plus de eerste afwijkende regel. Lege waarden tellen niet mee; bij gelijkspel wint wie er het eerst stond (een `Map` bewaart die volgorde) |
| `GroepStatus` + `groepRosterVerschil` | Nieuw, ongewijzigd of bijgewerkt, met precies wie erbij komt en wie eraf gaat — op ids, want een roster is een lijst gebruikers |
| `zoekTrainer` | `role === 'coach'` filteren, dan `zoekOpNaam`. Dezelfde naamregel als de spelers, want "Leemans Koen" moet "Koen Leemans" vinden |
| `zoekBaan` | Op naam (getrimd, hoofdletterongevoelig) of op nummer. Bij twee even goede treffers niets |
| `GeplandeSpeler` + `spelersUitRegels` | Eén ingang per unieke leerling, in de volgorde van het bestand, met het eerste ingevulde adres |
| `nieuwLidUitSpeler` | `{ name, email, role: 'player' }` — dezelfde vorm als `lib/import-leden.ts` bouwt, zonder sleutel met `undefined` erin |
| `GroepKoppeling` + `koppelingVoorGroep` | De trainer en de baan van één groep, met hoogstens twee meldingen — per groep, niet per regel |

**`lib/import-trainingen.test.ts` (420 → 862 regels, 92 tests)** — 40 nieuwe tests, geen
`jest.mock`, geen `jest.fn`, geen `Date.UTC`.

## Waarom de sleutel de dag en het uur meetelt

Op het echte bestand geteld, met de sleutel uit D-02:

| Groep | Dag | Uur | Spelers |
|---|---|---|---|
| Groep 4 | woensdag | 14u | 2 |
| Groep 12 | woensdag | 15u | 4 |
| Groep 13 | woensdag | 16u | 6 |
| **Groep 8** | **woensdag** | **17u** | **6** |
| Groep 26 | woensdag | 18u | 4 |
| Groep 31 | vrijdag | 16u | 5 |
| **Groep 8** | **vrijdag** | **17u** | **4** |
| Groep 12 | vrijdag | 18u | 4 |
| **Groep 8** | **vrijdag** | **19u** | **2** |
| Groep 3 | vrijdag | 20u | 6 |

Tien groepen, zeven namen. De drie "Groep 8"-momenten hebben samen twaalf verschillende mensen
en nul overlap — matchen op de naam alleen zou daar één groep van twaalf van maken. IMP-10 en de
ROADMAP zeggen "zeven lesgroepen" en tellen daarmee de groepsnámen; beide getallen staan als
test in het bestand, met een commentaar dat uitlegt dat dit klopt.

## Wat er wél en niet aangemaakt wordt

- **Spelers worden aangemaakt** (voorgesteld), volgens de regels van de ledenimport.
- **Trainers en banen worden alleen opgezocht.** Er is geen aanmaakweg; de grep-controle in de
  acceptatiecriteria bewaakt dat. Een trainer aanmaken betekent een uurtarief en toegang tot de
  club, en dat is geen bijproduct van een import (D-07).
- **De groep gaat wél door, de lessen niet.** `LesGroep.coach_id` mag leeg zijn — dat veld is
  daar met opzet optioneel voor — maar `Booking.coach_id` en `Booking.court_id` zijn allebei
  verplicht. Een les zonder trainer of baan bestaat niet in dit gegevensmodel.
- Op `koen.xlsx` met een lege ledenlijst: 42 nieuwe spelers zonder één dubbel, en twintig
  meldingen — tien keer "ik ken geen trainer Leemans Koen" en tien keer "bij deze groep staat
  geen baan". Precies wat IMP-10 als enige melding verwacht. Per regel zouden dit er 2796 zijn.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Ontbrekende functionaliteit] `groepRosterVerschil` naast `GeplandeGroep`**

- **Found during:** taak 1
- **Issue:** `<behavior>` eist dat een groep als `nieuw`, `ongewijzigd` of `bijgewerkt` in het
  plan staat, maar de opsomming van velden op `GeplandeGroep` in `<action>` heeft daar geen veld
  voor — en terecht: die vraag is pas te beantwoorden met gebruiker-ids, en die komen uit
  `spelersUitRegels` (taak 2) en uit de ledenlijst.
- **Fix:** een aparte, pure export `groepRosterVerschil(bestaand, roster)` die op ids vergelijkt
  en `{ status, toegevoegd, verwijderd }` teruggeeft. De opgesomde velden van `GeplandeGroep`
  zijn ongewijzigd overgenomen; dit is een toevoeging, geen afwijking ervan.
- **Files modified:** `lib/import-trainingen.ts`, `lib/import-trainingen.test.ts`
- **Commit:** 9b6fee0

**2. [Rule 1 - Bug] Een commentaar brak zijn eigen acceptatiecriterium**

- **Found during:** taak 1
- **Issue:** het commentaar bij de weekdagberekening waarschuwde letterlijk tegen `Date.UTC`, en
  het acceptatiecriterium telt voorkomens van die tekst in het hele bestand — commentaar
  inbegrepen. `grep -c 'Date.UTC'` gaf `1` in plaats van `0`.
- **Fix:** het commentaar zegt nu "nooit een datum in wereldtijd opbouwen". Dezelfde waarschuwing,
  zonder de naam die de controle in de war stuurt.
- **Files modified:** `lib/import-trainingen.ts`
- **Commit:** 9b6fee0

**3. [Rule 4 - niet gedaan, bewust] IMP-03 en IMP-04 blijven Pending in REQUIREMENTS.md**

- **Found during:** de afronding
- **Issue:** de frontmatter noemt `requirements: [IMP-03, IMP-04]`. IMP-03 belooft dat "de import
  lesgroepen afleidt", IMP-04 dat een onbekende speler "tijdens de import wordt aangemaakt" en
  dat "de droogloop het meldt". Dit plan levert het rekenwerk daarvoor; er wordt nog niets
  weggeschreven en er is nog geen droogloop op het scherm.
- **Besluit:** niet afvinken, dezelfde lijn als plan 05-04 met IMP-01/IMP-02. Ze worden
  afgevinkt door het plan dat schrijft en het plan dat het scherm bouwt.
- **Files modified:** geen

## Threat Flags

Geen nieuw aanvalsvlak: er komt geen netwerk, geen bestandssysteem en geen schema bij. De vier
dreigingen die dit plan toegewezen kreeg:

| Threat ID | Waar |
|---|---|
| T-05-11 (een naam die op twee leden past) | `zoekOpNaam` geeft `null` bij twee treffers; `spelersUitRegels` meldt het en neemt de leerling niet op, dus er komt ook geen derde naamgenoot bij. Twee tests |
| T-05-12 (een import die een trainer aanmaakt) | Er is alleen `zoekTrainer`/`zoekBaan`. `grep -cE "addUser\|addCourt\|nieuweTrainer\|role: 'coach' \}"` buiten commentaar geeft `0` |
| T-05-13 (bulk aangemaakte spelersrijen zijn claimbaar) | Overgedragen, zoals bij de ledenimport: de maatregel is "Confirm email" aanzetten in Supabase. Het commentaar bij `nieuwLidUitSpeler` verwijst naar `.planning/codebase/CONCERNS.md`; de herinnering hoort in het scherm van plan 05-09 |
| T-05-SC (npm-installs) | Niets geïnstalleerd; `git diff --stat package.json package-lock.json` is leeg |

## Known Stubs

Geen. Wat dit plan niet doet, doet het met opzet niet: er wordt nog geen les ingepland (plan
05-06) en er wordt nog niets weggeschreven (plan 05-07 en verder). `groepRosterVerschil` en
`nieuwLidUitSpeler` liggen klaar voor die stap.

## Verification

```
npx tsc --noEmit                → nul fouten
npx jest lib/import-trainingen  → 92 passed (was 52)
npm test                        → 52 suites, 1379 tests passed (was 1339)
npx expo export --platform web  → gelukt (entry-bundle 3.81 MB)
git diff --stat package.json package-lock.json            → leeg
git diff --stat lib/lesgroepen.ts lib/students.ts
        lib/contact.ts lib/recurrence.ts                  → leeg (hergebruikt, niet gewijzigd)
```

Acceptatiecriteria per taak, alle gehaald:

```
taak 1
  grep -c 'groepSleutel' lib/import-trainingen.ts        → 5   (≥ 1)
  tweede handgemaakte sleutel buiten commentaar          → 0
  grep -c 'Groep 8' lib/import-trainingen.test.ts        → 7   (≥ 1)
  grep -c 'actieveGroepen|archived'                      → 2   (≥ 1)
  grep -c 'Date.UTC'                                     → 0
  git diff --stat lib/lesgroepen.ts                      → leeg

taak 2
  grep -c 'zoekOpNaam'                                   → 6   (≥ 2)
  grep -c "role: 'coach'"                                → 1   (≥ 1)
  grep -c "role: 'player'"                               → 1   (≥ 1)
  addUser|addCourt|nieuweTrainer|role: 'coach' }         → 0
  grep -c 'de Clippele Antoine' (test)                   → 5   (≥ 1)
  grep -c 'Leemans Koen' (test)                          → 18  (≥ 1)
  grep -c '42' (test)                                    → 9   (≥ 1)
  git diff --stat lib/students.ts lib/contact.ts         → leeg
  grep -c 'jest.mock|jest.fn' (test)                     → 0
```

## Self-Check: PASSED

- `lib/import-trainingen.ts` — FOUND
- `lib/import-trainingen.test.ts` — FOUND
- 56ae9cb `test(import-trainingen): groep 8 is drie groepen, niet één groep van twaalf` — FOUND
- 9b6fee0 `feat(import-trainingen): de lesgroepen volgen uit de regels, op naam, dag en uur` — FOUND
- 1b25870 `test(import-trainingen): een trainer wordt opgezocht, een speler wordt aangemaakt` — FOUND
- cbdfb1a `feat(import-trainingen): spelers worden aangemaakt, trainers en banen alleen opgezocht` — FOUND
