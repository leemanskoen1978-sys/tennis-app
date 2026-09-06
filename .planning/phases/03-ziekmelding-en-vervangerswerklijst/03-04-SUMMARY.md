---
phase: 03-ziekmelding-en-vervangerswerklijst
plan: 04
subsystem: vervangersvoorstel (pure regelmodule)
tags: [vervanger, ziekmelding, boekingstijd, vakanties, botsing, lib]
requires: [lib/boekingstijd.ts, lib/slots.ts, lib/vakanties.ts, lib/recurrence.ts, lib/ziekmelding.ts, lib/types.ts]
provides:
  - "lib/vervanger.ts: kanVervangen, vervangersVoor"
  - "types: VervangerReden, VervangerUitkomst, VervangerSlot, VervangerKandidaat"
  - "lib/ziekmelding.ts: ziekOp"
affects: [lib/ziekmelding.ts]
tech-stack:
  added: []
  patterns: ["bestaande antwoorden samenstellen (lib/boekingstijd)", "reden-enum in plaats van boolean", "kale map zonder filter of sortering (lib/lesgroepen)"]
key-files:
  created: [lib/vervanger.ts, lib/vervanger.test.ts]
  modified: [lib/ziekmelding.ts, lib/ziekmelding.test.ts]
decisions:
  - "D-08 uitgevoerd: vijf redenen, elk apart herkenbaar en apart getest"
  - "D-09 uitgevoerd: vervangersVoor filtert nooit — even veel uitkomsten als kandidaten"
  - "D-10 uitgevoerd: geen rangschikking, de volgorde van de invoer blijft staan"
  - "D-11 uitgevoerd: puur lib/, geen store en geen scherm"
  - "botstMet uit lib/recurrence in plaats van het niet-bestaande lib/overlap::botsen (03-AANPASSING)"
  - "ziekOp apart geëxporteerd, zodat de periodevergelijking op één plek blijft"
metrics:
  duration: ~35 min
  completed: 2026-09-06
  tasks: 2
  tests_before: 1188
  tests_after: 1218
---

# Phase 3 Plan 04: Wie kan dit lesuur écht — Summary

Voor één lesuur zegt de app nu per collega of hij kan, en zo niet om welke van de vijf redenen —
en wie niet kan verdwijnt niet uit de lijst maar staat erin met zijn reden erbij.

## Wat er gebouwd is

**`lib/vervanger.ts`** (163 regels), twee exports en vier types:

| Export | Wat het beantwoordt |
|---|---|
| `kanVervangen(kandidaat, slot, lessen, vakanties, open, clubEinde)` | Vijf vragen in vaste volgorde; de eerste die nee zegt wint. Terug komt `{ coach: {id, name}, reden }`. |
| `vervangersVoor(kandidaten, ...)` | Een kale `map` over `kanVervangen`. Geen `filter`, geen `sort`, geen `slice`. |

De vijf redenen, in de volgorde waarin ze gesteld worden, met de bestaande functie die elk
antwoord al gaf:

| Reden | Gesteld aan |
|---|---|
| `zelf_ziek` | `ziekOp` (lib/ziekmelding), op de lokale dag uit `dagSleutel` |
| `afwijkende_periode` | `periodeOp` + `slotsOp` (lib/boekingstijd) — er geldt een periode én het uur valt erbuiten |
| `buiten_uren` | `worksOnDay` (lib/slots) of `slotsOp` — géén periode, dus zijn gewone uren |
| `clubvakantie` | `vakantieOpMoment` (lib/vakanties) |
| `eigen_les` | `botstMet` (lib/recurrence) |

Het onderscheid tussen `afwijkende_periode` en `buiten_uren` zit hem in de vraag "geldt er die
dag een periode": zo ja, dan is de periode de reden; zo nee, dan zijn het zijn gewone uren.
Dezelfde uitkomst voor de les, maar de beheerder weet waar hij moet kijken als hij het wil
veranderen.

Het kopcommentaar spiegelt dat van `lib/boekingstijd.ts` en keert de slotalinea ervan om:
daar staan de clubvakanties bewust NIET in omdat ze iedereen sluiten en niet per trainer
gelden; hier staan ze er wél in, want een collega die in een clubvakantie zit kan niet
invallen. Daarnaast staat er waarom dit bestand nooit iemand stil wegfiltert (D-09) — een
beheerder die niet ziet waarom iemand ontbreekt, gaat twijfelen en belt zelf de club rond, en
dan heeft deze module niets opgelost.

