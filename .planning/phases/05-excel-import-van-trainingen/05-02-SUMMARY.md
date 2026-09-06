---
phase: 05-excel-import-van-trainingen
plan: 02
subsystem: import
tags: [namen, bestand, xlsx]
requires: []
provides:
  - "lib/students.ts::zelfdeNaamOngeachtVolgorde — één naamregel die de volgorde negeert"
  - "lib/students.ts::zoekOpNaam — de ene passende persoon, of niets bij twijfel"
  - "lib/bestand.ts::kiesBinairBestand — een .xlsx als bytes"
affects:
  - "plan 05-05 (import-trainingen): trainer- én spelerzoekopdracht gaan langs zoekOpNaam"
  - "het importscherm van de trainingen: kiesBinairBestand levert de werkmap"
tech-stack:
  added: []
  patterns:
    - "naamvergelijking woord voor woord, gesorteerd, met hergebruik van normalizeName"
    - "FileReader-omhulsel gespiegeld op kiesTekstbestand, met dezelfde null-belofte"
key-files:
  created: []
  modified:
    - lib/students.ts
    - lib/students.test.ts
    - lib/bestand.ts
decisions:
  - "naamWoorden blijft binnen lib/students.ts: niets buiten dat bestand importeert hem (ook 05-05 niet), en CONVENTIONS.md zegt dat zo'n bouwsteentje niet geëxporteerd wordt"
  - "zoekOpNaam geeft null bij twee treffers in plaats van de eerste te gokken"
  - "kiesBinairBestand krijgt geen test: een dun omhulsel om een browser-API, net als kiesTekstbestand"
metrics:
  duration: ~15 min
  completed: 2026-09-06
  tasks: 2
  commits: 3
---

# Phase 05 Plan 02: naamherkenning en een bestandskiezer voor bytes Summary

Eén gedeelde naamregel die "Leemans Koen" en "Koen Leemans" als dezelfde persoon ziet zonder
`normalizeName` aan te raken, plus `kiesBinairBestand` naast `kiesTekstbestand`.

## Wat er gebouwd is

**Taak 1 — `lib/students.ts` (TDD)**

Drie functies onderaan het bestand, de bestaande drie ongewijzigd:

- `naamWoorden(name)` (niet geëxporteerd) — `normalizeName` erop, splitsen op witruimte, lege
  stukken eruit. Hergebruikt `normalizeName` letterlijk; `trim().toLowerCase()` staat nog
  steeds precies één keer in het bestand.
- `zelfdeNaamOngeachtVolgorde(a, b)` — beide door `naamWoorden`, allebei niet leeg, even veel
  woorden, gesorteerd woord voor woord gelijk.
- `zoekOpNaam(lijst, naam)` — generiek over `{ name: string }`; alle treffers verzamelen,
  precies één treffer geeft die treffer, nul of meer dan één geeft `null`.

Doc-commentaar legt de drie waaroms uit: de achternaam staat vooraan in de seizoensplanning
en dat is geen tikfout; `normalizeName` blijft ongemoeid omdat de ledenimport en de
keuzelijsten op de vergelijking mét volgorde leunen; `zoekOpNaam` gokt niet bij twee treffers.

**Één regel voor beide zoekopdrachten.** `zoekOpNaam` roept `zelfdeNaamOngeachtVolgorde` aan,
en 05-05 gebruikt `zoekOpNaam` voor zowel de trainer als de speler — er is geen tweede
vergelijking om uit de pas te lopen.

**Geen valse treffers tussen verschillende mensen.** Twee mensen die alleen de achternaam
delen ("Koen Leemans" / "Sofie Leemans") hebben verschillende woorden en matchen niet. Een
tweede voornaam ("Koen Jan Leemans" / "Koen Leemans") geeft een ander aantal woorden en matcht
evenmin — de eis "even veel woorden" sluit gedeeltelijke treffers uit. Beide gevallen staan als
test in `lib/students.test.ts`. Het ene geval dat woordvergelijking principieel niet kan
onderscheiden — twee bestaande mensen die dezelfde woorden in een andere volgorde heten — komt
er als `null` uit in plaats van als gok; dat is T-05-03 en T-05-11.

**Taak 2 — `lib/bestand.ts`**

`kiesBinairBestand()` naast `kiesTekstbestand()`: dezelfde `kanBestandKiezen`-poort
(hergebruikt, niet gekopieerd), hetzelfde `createElement('input')` + `onchange` +
`FileReader`-patroon, dezelfde `null`-belofte. Verschillen: `accept` op `.xlsx`,
`readAsArrayBuffer`, en `{ naam, bytes }` terug na een `instanceof ArrayBuffer`-controle.
Commentaar legt uit waarom er hier geen plakvak-terugval bestaat en waarom er geen test bij zit.

## Deviations from Plan

**1. [Rule 2 — conventie] `naamWoorden` wordt niet geëxporteerd**
- **Found during:** Taak 1
- **Issue:** Het `<interfaces>`-blok toont `export function naamWoorden`, maar de `<read_first>`
  van dezelfde taak wijst naar CONVENTIONS.md "Module Design": wat niets buiten het bestand
  importeert, wordt niet geëxporteerd. `05-05-PLAN.md` noemt in zijn eigen interfaces alleen
  `zelfdeNaamOngeachtVolgorde` en `zoekOpNaam`; niets in de fase importeert `naamWoorden`.
- **Fix:** `naamWoorden` staat als gewone functie in het bestand, met een commentaar dat zegt
  waarom hij daar blijft. Hij wordt getest via de twee functies die hem gebruiken.
- **Files modified:** lib/students.ts
- **Commit:** 6e19160

Verder is het plan uitgevoerd zoals geschreven.

## Verificatie

```
npx jest lib/students   → 22 passed, 22 total (9 bestaande + 13 nieuwe)
npx tsc --noEmit        → nul fouten
npm test                → 50 suites, 1249 tests, alles groen
npx expo export --platform web → Exported (bundel 3.81 MB)
git diff --stat package.json package-lock.json → leeg (geen nieuw pakket)
```

Acceptatiegreps taak 1: `normalizeName`-definitie `1`, `trim().toLowerCase()` `1`,
`zelfdeNaamOngeachtVolgorde` `1`, `Leemans Koen` in de test `4`, `de Clippele Antoine` `2`.
Acceptatiegreps taak 2: `kiesBinairBestand` `1`, `readAsArrayBuffer` `1`, `kanBestandKiezen` `1`,
`kiesTekstbestand` `3`, `instanceof ArrayBuffer` `1`.

Geen SQL uitgevoerd, geen Supabase-verbinding gelegd, geen pakket geïnstalleerd.

## Known Stubs

Geen.

## Commits

| Commit | Bericht |
|--------|---------|
| a7241e1 | test(namen): "Leemans Koen" en "Koen Leemans" horen dezelfde persoon te zijn |
| 6e19160 | feat(namen): een naam herkennen ook als de achternaam vooraan staat |
| ba43b99 | feat(import): een werkmap kiezen levert bytes op, geen tekst |

## TDD Gate Compliance

RED (`test(namen)`, a7241e1 — 13 falende tests, 9 bestaande groen) → GREEN (`feat(namen)`,
6e19160 — 22/22). Geen refactorstap nodig.

## Self-Check: PASSED

- `lib/students.ts`, `lib/students.test.ts`, `lib/bestand.ts` bestaan en zijn gewijzigd.
- Commits a7241e1, 6e19160, ba43b99 staan in `git log`.
