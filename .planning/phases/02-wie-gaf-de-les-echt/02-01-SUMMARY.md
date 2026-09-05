---
phase: 02-wie-gaf-de-les-echt
plan: 01
subsystem: rekenregels
tags: [lib, loon, omzet, pure-functies, tdd]

requires:
  - phase: 02-wie-gaf-de-les-echt
    plan: 02
    provides: "bookings.taught_by_id als kolomnaam en semantiek (leeg = de vaste trainer gaf hem zelf)"
provides:
  - "lesgeverId in lib/lesgever.ts — het enige antwoord op 'wie gaf deze les'"
  - "Booking.taught_by_id in lib/types.ts"
  - "totalCoachPayout, payoutsByCoach en coachPayoutThisMonth rekenen op de lesgever"
  - "een regressietest die vastlegt dat de omzet niet meebeweegt (D-06)"
affects: [plan 03/04 (de schrijfweg en de schermen), app/coaches/[id].tsx en app/admin/reports.tsx (rekenen vanzelf mee)]

tech-stack:
  added: []
  patterns:
    - "één `lib/`-functie als enig antwoord op een loongevoelige vraag, met elke rekenplek daardoorheen — dezelfde discipline als `planMethodChange` voor betalingen"
    - "grouperingssleutel én tariefopzoeking wisselen samen, in één lokale const per lus-iteratie"

key-files:
  created:
    - lib/lesgever.ts
    - lib/lesgever.test.ts
  modified:
    - lib/types.ts
    - lib/payments.ts
    - lib/payments.test.ts
    - lib/reports.ts
    - lib/reports.test.ts

key-decisions:
  - "coachPayout houdt zijn signatuur (een tarief in, geen boeking + gebruikers): alleen zijn aanroepers wisselen van id"
  - "In payoutsByCoach wordt lesgeverId één keer per lus-iteratie berekend in een lokale const `lesgever`, en gebruikt voor byId.get, totals.get/set én het coachId-veld — een half doorgevoerde wissel rekent het bedrag aan de verkeerde trainer toe"
  - "bookingsFor, bookingsBilledTo, bookingsByCoach en pendingPaymentsFor blijven op coach_id: een weggegeven les blijft in de agenda van de vaste trainer staan"
  - "bookingPrice en totalRevenue importeren lesgeverId niet en zijn niet aangeraakt (D-06)"

patterns-established:
  - "Elke toekomstige loon-/urenplek leest lesgeverId(b), nooit b.coach_id — een tweede `taught_by_id ?? coach_id` ergens anders is per definitie een bug"

requirements-completed: [VERV-01, VERV-02]

duration: 25min
completed: 2026-09-06
---

# Phase 02 Plan 01: Wie gaf de les écht — de ene waarheid Summary

**`lesgeverId` in `lib/lesgever.ts` is vanaf nu het enige antwoord op "wie gaf deze les", en de drie loonfuncties (`totalCoachPayout`, `payoutsByCoach`, `coachPayoutThisMonth`) rekenen erop — terwijl agenda, rooster, factuur én de omzet ongewijzigd op `coach_id` blijven.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files created:** 2
- **Files modified:** 4

## Accomplishments

- `Booking.taught_by_id?: string` direct ná `coach_id`, met een doc-commentaar in exact het sjabloon van `series_id`/`group_id`: wat leeg betekent, dat `coach_id` er NOOIT door verandert, en de verwijzing naar `lesgeverId` als de enige plek die de vraag beantwoordt. Zelfde kolomnaam als plan 02 in `supabase-schema.sql`.
- `lib/lesgever.ts`: kopcommentaar dat het gat bij naam noemt (de vaste trainer uitbetaald voor een les die hij niet gaf, of de vervanger niets), `LesgeverBoeking` als smalle `Pick<Booking, 'coach_id' | 'taught_by_id'>` (conventie van `lib/series.ts` en `lib/groups.ts`), en `lesgeverId`. Twee exports, meer niet. Enige import: `./types`.
- `lib/lesgever.test.ts`: drie gevallen (leeg → vaste trainer, ingevuld → vervanger, en een `toEqual` op een kopie die bewijst dat de boeking onaangeroerd terugkomt). Geen `jest.mock`/`jest.fn`.
- Vier loonplekken gewisseld, elk met een Nederlands commentaar dat de bug benoemt:
  1. `lib/payments.ts::totalCoachPayout` — `rateById.get(b.coach_id)` → `rateById.get(lesgeverId(b))`.
  2. `lib/reports.ts::payoutsByCoach` — één lokale `const lesgever = lesgeverId(b)` per lus-iteratie, gebruikt voor `byId.get`, `totals.get`, `totals.set` én `coachId:` in het verse rij-literal.
  3. `lib/reports.ts::coachPayoutThisMonth` — `b.coach_id === coach.id` → `lesgeverId(b) === coach.id`.
  4. Geen enkele wijziging in `app/` — `git diff --stat app/` is leeg, het bewijs dat de "één plek"-tucht werkt. Dat staat als commentaar bij de gewijzigde regel in `coachPayoutThisMonth`.