Er wordt nergens een uur bij een `Date` opgeteld en nergens een ISO-tekst afgeknipt: het
lesuur komt uit `getHours()`/`getMinutes()` en wordt vergeleken met de `'15:00'`-strings uit
`slotsOp`; de dag komt uit `dagSleutel`.

**`lib/ziekmelding.ts` — nieuwe export `ziekOp(coachId, dag, open)`** (zie Deviations). De
private `dektDag` blijft privé; `zoektVervanger` loopt nu ook door `ziekOp`, zodat de vraag
"was deze trainer die dag ziek" op één plek beantwoord wordt.

**Wat de tests vastleggen** (30 tests in `lib/vervanger.test.ts`, geen `jest.mock`/`jest.fn`).
Alles draait om dezelfde les: dinsdag 2026-10-06 van 15:00 tot 16:00, lokaal opgebouwd.

- `describe('kan')` — 2 tests: de volle uitkomst inclusief naam, en de terugval op de clubtijd.
- `describe('zelf_ziek')` — 5: dekkende melding, laatste ziektedag telt mee, omgekeerd
  ingevuld, ingetrokken melding houdt niemand tegen, melding van een collega raakt hem niet.
- `describe('afwijkende_periode')` — 4: periode zonder uren, periode met uren waar de les
  buiten valt, periode met uren waar hij binnen valt (`'kan'`), periode die de dag niet dekt.
- `describe('buiten_uren')` — 4: eigen uren 09:00–12:00, `working_days: [1,3,5]`, lege
  `working_days` (elke dag), dinsdag wél in de lijst.
- `describe('clubvakantie')` — 2: dekkende vakantie, vakantie in een andere week.
- `describe('eigen_les')` — 4: overlappende les, aansluitende les (`'kan'`), afgezegde les
  (`'kan'`), les van een ánder (`'kan'`).
- `describe('de volgorde ligt vast')` — 4: ziek wint van eigen les, periode wint van
  clubvakantie, clubvakantie wint van eigen les, en dezelfde invoer geeft dezelfde reden.
- `describe('geen kandidaat valt stil weg')` — 5: even lang als de invoer, zelfde volgorde,
  elk met zijn eigen reden (`zelf_ziek`, `kan`, `eigen_les`, `buiten_uren`), gelijk aan wat
  `kanVervangen` los zou geven, en een lege lijst geeft `[]`.

Plus 3 tests voor `ziekOp` in `lib/ziekmelding.test.ts`.

## Deviations from Plan

### Afwijking van de letterlijke plantekst (voorgeschreven door 03-AANPASSING.md)

**1. `botstMet` uit `lib/recurrence.ts`, niet `botsen` uit `lib/overlap.ts`**
- Het plan noemt `lib/overlap.ts::botsen` op vier plekken, inclusief in `key_links` en in het
  acceptatiecriterium `grep -c "botsen(" lib/vervanger.ts` ≥ 1. Dat bestand bestaat niet:
  fase 2.1 heeft de private `collides` al vervangen door de geëxporteerde
  `botstMet(slot, existing, vraag)`, en `03-AANPASSING.md` schrijft voor dat elk plan van deze
  fase `botsen`/`lib/overlap` leest als `botstMet` uit `lib/recurrence.ts`.
- **Gekozen:** `botstMet` aangeroepen. Het criterium `grep -c "botsen("` geeft dus `0` en
  `grep -c "botstMet("` geeft `1`. De bedoeling erachter — de botsingsregel niet nabouwen —
  is wél gehaald: `grep -c "aStart\|bEnd" lib/vervanger.ts` geeft `0`, en er staat in de hele
  codebase nog steeds precies één `aStart < bEnd`.

### Rule 2 — ontbrekende, noodzakelijke aanvulling

**2. `ziekOp` geëxporteerd uit `lib/ziekmelding.ts`**
- **Gevonden bij:** taak 1, stap 1 van `kanVervangen`.
- **Waarom:** het plan schrijft voor om de ziekteperiode te toetsen "beide grenzen mee,
  omgekeerd getolereerd, dezelfde vorm als `vakantieOpDag`". Die vergelijking staat al drie
  keer in de codebase (`vakantieOpDag`, `periodeOpDag`, `dektDag`); een vierde inline kopie
  hier zou precies de fout zijn die dit plan bij de botsingsregel verbiedt — en een kopie die
  uiteenloopt, stelt een zieke trainer voor als vervanger van een andere zieke trainer.
- **Wat er gedaan is:** `ziekOp(coachId, dag, open)` toegevoegd aan `lib/ziekmelding.ts`, die
  de bestaande private `dektDag` hergebruikt. `zoektVervanger` roept hem nu ook aan (die had
  de regel zelf al inline staan), dus het aantal antwoorden op deze vraag ging van twee naar
  één. Drie tests toegevoegd in `lib/ziekmelding.test.ts`.
