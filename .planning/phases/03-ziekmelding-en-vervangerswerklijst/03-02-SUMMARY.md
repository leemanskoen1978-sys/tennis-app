---
phase: 03-ziekmelding-en-vervangerswerklijst
plan: 02
subsystem: ziekmelding (pure regelmodule)
tags: [ziekmelding, vervanger, afgeleid-feit, zomertijd, lib]
requires: [lib/vakanties.ts, lib/types.ts, lib/i18n.ts]
provides:
  - "lib/ziekmelding.ts: ziekmeldingFout, openZiekmeldingen, zoektVervanger, lessenVoorZiekmelding"
  - "lib/types.ts: interface SickLeave"
  - "types: OpenZiekmelding, ZiekmeldingBoeking"
affects: []
tech-stack:
  added: []
  patterns: ["afgeleid feit met één antwoordende functie (lib/lesgever)", "periode als jjjj-mm-dd (lib/vakanties)", "filter+sort zonder mutatie (lib/lesgroepen)"]
key-files:
  created: [lib/ziekmelding.ts, lib/ziekmelding.test.ts]
  modified: [lib/types.ts, lib/i18n-en.ts]
decisions:
  - "D-16 uitgevoerd: 'zoekt vervanger' is afgeleid, geen kolom en geen status op de boeking"
  - "D-17 uitgevoerd: intrekken raakt geen enkele boeking, want er is niets overschreven"
  - "D-15 uitgevoerd: de werklijst neemt ook de lessen mee waar de zieke alleen vervanger was"
  - "ziekmeldingFout leest jjjj-mm-dd via parseDag, niet dd/mm/jjjj — zoals vakantieFout"
metrics:
  duration: ~40 min
  completed: 2026-09-06
  tasks: 3
  tests_before: 1154
  tests_after: 1185
---

# Phase 3 Plan 02: Ziekmelding als rekenregel — Summary

Een ziekmelding is nu een periode op een trainer, en uit die periode rolt de lijst geraakte
lessen plus het afgeleide antwoord "zoekt deze les nog een vervanger" — nergens opgeslagen,
één functie die het beantwoordt.

## Wat er gebouwd is

**`lib/types.ts` — `interface SickLeave`** (regel 449), pal naast `Boekingsperiode`, met een
doc-blok dat allebei de verwarringen bij naam noemt: het D-03-verschil met een
`Boekingsperiode` (vooruit gepland versus een gebeurtenis met lessen die er al stonden) en
waarom er `retracted_at` staat in plaats van de rij te verwijderen. `van`/`tot` als
`jjjj-mm-dd`. Aan `Booking` is niets veranderd en er is geen `needs_substitute`-vlag bij
gekomen.

**`lib/ziekmelding.ts`** (136 regels), vier exports plus twee smalle `Pick<>`-invoertypes:

| Export | Wat het beantwoordt |
|---|---|
| `ziekmeldingFout(coachId, van, tot)` | Waarom deze melding niet klopt, of `null`. Half getypt is "nog niet af", niet een crash. Omgekeerd ingevuld is geen fout. |
| `openZiekmeldingen(alle)` | De ENIGE plek die zegt of een melding nog meetelt: `retracted_at` leeg. |
| `zoektVervanger(booking, open)` | Het afgeleide feit (D-16). Niet afgezegd, geen `taught_by_id`, en een open melding die de lokale dag dekt. |
| `lessenVoorZiekmelding(bookings, ziekmelding, vakanties)` | De werklijst als lijst: generiek in `T`, op tijd gesorteerd, zonder mutatie. |

Het bestand importeert alleen uit `./types`, `./vakanties` en `./i18n`, schrijft nergens iets
weg en kent het begrip "de rest van de reeks" niet (D-07).

**Wat de tests vastleggen** (31 tests in `lib/ziekmelding.test.ts`, geen `jest.mock`/`jest.fn`):

- **Intrekken raakt geen boeking** (`describe('intrekken')`): twee lessen van dezelfde trainer,
  één met een vervanger. Na intrekken zoekt geen van beide nog iets, de vervanger van de tweede
  staat er nog, en een `toEqual` op de hele lijst bewijst dat geen enkel boekingsobject
  veranderd is.
- **Eén les uit een reeks staat los** (D-07): drie lessen met hetzelfde `series_id`, één met een
  vervanger → `false, true, true` naast elkaar.
- **D-15**: een les van een collega waar de zieke als `taught_by_id` op staat, komt wél in de
  lijst; met een ándere vervanger valt hij er weer uit.
- **Zomertijd**: een ziekmelding 2027-03-25 → 2027-04-01 vindt alleen de les van 2027-03-30 om
  20:00 (de wissel viel op 2027-03-28), en het uur leest daarna nog steeds 20. Idem over de
  herfstwissel (2027-10-31) met een les op 2027-11-02. Alle `start_time`-waarden worden
  opgebouwd uit lokale dag/uur/minuut-velden.
- **23:00 op de laatste ziektedag** telt mee — de bug die `.slice(0, 10)` op een ISO-tekst zou
  opleveren.

## Deviations from Plan

### Rule 2 — ontbrekende, noodzakelijke aanvulling

**1. De zomertijdtests slaan luid over op een machine zonder zomertijd**
- **Gevonden bij:** taak 3.
- **Waarom:** de fixture bewijst niets in een tijdzone zonder uurwissel, en zou daar stil
  groen worden — precies de valse zekerheid die deze test moet voorkomen.