- Nieuwe tests in de bestáánde bestanden (geen nieuw testbestand voor bestaand geteste functies): `describe('trainersrapport met een vervanging')` in `lib/reports.test.ts` (4 gevallen) en `describe('totalCoachPayout met een vervanging')` in `lib/payments.test.ts` (2 gevallen).
- `describe('een vervanging raakt de omzet niet')` in `lib/payments.test.ts` met drie verschillende tarieven — baan 40, vaste trainer 20, vervanger 30 — zodat geen enkele verwisselde sleutel toevallig hetzelfde getal oplevert.

## De scheidslijn die niet mocht schuiven

| Rekent op de lesgever (gewijzigd) | Blijft op `coach_id` (niet aangeraakt) |
| --- | --- |
| `totalCoachPayout` (payments) | `bookingsFor` (payments:200) |
| `payoutsByCoach` (reports) | `bookingsBilledTo` (payments:213) |
| `coachPayoutThisMonth` (reports) | `bookingsByCoach` (payments:235) |
| `coachPayout` via zijn aanroepers | `pendingPaymentsFor` (payments:275) |
| | `bookingPrice` / `totalRevenue` — lezen geen van beide velden |
| | `app/coaches/[id].tsx` (agendalijst) |

## Bewijs uit de acceptatiecriteria

```
grep -c "jest.mock\|jest.fn" lib/lesgever.test.ts                 → 0
grep -v "^//" lib/lesgever.ts | grep -c "from './types'"          → 1  (geen providers/components/app)
grep -c "b\.coach_id" lib/reports.ts                              → 0
grep -n "lesgeverId" lib/payments.ts | grep -c "bookingPrice\|totalRevenue" → 0
git diff --stat app/                                              → leeg
git diff lib/reports.test.ts lib/payments.test.ts | grep '^-' | grep -v '^---' | grep -c "expect" → 0
grep -rn "taught_by_id ?? |taught_by_id ||" lib app components providers | grep -v lib/lesgever.ts → niets
npx jest lib/reports -t "vervanging"                              → 4 passed, 42 skipped
npx jest lib/payments -t "omzet"                                  → 3 passed, 89 skipped
```

## Task Commits

1. **Taak 1: Het veld en de ene functie, met de test eerst** — `1982bd4` (feat)
2. **Taak 2: De vier loonplekken wisselen van sleutel** — `e11b62d` (feat)
3. **Taak 3: Bewijzen dat de omzet niet bewoog** — `f2329ef` (test)

## Verification

```
npx tsc --noEmit                          → schoon (0 fouten)
npm test                                  → 46 suites, 1036 tests, allemaal groen
                                            (was 1020+; +16 nieuw: 3 lesgever, 4 reports-vervanging,
                                             2 payments-vervanging, 3 omzet, rest bestaand)
npx expo export --platform web            → geslaagd, exit 0, bundel 3.77 MB
```

## Deviations from Plan

None — plan uitgevoerd zoals geschreven. Eén opmerking bij de TDD-volgorde van taak 3: die tests slaagden meteen bij het schrijven, zonder RED-fase. Dat is geen overgeslagen stap maar de aard van die taak: het is een regressietest die vastlegt dat `bookingPrice`/`totalRevenue` níét bewogen zijn. Was hij rood geweest, dan was er in taak 2 iets stuk gegaan. De RED-fase is wél echt doorlopen voor taak 1 (module bestond niet) en taak 2 (4 falende gevallen, `Expected: 30, Received: 20`).

## Issues Encountered

Geen.

## User Setup Required

None. Er is geen SQL uitgevoerd en geen verbinding met Supabase gemaakt — de migratie uit plan 02 staat nog steeds ongedraaid. Zolang de kolom niet in de databank staat, is `taught_by_id` overal leeg en rekent alles precies zoals vóór dit plan; dat is met opzet de veilige tussentoestand.

## Next Phase Readiness

- De rekenkant is klaar. Wat nog ontbreekt is de schrijfweg (`setTaughtBy` in de provider, `updateBooking` die `taught_by_id` uitsluit) en het tonen ervan in `components/BookingDetailSheet.tsx` en `components/LessonCards.tsx` — plan 03/04.
- Zodra de migratie gedraaid is, worden deze functies vanzelf actief; er hoeft geen enkele rekenplek meer bij.

---
*Phase: 02-wie-gaf-de-les-echt*
*Completed: 2026-09-06*

## Self-Check: PASSED
- FOUND: lib/lesgever.ts, lib/lesgever.test.ts
- FOUND: 1982bd4, e11b62d, f2329ef
- Geen stubs: geen TODO/FIXME/placeholder in de gewijzigde of nieuwe bestanden.
