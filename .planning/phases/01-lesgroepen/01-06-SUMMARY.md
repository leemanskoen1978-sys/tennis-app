---
phase: 01-lesgroepen
plan: 06
subsystem: schermen
tags: [lesgroepen, lesdetail, instellingen, toegang, i18n]

# Dependency graph
requires:
  - phase: 01-lesgroepen
    provides: "Booking.group_id en Settings.lesson_duration_minutes in lib/types (plan 01)"
  - phase: 01-lesgroepen
    provides: "actieveGroepen in lib/lesgroepen (plan 01)"
  - phase: 01-lesgroepen
    provides: "lesGroepen op de context en lesson_duration_minutes: 60 in de terugval (plan 03)"
  - phase: 01-lesgroepen
    provides: "het groepsdetail dat de lessen van een groep toont (plan 05)"
provides:
  - "Het groepsblok op het lesdetailblad: welke lesgroep, aan hangen, weer los — alleen voor de beheerder"
  - "De lesduur als clubinstelling in Beheer → Instellingen, met 60 als terugval"
affects: [01-07 (de RLS-kant met de hand nalopen; TOEG-01 gaat daar pas om)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Een beheerdersstuk in een gedeeld blad staat achter isAdmin(currentUser) en niet achter canManage"
    - "Koppelen via het bestaande updateBooking: geen tweede weg die zelf een Partial<Booking> samenstelt"

key-files:
  created: []
  modified:
    - components/BookingDetailSheet.tsx
    - app/admin/settings.tsx
    - lib/i18n-en.ts

key-decisions:
  - "Het groepsblok staat achter isAdmin(currentUser), niet achter canManage: canManage laat de trainer van de les toe, en die beheert zijn eigen lessen maar niet de indeling van de club (D-09)"
  - "Koppelen zet uitsluitend group_id — geen series_id, geen participant_ids, geen rooster dat overgenomen wordt (D-12, D-07/D-08)"
  - "Geen nieuwe provideractie: group_id valt binnen het patchtype van updateBooking, en elke extra Partial<Booking>-weg is een weg langs planMethodChange heen"
  - "Alleen actieve groepen in de keuzelijst: aan een gearchiveerde groep hangen zou een groep vullen die de club heeft weggezet"
  - "De lesduur is een chiprij (45/60/75/90) in dezelfde vorm als booking_end_time, met de zin erbij dat de wijziging niet terugwerkt"

requirements-completed: [GROEP-03, GROEP-04]
requirements-in-progress: [GROEP-05, TOEG-01]

# Metrics
duration: 18min
completed: 2026-09-06
---

# Phase 1 Plan 06: Een les aan een groep hangen Summary

**De beheerder opent een les, hangt hem aan een lesgroep en haalt hem er weer af — waarbij er
niets anders aan die les verandert dan de verwijzing — en de club kiest zelf hoe lang een les
duurt, met de belofte erbij dat dat de agenda van vandaag niet verzet.**

## Performance

- **Duration:** ~18 min
- **Tasks:** 2 van 2
- **Files:** 0 nieuw, 3 gewijzigd
- **Tests:** 1024 — 45 suites, alles groen (ongewijzigd; dit plan voegt schermwerk toe en geen
  nieuwe pure regels)

## Accomplishments

### Taak 1 — `components/BookingDetailSheet.tsx`: het groepsblok

Een blok "Lesgroep" tussen de medespelers en de aanwezigheid, met drie toestanden:

- **De les hangt aan een groep** → naam en niveau (`Gevorderden 3 · Kidstennis oranje`), met de
  knop *Losmaken van de lesgroep* → `updateBooking(booking.id, { group_id: undefined })`.
  Verwijst de les naar een groep die er niet (meer) is, dan zegt het blad dat in één zin in
  plaats van leeg te blijven.
- **De les hangt nergens aan** → één zin die zegt wat koppelen wél en niet doet, en de knop
  *Aan een lesgroep hangen*.
- **De keuzelijst open** → de actieve groepen als `Chip`-rij, in dezelfde uitklapvorm als
  `editingPlayers`: aantikken doet `updateBooking(booking.id, { group_id: groep.id })` en klapt
  weer dicht; ernaast een `Klaar`-knop. Zijn er nog geen groepen, dan staat er de weg ernaartoe
  (Beheer → Lesgroepen) in plaats van een lege rij.

**De grens.** Het blok staat achter `magGroepen = isAdmin(currentUser)`, uitgerekend náást het
bestaande `canManage` en niet erin. `canManage` betekent "mag deze kijker deze les beheren", en
daar valt de trainer van de les ook onder; de tennisschool-module is van de beheerder (D-09).
Het is de controle om de knop héén en niet alleen om zijn zichtbaarheid: zonder
`isAdmin(currentUser)` bestaat er geen `onPress` die `group_id` zet. De databank weigert het
hoe dan ook — `group_id` valt buiten de drie velden die `bewaak_betaalvelden` een speler
toestaat.

**Drie stukken commentaar**, precies waar een latere lezer de verkeerde conclusie kan trekken:
koppelen verandert alleen de verwijzing en neemt het rooster van de groep niet over
(`participant_ids` blijft onaangeraakt, D-07/D-08); er wordt géén `series_id` gezet, want een
reeks is een aanmaakbatch en een groep een blijvende identiteit (D-12); en dit gaat bewust via
het bestaande `updateBooking`, omdat elke extra weg die zelf een `Partial<Booking>` samenstelt
een weg langs `planMethodChange` heen is — het gat uit OPENSTAAND.md, "Eén bewaakte weg".

Verder is er niets aangeraakt: geen reeksgedrag, geen betaalknoppen, geen aanwezigheidsknoppen,
geen `canManage`, en `providers/SimpleDataProvider.tsx` heeft nul regels diff. Wat er wél bij
kwam is één regel in `close()`: een openstaande keuzelijst hoort niet boven de volgende les te
blijven hangen, net zoals `editingPlayers` daar al werd teruggezet.

### Taak 2 — `app/admin/settings.tsx`: de lesduur

Een kaart "Lesduur" boven het thema, in dezelfde vorm als "Eindtijd reserveringen": een
`Chip`-rij over `LESSON_DURATIONS` (45, 60, 75, 90) die `update({ lesson_duration_minutes: n })`
aanroept, met `(settings.lesson_duration_minutes ?? 60) === minuten` als geselecteerd. Zonder
keuze blijft het dus 60 — precies zoals de app zich gedroeg voordat het veld bestond.

De zin op het scherm zegt wat de wijziging doet en vooral wat hij niet doet: *"Hoe lang een les
duurt. Dit geldt voor lessen die je hierna inplant; lessen die al in de agenda staan houden hun
eigen uur."* Diezelfde reden staat als commentaar bij `LESSON_DURATIONS`, met D-05 erbij: één
tik hier mag geen afspraken verzetten die spelers allang gekregen hebben.

`lib/i18n-en.ts` kreeg de Engelse tegenhanger van elke nieuwe zin uit taak 1 en taak 2, in twee
nieuwe blokjes onder het lesgroepenblok van plan 04/05.

## Deviations from Plan

### Afwijkingen van de acceptatiecriteria

**1. `grep -c "actieveGroepen"` geeft 2, niet 1.** De twee zijn de import uit
`../lib/lesgroepen` en de ene aanroep. Ik heb het resultaat eerst tweemaal aangeroepen (voor de
lege-lijstcontrole en voor de `map`) en dat na het lezen van dit criterium teruggebracht tot één
`const teKiezenGroepen = actieveGroepen(lesGroepen);`. Eén aanroepplek is de bedoeling van het
criterium; nul vermeldingen naast de import zou betekenen dat er geen import is.

**2. `grep -c "series_id"` geeft 4, niet de 3 van vóór dit plan.** De vierde staat in het nieuwe
commentaar, en dat is precies wat het criterium een regel verderop eist ("het commentaar noemt
`series_id`"). De bedoeling van het criterium — het reeksgedrag is niet aangeraakt — klopt wel:
`git diff` laat zien dat geen enkele regel mét `series_id` erin gewijzigd is. `inSeries`, `tail`
en `sameSeries` staan er onveranderd.

**3. De Engelse zinnen van taak 1 zitten in de commit van taak 2, zoals het plan voorschrijft.**
Anders dan bij plan 05: daar week ik ervan af, hier houdt het plan `lib/i18n-en.ts` uitdrukkelijk
bij taak 2 en staat het bestand ook alleen in de `files` van taak 2. Gevolg is dat commit
`a0660a3` één commit lang een half vertaald blok in de geschiedenis zet; dat is de prijs van de
bestandsindeling die het plan zelf koos.

### Afwijkingen van de requirements-status

**GROEP-03 en GROEP-04 gaan op Complete.** Het lessenblok van het groepsdetail kan nu iets
anders dan nul tonen, en een les die aan een groep hangt verwijst ernaar zonder ook maar iets
anders te worden. "Uit een lesgroep ontstaan" betekent in v1 "met de hand aan een lesgroep
gehangen"; het genereren van een heel seizoen is fase 5 (D-14).

**GROEP-05 blijft In Progress**, om de reden die plan 05 vond: "ander uur, andere trainer" werkt
niet door in de al ingeplande lessen. Dat is nu als **fase 2.1** in ROADMAP.md gezet. De rij in
de traceerbaarheidstabel is daarom "Phase 1 + 2.1" geworden — een rij die alleen "Phase 1" zegt
terwijl de rest van het werk in 2.1 staat, wijst de lezer de verkeerde kant op. Aan fase 2.1
zelf is niets veranderd.

**TOEG-01 blijft In Progress tot plan 07.** Het schermwerk is met dit plan af: de grens ligt op
de tegel, op beide lesgroepenschermen en nu ook om het groepsblok van het lesdetailblad. Wat
rest is de handmatige RLS-controle — en de app is niet de bewaker.

## Threat Flags

Geen nieuw netwerkpad, geen schemawijziging, geen nieuw auth-pad. Van het dreigingsregister van
dit plan:

- **T-01-19** (een speler of gewone trainer gebruikt de groepskoppeling) — afgedekt: het blok
  staat achter `isAdmin(currentUser)`, en de trigger `bewaak_betaalvelden` weigert `group_id`
  van een speler hoe dan ook.
- **T-01-20** (een nieuwe schrijfweg omzeilt `planMethodChange`) — afgedekt: `git diff
  providers/SimpleDataProvider.tsx` is leeg, het koppelen gaat via het bestaande
  `updateBooking`.
- **T-01-21** (koppelen neemt stilzwijgend het rooster over) — afgedekt: er wordt uitsluitend
  `group_id` gezet; `participant_ids` komt in dit bestand alleen nog in het nieuwe commentaar
  voor en zit sowieso niet in het patchtype van `updateBooking`.
- **T-01-22** (de lesduur werkt terug op bestaande lessen) — aanvaard zoals gepland: deze fase
  plant geen lessen in, de instelling wordt alleen bewaard, en het scherm zegt met zoveel
  woorden dat de wijziging alleen voor nieuwe lessen geldt.
- **T-01-SC** — dit plan installeert geen enkel pakket.

## Known Stubs

Geen. Beide toevoegingen schrijven echt weg. Wat nog niets doet is
`lesson_duration_minutes` zelf: er is in deze fase geen code die lessen inplant, dus de
instelling wordt bewaard en verder nergens gelezen. Dat is de golfindeling (D-14) en het staat
in gewone woorden op het scherm; fase 5 hoort die belofte na te komen.

## Verification

| Controle | Uitslag |
|---|---|
| `npx tsc --noEmit` | schoon, geen enkele fout |
| `npm test` | 45 suites, 1024 tests, alles groen |
| `npx expo export --platform web` | `Exported: dist` |
| `grep -c "group_id" components/BookingDetailSheet.tsx` | 6 (eis: minstens 3) |
| `grep -c "updateBooking(booking.id, { group_id" components/BookingDetailSheet.tsx` | 2 (koppelen en loskoppelen) |
| `grep -c "isAdmin" components/BookingDetailSheet.tsx` | 2 (import + de controle), en het blok staat erachter |
| `grep -c "actieveGroepen" components/BookingDetailSheet.tsx` | 2 (import + de ene aanroep) — zie afwijking 1 |
| `grep -c "series_id" components/BookingDetailSheet.tsx` | 4 (3 van vóór dit plan + 1 in het nieuwe commentaar) — zie afwijking 2 |
| `participant_ids` in dit bestand | alleen in het nieuwe commentaar; nergens gezet |
| `git diff providers/SimpleDataProvider.tsx` | leeg |
| `grep -c "lesson_duration_minutes" app/admin/settings.tsx` | 2 (eis: minstens 2) |
| `grep "lesson_duration_minutes ?? 60" app/admin/settings.tsx` | 1 regel |
| Elke `t()`-sleutel uit beide gewijzigde schermen in `lib/i18n-en.ts` | compleet op één na: `'Thema'` ontbrak al vóór dit plan — gemeld in `deferred-items.md` |
| SQL gedraaid of met Supabase verbonden | nee — geen enkele taak van dit plan raakt de databank |

## Commits

- `a0660a3` feat(lesgroepen): een les aan een groep hangen, en er weer af
- `5a3adc5` feat(instellingen): de club kiest hoe lang een les duurt

## Notes for Next Phase

- Plan 07 draait de migratie en loopt de upsert-val na. Let daarbij op `bookings.group_id`: het
  koppelen schrijft die kolom, en tot de migratie gedraaid is bestaat hij in productie niet.
- `updateBooking(booking.id, { group_id: undefined })` zet de sleutel op `undefined`. In de
  mock-opslag verdwijnt het veld bij het wegschrijven naar JSON; in Supabase-modus is het de
  moeite om bij de handmatige controle van plan 07 met eigen ogen te bevestigen dat losmaken de
  kolom écht op `null` zet en niet stilzwijgend overslaat.
- `lesson_duration_minutes` wordt nog nergens gelezen. Wie in fase 5 lessen gaat inplannen,
  leest hem daar — en nergens anders staat nog een hardgecodeerde 60 die dat mag tegenspreken.

## Self-Check: PASSED

`components/BookingDetailSheet.tsx`, `app/admin/settings.tsx` en `lib/i18n-en.ts` bestaan en zijn
gewijzigd; beide commits (`a0660a3`, `5a3adc5`) staan in de geschiedenis.