- **Wat er gedaan is:** de winter- en zomeroffset worden vergeleken; zijn ze gelijk, dan gaat
  er een `console.warn` naar de uitvoer die de tijdzone noemt en zegt dat de tests niets
  bewijzen, en draaien ze als `it.skip` in plaats van te slagen. Op deze machine
  (`Europe/Brussels`) draaien ze gewoon en zijn ze groen.
- **Bestand:** `lib/ziekmelding.test.ts`.
- **Commit:** 88e85c2

**2. Engelse vertaling voor de nieuwe melding**
- **Gevonden bij:** taak 1.
- **Waarom:** de buurmeldingen van `vakantieFout` staan allebei in `lib/i18n-en.ts`; een
  nieuwe melding zonder tegenhanger laat één zin in het Engelse scherm Nederlands staan.
- **Wat er gedaan is:** `'Kies wie er ziek is.': 'Choose who is ill.'` toegevoegd.
- **Bestand:** `lib/i18n-en.ts` (staat niet in `files_modified` van het plan).
- **Commit:** 43772bc

### Bewuste afwijking van de letterlijke `<behavior>`-tekst

**3. `ziekmeldingFout` leest `jjjj-mm-dd`, niet `dd/mm/jjjj`**
- De gedragslijst van taak 1 noemt `ziekmeldingFout('c-1', '01/03/2027', '05/03/2027')` → `null`.
  Dat kan niet samen met de `<action>` van dezelfde taak ("melding als `parseDag(van)` `null`
  geeft") en met de hele codebase: `parseDag` accepteert alleen `jjjj-mm-dd`, en zo doen
  `Vakantie`, `Boekingsperiode` en `vakantieFout` het ook. Een tweede datumlezer bouwen was
  expliciet verboden.
- **Gekozen:** de `<action>` gevolgd. De bedoeling van de gedragslijst is wél nagespeeld: geen
  trainer → melding, half getypt (`'01/03'`, leeg, `'2027-02-30'`) → melding, volledige periode
  → `null`, omgekeerde periode → `null`. De meldingstekst blijft `t('Vul beide dagen in als
  dd/mm/jjjj.')`, want dat is wat de gebruiker op het scherm typt.

**4. VERV-04/05/07/10 blijven "Pending" in REQUIREMENTS.md**
- Het plan noemt ze in zijn frontmatter, maar alle vier zijn geformuleerd als iets dat *de
  beheerder kan doen*. Dit plan levert alleen het rekenwerk; er is nog geen tabel, geen
  opslagweg en geen scherm (plannen 03-03 en 03-05 tot 03-07). Ze afvinken zou beweren dat de
  club het al kan gebruiken.
- **Gekozen:** de vinkjes blijven staan tot het scherm er is. STATE.md en ROADMAP.md zijn wel
  bijgewerkt (fase 3: 2 van 8 plannen af).

Verder: geen. Er zijn geen bestaande verwachtingen gewijzigd.

## Verificatie

```
npx tsc --noEmit                → schoon (geen uitvoer)
npm test                        → 48 suites, 1185 tests, alles groen (was 47 / 1154)
npx jest lib/ziekmelding        → 31 tests groen
  -t "zoektVervanger"           → 9 geslaagd
  -t "intrekken"                → 1 geslaagd
  -t "één les uit een reeks"    → 1 geslaagd
  -t "lessenVoorZiekmelding"    → 8 geslaagd
  -t "zomertijd"                → 2 geslaagd
  -t "de zieke trainer stond alleen als vervanger" → 2 geslaagd
npx expo export --platform web  → geslaagd (1 bundle, exit 0)
```

Greps uit de acceptatiecriteria, allemaal zoals gevraagd:

```
jest.mock|jest.fn in de test                        0
needs_substitute|zoekt_vervanger in types.ts        0
'+interface Booking' in de diff van types.ts        0
imports buiten ./types ./vakanties ./i18n           0
slice(0, 10) | toISOString                          0 | 0
seriesFrom | groupBookingsFrom                      0
getTime() | 86400000 | setTime                      0
.map( | .push( | = ... in de code                   0
vakantieOpMoment                                    2
taught_by_id ===                                    1
retracted_at buiten types.ts/ziekmelding.*          geen treffers
```

## Known Stubs

Geen. `lib/ziekmelding.ts` is compleet en volledig getest; er is nog geen scherm en geen
opslag — die staan in de volgende plannen van deze fase (`sync.ts`, de stores, de provider,
`app/admin/ziekmelding/`).

## TDD Gate Compliance

Per taak een falende `test(...)`-commit vóór de `feat(...)`-commit, in de vorm die deze repo
al gebruikt (`test(export): ...` → `feat(export): ...`):

| Taak | RED (falend gezien) | GREEN |
|---|---|---|
| 1 | a180214 — module bestond nog niet, 1 suite gefaald | 43772bc |
| 2 | b0cad97 — 11 gefaald, 8 geslaagd | b4ba9e7 |
| 3 | 88e85c2 — 12 gefaald, 19 geslaagd | b97e4f9 |

## Threat Flags

Geen nieuw aanvalsoppervlak buiten het dreigingsmodel van het plan. T-03-03 (half getypte
datum) en T-03-06 (UTC-verschuiving) zijn met tests afgedekt; T-03-04 (een tweede antwoord
elders) blijft een fasebrede controle voor plan 07.

## Self-Check: PASSED

- `lib/ziekmelding.ts` — aanwezig (136 regels, min_lines 60)
- `lib/ziekmelding.test.ts` — aanwezig (254 regels, min_lines 90)
- `lib/types.ts` — `interface SickLeave` aanwezig op regel 449
- Commits a180214, 43772bc, b0cad97, b4ba9e7, 88e85c2, b97e4f9 — alle zes gevonden in `git log`
