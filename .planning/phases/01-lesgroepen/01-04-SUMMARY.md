---
phase: 01-lesgroepen
plan: 04
subsystem: schermen
tags: [lesgroepen, beheer, toegang, expo-router, i18n]

# Dependency graph
requires:
  - phase: 01-lesgroepen
    provides: "LesGroep, lesGroepFout, actieveGroepen, gearchiveerdeGroepen (plan 01)"
  - phase: 01-lesgroepen
    provides: "lesGroepen op de context en addLesGroep (plan 03)"
provides:
  - "/admin/lesgroepen: aanmaakformulier plus lijst, met de beheerdersgrens op het scherm zelf"
  - "De tegel Lesgroepen onder Club, alleen met het beheerdersvinkje"
  - "De koptitels voor admin/lesgroepen/index en admin/lesgroepen/[id]"
  - "De Engelse tegenhangers van elke zin uit dit plan, inclusief de meldingen van lesGroepFout"
affects: [01-05 (groepsdetail achter dezelfde grens), 01-06 (les aan groep hangen), 01-07 (migratie draaien)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Schermgrens vóór elke andere return: isAdmin bovenaan, met de reden als commentaar"
    - "Nog-niets-gekozen als null, waarna de ene validatie in lib/ de zin levert — geen tweede regelset in het scherm"

key-files:
  created:
    - app/admin/lesgroepen/index.tsx
  modified:
    - app/admin/index.tsx
    - app/_layout.tsx
    - lib/i18n-en.ts

key-decisions:
  - "Het beginuur komt als 'HH:MM' uit keuzeUren en wordt gesplitst in start_hour/start_minute — hergebruik van de bestaande urenkeuze uit Boekingstijden in plaats van een nieuwe component"
  - "Weekdag met dezelfde Chip-rij en DAY_LABELS als de lesdagen in LidBewerken; leesvolgorde maandag-eerst, opslag blijft getDay()"
  - "Niet-gekozen velden gaan als -1 / lege dagsleutel de validatie in, zodat lesGroepFout de melding levert en het scherm geen eigen controles krijgt"
  - "De meldingen van lesGroepFout kregen alsnog een Engelse tegenhanger: ze verschijnen op dit scherm in de foutregel en bleven anders zichtbaar Nederlands"
  - "TOEG-01 blijft In Progress tot het groepsdetail (plan 05) dezelfde grens draagt"

patterns-established:
  - "Elk nieuw scherm onder app/admin/lesgroepen/ draagt zijn eigen isAdmin-grens, met een commentaar dat zegt waarom de tegel niet volstaat"

requirements-completed: [GROEP-01]
requirements-in-progress: [TOEG-01]

# Metrics
duration: 16min
completed: 2026-09-05
---

# Phase 1 Plan 04: Het lesgroepenscherm Summary

**De beheerder maakt vanuit Beheer → Lesgroepen een groep aan met naam, niveau, dag, uur, trainer,
baan en seizoen, ziet zijn groepen (en apart zijn archief) staan, en een trainer zonder
beheerdersvinkje komt er niet op — ook niet door de link in te tikken.**

## Performance

- **Duration:** ~16 min
- **Tasks:** 2 van 2
- **Files:** 1 nieuw, 3 gewijzigd
- **Tests:** 1024 — 45 suites, alles groen (ongewijzigd; dit plan voegt schermwerk toe en geen
  nieuwe pure regels)

## Accomplishments

### Taak 1 — `app/admin/lesgroepen/index.tsx`

Het scherm volgt `app/admin/vakanties.tsx` in vorm en toon: een kopcommentaar dat uitlegt wat een
lesgroep is en wat dit scherm bewust nog níet doet (een seizoen inplannen komt met de import,
D-14), een uitlegzin bovenaan, een `Card` met het formulier, en de lijst eronder.

**De grens staat bovenaan de component, vóór elke andere return.** `isAdmin(currentUser)` niet
waar → een `Screen scroll={false}` met één zin in `styles.muted`: "Lesgroepen zijn alleen voor de
beheerder." Het commentaar erboven zegt waarom dit geen dubbelop is met de tegel: een verborgen
tegel is geen toegangscontrole, want een trainer kan de link intikken (TOEG-01, T-01-12).

Het formulier: naam en niveau als vrije tekst (de club schrijft "Kidstennis oranje", geen vaste
keuzelijst), de lesdag als `Chip`-rij met `DAY_LABELS` in leesvolgorde maandag-eerst — dezelfde
vorm als de lesdagen in `components/LidBewerken.tsx`, met `getDay()` als opgeslagen waarde — en
het beginuur als `Chip`-rij uit `keuzeUren()` van `lib/boekingstijd`, precies zoals
`app/admin/boekingstijden.tsx` het doet. Er is dus geen nieuwe keuzecomponent bijgekomen. De
trainer komt uit `coachesOf(users)`, de baan uit `courts` met een eigen chip "Geen baan" ervoor;
het label zegt "Baan (mag leeg)" (D-13). Het seizoen gaat als dd/mm/jjjj in en loopt via
`parseDayInput` en `dagSleutel` naar de dagsleutel, exact zoals `voegToe` in `vakanties.tsx`.

**Valideren doet uitsluitend `lesGroepFout`.** Er staat geen enkele eigen controle op een lege
naam, een weekdag buiten 0-6 of een omgekeerd seizoen in dit bestand. Wat nog niet gekozen is,
gaat als `-1` (weekdag, uur, minuut) of als lege dagsleutel de validatie in, zodat de melding uit
`lib/lesgroepen` komt en niet uit een tweede regelset op het scherm (T-01-14). Alleen de
onleesbare-datum-terugval ("Vul beide dagen in als dd/mm/jjjj.") staat hier, net als bij de
clubkalender — dat is geen groepsregel maar een leesfout van het invoerveld.

De lijst toont per actieve groep de naam, de dag en het uur, de trainer, het aantal spelers, het
niveau, de baan en de seizoensperiode (via `periodeTekst`). Elke kaart navigeert naar
`/admin/lesgroepen/[id]` — dat scherm komt in plan 05. De gearchiveerde groepen staan eronder in
een eigen, gedempt blokje met een kopje, en alleen als ze bestaan. Is de lijst leeg, dan staat er
één eerlijke zin: een groep die je hier aanmaakt zet nog geen lessen in de agenda.

Elke zichtbare zin loopt door `t()`, met de Nederlandse zin als sleutel.

### Taak 2 — de tegel, de routes en het Engels

`app/admin/index.tsx` kreeg één tegel in de sectie `'club'`, in de
`...(isAdmin(currentUser) ? [...] : [])`-vorm, met `GraduationCap` als icoon — nieuw in dit
bestand, dus geen twee tegels met hetzelfde glyph. Het commentaar erboven zegt waarom hij alleen
voor de beheerder is (de tennisschool is van de club, een trainer houdt zijn eigen agenda, D-09)
en dat het verbergen wellevendheid is en geen bewaking: het scherm en de policies doen dat.

`app/_layout.tsx` kreeg `admin/lesgroepen/index` ("Lesgroepen") en `admin/lesgroepen/[id]`
("Lesgroep"), met de reden waarom de tweede vooruit geregistreerd is.

`lib/i18n-en.ts` kreeg een eigen blokje ("Beheer → Lesgroepen: de vaste groepen van de
tennisschool (app/admin/lesgroepen)") met elke nieuwe zin.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Ontbrekende functionaliteit] De meldingen van `lesGroepFout` hadden geen Engelse
tegenhanger**
- **Gevonden bij:** Taak 2
- **Probleem:** De zeven zinnen uit `lesGroepFout` komen uit plan 01 en stonden nergens in
  `lib/i18n-en.ts`. Ze verschijnen op dít scherm, in de foutregel, dus wie de app op Engels zet
  kreeg netjes Engelse labels met een Nederlandse foutmelding eronder — precies het zichtbare gat
  dat de kop van `i18n-en.ts` beschrijft.
- **Oplossing:** De zeven zinnen toegevoegd in hetzelfde blokje, met een commentaarregel die zegt
  waar ze vandaan komen.
- **Bestanden:** `lib/i18n-en.ts`
- **Commit:** `c045c69`

### Afwijkingen van de acceptatiecriteria

**1. `grep -c "lesGroepFout" app/admin/lesgroepen/index.tsx` geeft 2, niet 1.** De twee regels zijn
de import uit `../../../lib/lesgroepen` en de ene aanroep; één zou betekenen dat er geen import is.
`grep -c "lesGroepFout("` geeft wel exact 1 — er is precies één aanroepplek, wat de bedoeling van
het criterium is. Twee prozavermeldingen in commentaar zijn herschreven naar "de validatie in
lib/lesgroepen" om er niet verder van af te liggen; dezelfde afweging als in plan 03.

**2. `grep -c "actieveGroepen\|gearchiveerdeGroepen"` geeft 2 zoals gevraagd**, doordat beide
aanroepen in één `useMemo` op dezelfde regel staan. Dat is geen trucje om een grep te halen: de
twee lijsten hangen aan dezelfde `lesGroepen` en horen in één berekening thuis.

**3. GROEP-01 op Complete, TOEG-01 op In Progress.** GROEP-01 ("de beheerder kan een lesgroep
aanmaken met naam, niveau, vaste dag en uur, vaste trainer, baan en seizoensperiode") is vanaf nu
echt waar. TOEG-01 gaat over de héle module: het detailscherm van een groep (plan 05) moet dezelfde
grens dragen, en de RLS-kant wordt in plan 07 met de hand nagelopen. Hem nu op Complete zetten zou
een onwaarheid in de traceerbaarheid zetten; de reden staat in `REQUIREMENTS.md` onder de tabel.

## Threat Flags

Geen nieuw netwerkpad en geen schemawijziging. Van het dreigingsregister van dit plan:

- **T-01-12** (trainer tikt de link in) — afgedekt: `isAdmin(currentUser)` bovenaan de component,
  vóór elke andere return, met de weigerzin. De tegelgrens staat daarnaast, niet in plaats daarvan.
- **T-01-13** (rechtstreekse API-aanroep) — blijft bij de databank liggen, zoals bedoeld: de
  policies `lesson_groups_select`/`_write` uit plan 02, nagelopen in plan 07.
- **T-01-14** (lege naam, weekdag buiten 0-6, omgekeerd seizoen) — afgedekt: `lesGroepFout` is de
  enige validatie in het scherm; de `check`-beperkingen op `lesson_groups` zijn het vangnet.
- **T-01-SC** — dit plan installeert geen enkel pakket.

## Known Stubs

Eén bewuste vooruitwijzing, geen stub in de zin van "leeg gelaten": elke groepskaart navigeert naar
`/admin/lesgroepen/[id]`, en dat scherm bestaat pas na plan 05. De route is in `_layout.tsx`
alvast geregistreerd; het plan schrijft die vooruitregistratie letterlijk voor.

Wat het scherm níet doet — een seizoen aan lessen inplannen — is geen stub maar D-14, en het staat
in gewone woorden op het scherm zelf zodat de beheerder niet naar lessen gaat zoeken die er nooit
waren.

## Verification

| Controle | Uitslag |
|---|---|
| `npx tsc --noEmit` | schoon, geen enkele fout |
| `npm test` | 45 suites, 1024 tests, alles groen |
| `npx expo export --platform web` | `Exported: dist` |
| `grep -c "isAdmin(currentUser)" app/admin/lesgroepen/index.tsx` | 1, en de controle staat vóór elke andere `return` |
| `grep "Lesgroepen zijn alleen voor de beheerder."` | regel 67 |
| `grep -c "lesGroepFout("` | 1 (regelteller op de naam: 2, zie afwijking 1) |
| `grep -c "addLesGroep"` | 2 (import + aanroep) |
| `grep -c "actieveGroepen\|gearchiveerdeGroepen"` | 2 |
| `grep -n ">[A-Z][a-z]" app/admin/lesgroepen/index.tsx` | niets — geen kale zin buiten `t()` |
| `grep -c "router.push('/admin/lesgroepen')" app/admin/index.tsx` | 1, binnen `isAdmin(currentUser)` in de sectie `'club'` |
| Icoon van de nieuwe tegel | `GraduationCap`, komt bij geen andere tegel voor |
| `grep -c "admin/lesgroepen/index\|admin/lesgroepen/\[id\]" app/_layout.tsx` | 2 |
| Elke `t()`-sleutel uit het scherm in `lib/i18n-en.ts` | ja, met een scriptje nagelopen: niets ontbreekt |
| SQL gedraaid of met Supabase verbonden | nee — geen enkele taak van dit plan raakt de databank |

## Commits

- `97d7354` feat(lesgroepen): de beheerder maakt een lesgroep aan en ziet zijn groepen staan
- `c045c69` feat(lesgroepen): een tegel onder Club brengt de beheerder bij zijn lesgroepen

## Notes for Next Phase

- Plan 05 (`app/admin/lesgroepen/[id].tsx`) moet dezelfde `isAdmin`-grens bovenaan dragen, met
  dezelfde weigerzin — de sleutel staat al in `lib/i18n-en.ts`. Pas dan gaat TOEG-01 op Complete.
- De kop van dat scherm is al geregistreerd in `app/_layout.tsx` als `admin/lesgroepen/[id]`
  ("Lesgroep").
- Het formulier vult `start_minute` vandaag altijd met 0, omdat `keuzeUren()` hele uren geeft.
  Wil de club groepen op het halfuur, dan is dat één uitbreiding van de urenkeuze; het veld en de
  validatie (0-59) dragen het al.
- In Supabase-modus komt een aangemaakte groep pas echt aan zodra de migratie uit plan 02 gedraaid
  is (plan 07).

## Self-Check: PASSED

Alle genoemde bestanden bestaan en beide commits staan in de geschiedenis.