- **Bestanden:** `lib/ziekmelding.ts`, `lib/ziekmelding.test.ts` (allebei niet in
  `files_modified` van het plan).
- **Commit:** 4dd3ad7

**3. VERV-08 en VERV-09 blijven "Pending" in REQUIREMENTS.md**
- Allebei zijn ze geformuleerd als iets dat *de app toont* aan de beheerder ("bij het koppelen
  van een vervanger toont de app…", "…zijn opvraagbaar mét de reden"). Dit plan levert het
  rekenwerk; er is nog geen scherm dat de lijst laat zien (plan 03-07). Afvinken zou beweren
  dat de club het al kan gebruiken — dezelfde afweging als in plan 03-02 voor VERV-04/05/07/10.
- **Gekozen:** de vinkjes blijven staan tot het scherm er is. STATE.md en ROADMAP.md zijn wel
  bijgewerkt (fase 3: 4 van 8 plannen af).

Verder: geen. Er is geen enkele bestaande verwachting gewijzigd.

## Verificatie

```
npx tsc --noEmit                → schoon (geen uitvoer)
npm test                        → 49 suites, 1218 tests, alles groen (was 49 / 1188)
npx expo export --platform web  → geslaagd (1 bundle, 3.79 MB, exit 0)
npx jest lib/vervanger          → 30 tests groen
  -t "zelf_ziek"                → 5 geslaagd
  -t "afwijkende_periode"       → 4 geslaagd
  -t "buiten_uren"              → 4 geslaagd
  -t "clubvakantie"             → 4 geslaagd
  -t "eigen_les"                → 4 geslaagd
  -t "de volgorde ligt vast"    → 4 geslaagd
  -t "geen kandidaat valt stil weg" → 5 geslaagd
npx jest lib/ziekmelding        → 34 tests groen (was 31)
```

Greps uit de acceptatiecriteria:

```
elke VervangerReden-waarde in de test                    geen MIST-regel
aStart|bEnd in lib/vervanger.ts                          0
botstMet( in lib/vervanger.ts                            1   (plan schreef botsen( — zie afwijking 1)
working_hours in lib/vervanger.ts                        0
slice(0, 10) | slice(0,10) | toISOString                 0
jest.mock | jest.fn in de test                           0
imports uit '../' in lib/vervanger.ts                    0
from '../providers' | '../components' | '../app'         0
.filter( | .sort( | .slice( in vervangersVoor            0
export function in lib/vervanger.ts                      2
aStart < bEnd in lib/ providers/ components/ app/        1
```

Regels: `lib/vervanger.ts` 163 (min_lines 70), `lib/vervanger.test.ts` 244 (min_lines 100).

## Known Stubs

Geen. `lib/vervanger.ts` is compleet. Er is nog geen aanroeper: het scherm dat de kandidaten
samenstelt (`coachesOf`, de zieke trainer eruit) en de lijst toont, staat in plan 03-07. Dat is
met opzet — dit bestand kent `coachesOf` niet en weet niet dat een zieke zichzelf niet
vervangt; dat is een keuze van het scherm, niet van deze regel.

## TDD Gate Compliance

Per taak een falende `test(...)`-commit vóór de `feat(...)`-commit:

| Taak | RED (falend gezien) | GREEN |
|---|---|---|
| 1 | fe8c631 — module bestond nog niet, 1 suite gefaald, 0 tests gedraaid | 4dd3ad7 (25 groen) |
| 2 | 311bd28 — 5 gefaald, 25 geslaagd | bac5dd9 (30 groen) |

## Threat Flags

Geen nieuw aanvalsoppervlak. Er is geen invoer van buiten, geen I/O en geen schrijfweg.
T-03-12 (een van de vijf controles die stil wegvalt) is afgedekt met één `describe` per reden
plus de grep op alle `VervangerReden`-waarden; T-03-13 (een kandidaat die stil wegvalt) met de
lengtetest en de grep die `filter`/`sort`/`slice` verbiedt; T-03-14 (een derde kopie van de
botsingsregel) met de grep op `aStart|bEnd`; T-03-15 (UTC-verschuiving) met de verplichte
`dagSleutel` en het verbod op `toISOString`.

## Self-Check: PASSED

- `lib/vervanger.ts` — aanwezig, 163 regels
- `lib/vervanger.test.ts` — aanwezig, 244 regels
- `lib/ziekmelding.ts` — `export function ziekOp` aanwezig
- Commits fe8c631, 4dd3ad7, 311bd28, bac5dd9 — alle vier gevonden in `git log`
