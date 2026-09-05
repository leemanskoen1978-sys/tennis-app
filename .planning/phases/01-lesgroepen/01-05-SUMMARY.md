---
phase: 01-lesgroepen
plan: 05
subsystem: schermen
tags: [lesgroepen, rooster, archiveren, toegang, i18n]

# Dependency graph
requires:
  - phase: 01-lesgroepen
    provides: "lessenVanGroep, komendeLessen, planRosterChange, lesGroepFout (plan 01)"
  - phase: 01-lesgroepen
    provides: "lesGroepen op de context, updateLesGroep, updateLesGroepRoster, archiveLesGroep (plan 03)"
  - phase: 01-lesgroepen
    provides: "de route admin/lesgroepen/[id] in app/_layout.tsx en de kaarten die ernaartoe wijzen (plan 04)"
provides:
  - "/admin/lesgroepen/[id]: de gegevens van één groep wijzigen achter dezelfde beheerdersgrens"
  - "Het rooster van een groep bewerken via de gedeelde ParticipantPicker, met de gevolgen in gewone taal erbij"
  - "De lessen van een groep: hoeveel er nog komen, welke, en wat er eerder of afgezegd is"
  - "Archiveren en terugzetten van een groep, met wat het niet doet erbij"
affects: [01-06 (een les aan een groep hangen — pas dan valt er iets te tonen), 01-07 (RLS met de hand nalopen)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Concept-state: één object met de formuliervelden, null = nog niets aangeraakt, dan komen de waarden uit de rij zelf"
    - "Twee snelheden in één scherm: de groepsrij achter een Bewaren-knop, het rooster meteen weg — verschillende gevolgen, verschillende knop"

key-files:
  created:
    - app/admin/lesgroepen/[id].tsx
  modified:
    - lib/i18n-en.ts

key-decisions:
  - "De lessen worden getoond met de bestaande LessonCards en zijn detailblad; er is geen eigen lesregel geschreven en er is geen router.push, want er bestaat geen route naar één boeking"
  - "De rest van de lessen heet 'Eerder en afgezegd' en niet 'Geweest': lessenVanGroep minus komendeLessen bevat ook een afgezegde les van volgende week, en die hoort niet tussen twee lijsten weg te vallen"
  - "De archiveerknop is 'secondary' en geen 'danger': archiveren wist niets en draait met dezelfde knop terug — een rode knop zou liegen over wat er gebeurt"
  - "court_id en coach_id gaan uitdrukkelijk als undefined mee in de patch in plaats van weggelaten te worden, anders kan de beheerder een baan niet meer weghalen"
  - "GROEP-03 en GROEP-05 blijven In Progress; TOEG-01 ook — de redenen staan in REQUIREMENTS.md onder de tabel"

patterns-established:
  - "Elk scherm onder app/admin/lesgroepen/ draagt zijn eigen isAdmin-grens; erven van waar je vandaan kwam is geen grens"

requirements-completed: [GROEP-02, GROEP-06, GROEP-07]
requirements-in-progress: [GROEP-03, GROEP-05, TOEG-01]

# Metrics
duration: 22min
completed: 2026-09-06
---

# Phase 1 Plan 05: Het groepsdetail Summary

**De beheerder opent één lesgroep, wijzigt haar gegevens, zet er spelers in en uit — vanaf vandaag
vooruit, met de lessen die geweest zijn onaangeroerd — ziet hoeveel lessen er nog komen, en zet de
groep aan het einde van het seizoen weg zonder dat er één les of één deelnemerslijst verandert.**

## Performance

- **Duration:** ~22 min
- **Tasks:** 2 van 2
- **Files:** 1 nieuw, 1 gewijzigd
- **Tests:** 1024 — 45 suites, alles groen (ongewijzigd; dit plan voegt schermwerk toe en geen
  nieuwe pure regels)

## Accomplishments

### Taak 1 — `app/admin/lesgroepen/[id].tsx`: de gegevens en het rooster

**De grens staat bovenaan de component, vóór elke andere return.** `isAdmin(currentUser)` niet
waar → een `Screen scroll={false}` met dezelfde zin als het lijstscherm ("Lesgroepen zijn alleen
voor de beheerder."). Het commentaar erboven zegt waarom hij hier apart staat: een scherm dat zijn
grens erft van waar je vandaan kwam heeft er geen, want een trainer kan deze link intikken. Daarna
pas het geval "groep niet gevonden", met één zin, zoals `app/players/[id].tsx` het doet.

Het kopcommentaar benoemt de grens die dit scherm moet bewaken: `groep.roster` is "wie er nú in de
groep zit" en is nooit het antwoord op "wie stond er bij díe les" — dat blijft `participant_ids`
van de boeking, gelezen via `lib/groups`. In het hele bestand komt `participant_ids` daarom alleen
in dat commentaar voor.

Het formulier hergebruikt de velden en de opmaak van het aanmaakformulier uit plan 04: naam en
niveau als vrije tekst, de lesdag als `Chip`-rij over `DAY_LABELS` in leesvolgorde maandag-eerst,
het beginuur als `Chip`-rij uit `keuzeUren()`, de trainer uit `coachesOf(users)`, de baan uit
`courts` met "Geen baan" ervoor, en het seizoen als dd/mm/jjjj via `parseDayInput`/`dagSleutel`.
Wat er staat komt uit één `Concept`-object; `null` betekent "nog niets aangeraakt", en dan worden
de waarden uit de groep zelf gelezen — dezelfde vorm als `budgetTyped` in het spelersdossier.
Valideren doet uitsluitend `lesGroepFout`; er staat geen tweede regelset in het scherm.

Het rooster staat in een eigen kaart met de gedeelde `ParticipantPicker`: `players` uit
`playersOf(users)`, `payerId={undefined}` (een groep heeft geen betaler — dat begrip hoort bij één
les), `value={groep.roster}` en `onChange` naar `updateLesGroepRoster(groep.id, ids)`. Erboven de
zin die de regel eronder uitlegt: *"Wie je hier toevoegt of weghaalt, staat vanaf vandaag op de
lessen van deze groep. De lessen die al geweest zijn houden hun eigen deelnemerslijst en veranderen
niet mee."* Het scherm rekent daar zelf niets voor uit — dat is `planRosterChange` in
`lib/lesgroepen`, met de invariant-test uit plan 01 eromheen.

### Taak 2 — de lessen en de archiveerknop

Een kaart "Lessen" met de koptelling uit `komendeLessen` ("Nog 3 lessen te gaan"), afgezegde lessen
niet meegeteld. Daaronder de komende lessen als gewone leskaarten, en in een gedempt blok "Eerder
en afgezegd" wat er van `lessenVanGroep` overblijft.

Heeft de groep nog geen enkele les, dan staat er de eerlijke zin in plaats van een knop die er
bewust niet is: het inplannen van een heel seizoen komt met de import van de planning, tot dan hang
je een les zelf aan de groep (D-14). Er staat geen `planSeries`, geen `addBookingSeries` en geen
eigen lus die lesdatums uitrekent in dit bestand.

Onderaan de archiveerknop naar `archiveLesGroep(groep.id, !groep.archived)`, met de omgekeerde knop
bij een al gearchiveerde groep, en één zin over wat archiveren níet doet: de gegeven lessen en hun
geschiedenis blijven onaangeroerd en het rooster blijft staan zodat je later nog ziet wie erin zat
(GROEP-07). Een gearchiveerde groep draagt een `Badge` in de kopkaart, zodat je niet in een groep
zit te wijzigen zonder te weten dat de club hem niet meer inplant.

`lib/i18n-en.ts` kreeg elke nieuwe zin in het blokje dat plan 04 daar aanmaakte.

## Deviations from Plan

### Afwijkingen van het plan

**1. De lesregels navigeren niet, maar openen het bestaande detailblad.** Het plan zegt: navigeer
met één `router.push` naar de agendaweergave van die boeking, en kan dat niet zonder nieuw scherm,
laat de regel dan tonend zijn. Er ís geen route naar één boeking — het lesdetail is in deze app
altijd een blad (`BookingDetailSheet`), geopend vanuit `components/LessonCards`. Dat is precies wat
Historiek en Nog te komen doen. Ik heb daarom `LessonCards` hergebruikt in plaats van een dode
regel neer te zetten: geen nieuw scherm, geen `router.push`, en dezelfde les ziet er niet per
scherm anders uit. Bijkomend voordeel voor de grens van dit plan: wie er bij die ene les stond
leest dat blad uit de boeking zelf, niet uit het rooster van de groep.

**2. De Engelse zinnen van taak 1 zijn in de commit van taak 1 gezet, niet in die van taak 2.** Het
plan bundelt het Engels in taak 2. Beide commits staan er nu compleet in plaats van dat er één
commit lang een half vertaald scherm in de geschiedenis staat. Aan het eindresultaat verandert dit
niets: elke Nederlandse zin uit dit plan heeft een sleutel in `lib/i18n-en.ts`.

**3. Twee snelheden in één scherm, met opzet.** De groepsrij wijzigt achter een `Bewaren`-knop; het
rooster schrijft meteen weg. Dat is geen slordigheid: `updateLesGroep` patcht één rij, terwijl
`updateLesGroepRoster` de deelnemers van alle komende lessen meeneemt. Twee verschillende gevolgen
achter dezelfde knop zetten zou de beheerder laten denken dat het één handeling is.

**4. `grep -c "updateLesGroepRoster"` geeft 3, niet 1.** Dat zijn de import, het kopcommentaar dat
de regel benoemt, en de ene aanroep. Er is precies één aanroepplek. Idem voor `komendeLessen` (3:
import, commentaar, aanroep) en `lessenVanGroep` (3).

### Afwijkingen van de requirements-status

**GROEP-02, GROEP-06 en GROEP-07 gaan op Complete.** Spelers gaan er in en uit, een oude les houdt
zijn eigen deelnemerslijst, archiveren en terugzetten raakt geen enkele boeking.

**GROEP-03 blijft In Progress.** Het scherm telt en toont de lessen van een groep, en het lege
geval staat er in gewone woorden bij — maar er bestaat vandaag geen enkele manier om een les aan
een groep te hángen. Dat komt met plan 06. Hem nu op Complete zetten zou een scherm claimen dat
alleen nul kan tonen.

**GROEP-05 blijft In Progress, en niet alleen door de golfindeling.** Dit is de belangrijkste
bevinding van dit plan. De helft over spelers ("speler erbij of eraf") is waar en werkt vanaf
vandaag vooruit. De andere helft — "ander uur, andere trainer" — werkt níet door:
`updateLesGroep` patcht uitsluitend de groepsrij en verzet geen enkele al ingeplande les. Er
bestaat geen `planGroepWijziging`, en zo'n functie raakt meteen de botsingscontrole (een verzette
les kan dubbel boeken) en de betekenis van `coach_id` die fase 2 onder handen neemt. Dat is een
architecturale beslissing en geen inline-fix, dus ik heb hem niet gebouwd; hij staat als blokkade
in `STATE.md` en als toelichting onder de traceerbaarheidstabel. Geen enkel plan van fase 1 dekt
dit.

**TOEG-01 blijft In Progress tot plan 07**, niet tot plan 05 zoals de samenvatting van plan 04
verwachtte. De grens ligt nu op de tegel én op beide schermen, dus de belofte van dít plan is
ingelost. Maar plan 06 voegt nog een beheerdersstuk aan het lesdetailblad toe en plan 07 loopt de
RLS-kant met de hand na; beide plannen claimen TOEG-01 zelf ook. Pas als de héle module de grens
draagt en die controle gedaan is, is de requirement waar.

## Threat Flags

Geen nieuw netwerkpad en geen schemawijziging. Van het dreigingsregister van dit plan:

- **T-01-15** (trainer opent het detailscherm via de link) — afgedekt: `isAdmin(currentUser)`
  bovenaan de component, vóór elke andere return. RLS blijft de echte bewaking (plan 07).
- **T-01-16** (het scherm leest `roster` om te tonen wie er bij een les stond) — afgedekt: het
  kopcommentaar benoemt de grens en `participant_ids` komt in dit bestand alleen in dat commentaar
  voor. De lessenlijst gaat via `LessonCards`/`BookingDetailSheet`, die de boeking zelf lezen.
- **T-01-17** (een roosterwijziging overschrijft een les die geweest is) — afgedekt: het scherm
  rekent niets uit, `updateLesGroepRoster` gaat via `planRosterChange`.
- **T-01-18** (archiveren wist het rooster of raakt de boekingen) — afgedekt: het scherm geeft
  `archiveLesGroep` niets anders mee dan de id en het vinkje.
- **T-01-SC** — dit plan installeert geen enkel pakket.

## Known Stubs

Geen stub in het bestand. Wat er wel is: het lessenblok kan vandaag alleen nul tonen, omdat er nog
geen manier is om een les aan een groep te hangen (plan 06). Dat is de golfindeling, en het staat
in gewone woorden op het scherm zelf zodat de beheerder niet naar lessen gaat zoeken die er nooit
waren.

Het gat dat wél aandacht vraagt is GROEP-05's "ander uur, andere trainer" — zie hierboven. Het is
geen stub in dit scherm (er staat geen halve knop), maar een stuk van een requirement dat in fase 1
nergens belegd is.

## Verification

| Controle | Uitslag |
|---|---|
| `npx tsc --noEmit` | schoon, geen enkele fout |
| `npm test` | 45 suites, 1024 tests, alles groen |
| `npx expo export --platform web` | `Exported: dist` |
| `grep -c "isAdmin(currentUser)" 'app/admin/lesgroepen/[id].tsx'` | 1, en de controle staat vóór elke andere `return` in de component |
| `grep -c "<ParticipantPicker"` | 1, met `payerId={undefined}` en `value={groep.roster}` |
| `grep -c "updateLesGroepRoster"` | 3 (import + commentaar + de ene aanroep) |
| `grep -c "updateLesGroep("` | 1 |
| `grep -c "komendeLessen"` / `"lessenVanGroep"` / `"archiveLesGroep"` | 3 / 3 / 2 |
| `grep -c "planSeries"` / `"addBookingSeries"` | 0 / 0 |
| Eigen lus die lesdatums uitrekent | geen — geen `for`, geen `while`, geen `setDate` in het bestand |
| `grep -n "participant_ids"` | regel 5 en 9, allebei kopcommentaar; nergens code |
| Elke `t()`-sleutel uit het scherm in `lib/i18n-en.ts` | 32 sleutels, met een scriptje nagelopen: niets ontbreekt |
| SQL gedraaid of met Supabase verbonden | nee — geen enkele taak van dit plan raakt de databank |

## Commits

- `e300083` feat(lesgroepen): de gegevens van een groep bijstellen en spelers erin zetten
- `141755a` feat(lesgroepen): de lessen van een groep, en de groep wegzetten aan het einde van het seizoen

## Notes for Next Phase

- Plan 06 maakt het lessenblok van dit scherm pas zichtbaar gevuld: zodra een boeking een
  `group_id` krijgt, verschijnt ze hier vanzelf in "Nog X lessen te gaan" of onder "Eerder en
  afgezegd". Er is geen extra bedrading nodig.
- Plan 07 zet TOEG-01 op Complete, ná de handmatige RLS-controle.
- GROEP-05's tweede helft ("ander uur, andere trainer" werkt door in de komende lessen) is
  nergens belegd. Wie hem oppakt: dat is een `planGroepWijziging` in `lib/lesgroepen` naast
  `planRosterChange`, mét botsingscontrole via dezelfde predicaat als `lib/recurrence.ts::collides`
  — niet een derde versie van "overlappen deze twee tijdvakken" — en met een besluit over wat
  `coach_id` van een al ingeplande les betekent zodra fase 2 "wie gaf de les écht" invoert.
- In Supabase-modus komt een wijziging pas echt aan zodra de migratie uit plan 02 gedraaid is
  (plan 07).

## Self-Check: PASSED

`app/admin/lesgroepen/[id].tsx` bestaat (323+ regels), `lib/i18n-en.ts` is gewijzigd, en beide
commits (`e300083`, `141755a`) staan in de geschiedenis.
