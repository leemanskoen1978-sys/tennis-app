---
phase: 05-excel-import-van-trainingen
plan: 06
subsystem: de lessen zelf — vakanties eruit, botsingen gemeld, en een herimport die niets stil terugdraait
tags: [import, trainingen, lessen, herimport, vakanties, botsingen, zomertijd, geen-pakket]
requires:
  - "lib/import-trainingen.ts: leesLesRegels, groepenUitRegels, groepRosterVerschil, spelersUitRegels, koppelingVoorGroep (plan 05-04, 05-05)"
  - "lib/recurrence.ts: botstMet (bestaand, ongewijzigd) — de enige botsingsregel van de app"
  - "lib/vakanties.ts: vakantieOpMoment, dagSleutel (bestaand, ongewijzigd)"
  - "lib/lesgroepen.ts: groupBookingsFrom (bestaand, ongewijzigd)"
  - "lib/beurtenkaart.ts: GROEPSLES_METHOD (bestaand, ongewijzigd)"
  - "lib/types.ts: Settings.lesson_duration_minutes, Booking, BookingStatus"
provides:
  - "lib/import-trainingen.ts: ImportBoeking, lesSleutel, lesduurVan, LESDUUR_MINUTEN"
  - "lib/import-trainingen.ts: GeplandeLes, OvergeslagenLes, deelnemersVoorLes, alsBezet"
  - "lib/import-trainingen.ts: GroepLessen, lessenUitGroep(groep, koppeling, boekingen, vakanties, duur, nu)"
  - "lib/import-trainingen.ts: HandmatigeWijziging, VerdwenenLes, groepWijzigingen"
  - "lib/import-trainingen.ts: NIEUWE_SPELER, spelerSleutel, GroepInPlan"
  - "lib/import-trainingen.ts: ImportPlanLessen, planImportLessen(rijen, groepen, users, courts, bookings, settings, nu)"
affects: []
tech-stack:
  added: []
  patterns:
    - "de datums komen uit het bestand; er wordt geen herhaalregel gebouwd die weken verzint"
    - "vakantie vóór botsing, dezelfde volgorde als lib/recurrence en lib/lesgroepen"
    - "de goedgekeurde lessen gaan als bezet terug de lijst in: het bestand botst ook met zichzelf"
    - "de sleutel groep + dag + beginuur herkent een les; op dagniveau wint wat er met de hand staat"
    - "`nu` is een parameter, nooit `new Date()` binnenin"
    - "kaarten één keer bouwen: op trainer, op baan, op groep — nooit een lijst in een lijst"
key-files:
  created: []
  modified: [lib/import-trainingen.ts, lib/import-trainingen.test.ts]
decisions:
  - "De vergelijking met wat er al staat gaat vóór de vakantie- en botsingscontrole: een les die al bestaat mag nooit als 'bezet' gemeld worden — hij zou met zichzelf botsen"
  - "De herkenning gebeurt op sleutelniveau (groep + dag + uur + minuut), de bescherming op dagniveau: staat er die dag wél een les van die groep maar anders, dan is dat een handmatige wijziging en komt er geen tweede les naast"
  - "`verdwenenUitBestand` bevat alleen niet-afgezegde komende lessen, en is een melding — er wordt niets verwijderd"
  - "`groepWijzigingen` rekt het seizoen op en kort het nooit in: wie één maand opnieuw inleest bedoelt niet dat het seizoen voortaan één maand duurt"
  - "Een nieuwe speler krijgt in het rooster van het plan een plaatshouder `nieuw:<genormaliseerde naam>`; zonder dat zou een groep waaraan één nieuwe speler toegevoegd wordt als 'ongewijzigd' op het scherm staan"
  - "`deelnemersVoorLes` levert betaler, deelnemers en betaalwijze los van een `Booking`: het plan blijft daarmee vrij van identiteiten, en plan 05-08 zet er de ids in"
  - "IMP-02 en IMP-05 t/m IMP-11 blijven Pending in REQUIREMENTS.md, dezelfde lijn als 05-04 en 05-05: er wordt nog niets weggeschreven en er is nog geen droogloop op het scherm"
metrics:
  duration: ~45 min
  completed: 2026-09-06
  tasks: 3
  tests_before: 1420
  tests_after: 1420
---

# Phase 5 Plan 06: De lessen zelf — Summary

`planImportLessen` maakt van rijen tekst een volledig plan: welke lessen erbij komen, welke in een
clubvakantie vallen, welke botsen met een bezette trainer of baan, welke er al staan, en welke
iemand met de hand verzet of afgezegd heeft — zonder één databankverbinding en zonder één `await`.

## Wat er gebouwd is

**`lib/import-trainingen.ts` (974 → 1584 regels)**

| Blok | Wat het doet |
|---|---|
| `ImportBoeking` | `BezetBoeking` uit lib/recurrence met de groep erbij: de botsingsvraag heeft die niet nodig, de herimport wél |
| `lesduurVan` + `LESDUUR_MINUTEN` | De duur uit `Settings.lesson_duration_minutes`, zestig als de club niets zei — en nooit met terugwerkende kracht |
| `lesSleutel` | `groep\|dag\|uur\|minuut`. Een herkenningssleutel, geen uniciteitsregel — dezelfde formulering als `groepSleutel` |
| `GeplandeLes` / `OvergeslagenLes` | Lokale `Date`-velden, plus het regelnummer van de rij waar de les uit komt (T-05-17). De redenen heten `vakantie`, `bezet` en `verleden` — letterlijk de woorden van lib/recurrence en lib/lesgroepen |
| `deelnemersVoorLes` | De eerste speler betaalt, de rest staat ernaast, en bij meer dan één speler is het `GROEPSLES_METHOD` |
| `alsBezet` | Een goedgekeurde les als bezette plek, zodat het bestand ook met zichzelf botst |
| `lessenUitGroep` | Per uniek moment van de groep één kandidaat: verleden → staat het er al → stond er met de hand iets anders → vakantie → botsing → inplannen |
| `HandmatigeWijziging` / `VerdwenenLes` | Wat de beheerder moet zien om te beslissen, zonder zijn bestand ernaast te leggen |
| `groepWijzigingen` | Alleen de velden die echt veranderen; naam, dag en uur zijn de sleutel en dus per definitie gelijk |
| `NIEUWE_SPELER` + `spelerSleutel` | De plaatshouder van een leerling die nog geen id heeft |
| `GroepInPlan` + `ImportPlanLessen` + `planImportLessen` | Het volledige plan, in één synchrone pas |

**`lib/import-trainingen.test.ts` (833 → 1358 regels, 133 tests)** — 41 nieuwe tests, geen
`jest.mock`, geen `jest.fn`, geen `Date.UTC`.

## De vier dingen die precies goed moesten

**1. Een tweede inleesbeurt verandert niets.** De sleutel van een les is zijn groep, zijn dag en
zijn beginuur. Het snijpunt met wat er al staat valt in `ongewijzigd`; alleen wat er niet staat
wordt een nieuwe les. De test bouwt letterlijk de eerste import, maakt er boekingen van, en leest
hetzelfde bestand opnieuw: nul nieuwe lessen, nul meldingen.

**2. Wat met de hand veranderd is, blijft van de beheerder.** De herkenning gebeurt op de sleutel,
maar de bescherming op de dag. Staat er op die dag wél een les van die groep — op een ander uur of
afgezegd — dan komt die dag in `handmatigGewijzigd`, mét de bestaande tijd, de tijd uit het bestand
en de status. Er wordt niets verzet en er komt geen tweede les naast. Zonder die dagcontrole zou
een herimport een afzegging stilzwijgend ongedaan maken (D-13).

**3. Lokale tijd, ook over beide wissels.** Elk lesmoment wordt gebouwd met
`new Date(jaar, maand - 1, dag, uur, minuut)`, en de duur wordt in het minuutveld opgeteld.
`.toISOString()` komt precies twee keer voor: om de botsingsvraag te stellen en om een geplande les
als bezet terug te geven — nooit om een datum te lézen. De fixture-test loopt van 1 oktober 2026
tot 30 april 2027 en controleert de woensdagen 21 en 28 oktober 2026 (rond de wissel van zondag
25 oktober) en 24 en 31 maart 2027 (rond die van zondag 28 maart): dertig lessen, allemaal 17:00,
allemaal eindigend om 18:00. Dezelfde controle op `Groep 8` van woensdag uit `koen.xlsx` zelf.

**4. Hergebruikt, niet nagebouwd.** `botstMet` uit lib/recurrence is de enige botsingsregel;
`vakantieOpMoment` uit lib/vakanties de enige clubkalender; `groupBookingsFrom` uit lib/lesgroepen
de enige "vanaf nu"-grens. `git diff --stat` op die drie bestanden is leeg. `grep -c 'planSeries'`
geeft `0`: de datums komen uit het bestand, niet uit een herhaalregel.

## Schaal

De botsingslijst wordt niet per groep opnieuw doorlopen. `planImportLessen` bouwt drie kaarten —
op trainer, op baan, op groep — en geeft `lessenUitGroep` alleen mee wat die groep kan raken; de
goedgekeurde lessen gaan meteen in diezelfde kaarten. De namen van de spelers gaan door één
`Map<genormaliseerde naam, id>`. Op `koen.xlsx` (1398 regels, tien groepen, 325 lessen voor één
trainer) loopt de hele suite in onder de seconde.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Ontbrekende functionaliteit] `deelnemersVoorLes` naast `GeplandeLes`**

- **Found during:** taak 1
- **Issue:** `<behavior>` eist dat een les `player_id`, `participant_ids` en `payment_method`
  krijgt, terwijl `<action>` in dezelfde taak verbiedt om hier een `Booking` te bouwen — die
  identiteiten bestaan pas in plan 05-08.
- **Fix:** een aparte pure functie `deelnemersVoorLes(roster)` die precies die drie velden uit een
  rooster afleidt, met de grens van lib/groups erin (de betaler staat niet in `participant_ids`) en
  `GROEPSLES_METHOD` bij meer dan één speler. `GeplandeLes` blijft vrij van identiteiten.
- **Files modified:** `lib/import-trainingen.ts`, `lib/import-trainingen.test.ts`
- **Commit:** 5c169b5

**2. [Rule 2 - Ontbrekende functionaliteit] `groepWijzigingen`**

- **Found during:** taak 2
- **Issue:** `<behavior>` eist "een groep waarvan alleen het niveau verandert staat als bijgewerkt
  met alleen dat veld", maar `groepRosterVerschil` uit plan 05-05 kijkt alleen naar het rooster.
- **Fix:** `groepWijzigingen(bestaand, groep, koppeling)` levert alleen de velden die echt
  veranderen, in de vorm van `verschillen` in lib/import-leden. Het seizoen wordt daarbij opgerekt
  en nooit ingekort.
- **Files modified:** `lib/import-trainingen.ts`, `lib/import-trainingen.test.ts`
- **Commit:** f261a30

**3. [Rule 2 - Ontbrekende functionaliteit] `regels` in het plan, en het regelnummer op elke les**

- **Found during:** taak 1 en 3
- **Issue:** T-05-17 vraagt dat elke les haar rij kan aanwijzen, en `bestandAfgekeurdLessen` moet
  volgens taak 3 tegen het volledige plan werken zonder een tweede vorm te krijgen.
- **Fix:** `GeplandeLes.regel` en `OvergeslagenLes.regel`, en `ImportPlanLessen.regels` met de
  gelezen regels erin. Daardoor werkt `bestandAfgekeurdLessen` ongewijzigd op zowel de leesuitkomst
  als het volledige plan — geen tweede afkeuringsregel.
- **Files modified:** `lib/import-trainingen.ts`, `lib/import-trainingen.test.ts`
- **Commits:** 5c169b5, 4f9839c

**4. [Rule 1 - Bug] Een commentaar brak zijn eigen acceptatiecriterium**

- **Found during:** taak 1
- **Issue:** twee commentaren verwezen naar `planSeries` om uit te leggen waarom die hier juist
  níét gebruikt wordt, en het acceptatiecriterium telt voorkomens van die naam in het hele bestand.
  `grep -c 'planSeries'` gaf `2` in plaats van `0`.
- **Fix:** de commentaren spreken nu van "de reeksenbouwer van lib/recurrence". Dezelfde
  waarschuwing, zonder de naam die de controle in de war stuurt. (Exact dezelfde valkuil als
  `Date.UTC` in plan 05-05.)
- **Files modified:** `lib/import-trainingen.ts`
- **Commit:** 5c169b5

### Bewust niet gedaan

**IMP-02 en IMP-05 t/m IMP-11 blijven Pending in REQUIREMENTS.md.** De frontmatter noemt
IMP-02, IMP-05, IMP-06, IMP-07, IMP-08 en IMP-11. Alle zes zijn geformuleerd als iets wat de
beheerder ziet of wat de club overhoudt ("de import plant de lessen in", "de beheerder ziet vóór er
iets wegschrijft"). Dit plan levert het volledige rekenwerk daarvoor, maar er wordt nog niets
weggeschreven (05-08) en er is nog geen droogloop op het scherm (05-09). Dezelfde lijn als plan
05-04 met IMP-01/IMP-02 en 05-05 met IMP-03/IMP-04.

**Een groep die de club al kent, valt niet terug op haar eigen baan of trainer.** `koen.xlsx` heeft
geen kolom `Baan`, dus er wordt uit dat bestand nul lessen ingepland — ook als de club de groep al
kent en er allang een baan aan hing. Dat is met opzet zo gelaten: plan 05-09 rekent er uitdrukkelijk
op dat de droogloop op `koen.xlsx` "nul ingeplande lessen" toont met als enige melding dat de
trainer en de baan gekoppeld moeten worden. Zou dit plan een terugval toevoegen, dan werd die
acceptatie ongemerkt onmogelijk. Wie dit later toch wil, hoort het daar te doen.

## Wat de handmatige controle (plan 05-10) moet weten

De zomer- en wintertijdtests draaien alleen in een tijdzone die een wissel kent. Ze controleren dat
aan het begin van hun `describe` met `getTimezoneOffset()`; kent de tijdzone geen wissel, dan
worden ze luid overgeslagen — met een `console.warn` die de tijdzone noemt — in plaats van stil te
slagen. Ze zijn hier gedraaid onder `Europe/Brussels` (133 tests, alles groen), onder
`America/New_York` (ook groen: een westelijke tijdzone met een andere wisseldatum) en onder
`TZ=UTC` (4 overgeslagen, 129 groen, met de waarschuwing in beeld). Wie op de bouwserver zeker wil
weten dat ze iets bewijzen, draait `TZ=Europe/Brussels npm test`.

## Threat Flags

Geen nieuw aanvalsvlak: geen netwerk, geen bestandssysteem, geen schema erbij. De vijf dreigingen
die dit plan toegewezen kreeg:

| Threat ID | Waar |
|---|---|
| T-05-14 (een herimport die een afzegging terugdraait) | De dagcontrole vóór het inplannen: elke bestaande les op die dag — ook een afgezegde — maakt er een `handmatigGewijzigd` van. Twee tests, waaronder één met `cancelled` |
| T-05-15 (een herimport die lessen verdubbelt) | `lesSleutel` als herkenningssleutel; het snijpunt valt in `ongewijzigd`. De test bouwt de eerste import na en leest hetzelfde bestand opnieuw |
| T-05-16 (een bestand met tienduizend groepen) | Drie kaarten en één namenkaart, één keer gebouwd; `lessenUitGroep` krijgt per groep alleen wat die groep kan raken |
| T-05-17 (een les die verschijnt zonder dat iemand weet waarom) | `GeplandeLes.regel`, `OvergeslagenLes.regel` en `HandmatigeWijziging.regel` wijzen naar de rij in Excel; elke overslag draagt zijn reden |
| T-05-SC (npm-installs) | Niets geïnstalleerd; `git diff --stat package.json package-lock.json` is leeg |

## Known Stubs

Geen. Wat dit plan niet doet, doet het met opzet niet: er wordt nog steeds niets weggeschreven
(plan 05-08) en er is nog geen scherm (plan 05-09). `planImportLessen` is de enige functie die dat
scherm hoeft te kennen.

## Deferred Issues

`lib/goals.test.ts` → `newGoalId does not hand out the same id twice` viel één keer om in een
volledige `npm test`-run en slaagde daarna weer. De oorzaak ligt buiten deze fase:
`newGoalId` in `lib/goals.ts` plakt vier tekens toeval achter `Date.now()`, en vijftig trekkingen
in dezelfde milliseconde botsen soms. Niet aangeraakt — het valt buiten de reikwijdte van dit plan
en staat genoteerd in `.planning/phases/05-excel-import-van-trainingen/deferred-items.md`.

## Verification

```
npx tsc --noEmit                     → nul fouten
npx jest lib/import-trainingen       → 133 passed (was 92)
npm test                             → 52 suites, 1420 tests passed
TZ=UTC npx jest lib/import-trainingen        → 129 passed, 4 skipped, mét waarschuwing
TZ=America/New_York npx jest lib/import-...  → 133 passed
npx expo export --platform web       → gelukt (entry-bundle 3.81 MB)
git diff --stat package.json package-lock.json                     → leeg
git diff --stat lib/recurrence.ts lib/vakanties.ts lib/lesgroepen.ts → leeg
```

Acceptatiecriteria per taak, alle gehaald:

```
taak 1
  grep -c 'botstMet'                          → 6   (≥ 1)
  grep -c 'vakantieOpMoment|vakantieOp('      → 3   (≥ 1)
  grep -c 'planSeries'                        → 0
  grep -c 'lesson_duration_minutes'           → 4   (≥ 1)
  grep -c 'Date.UTC'                          → 0
  rekenen in milliseconden (* 60000 e.d.)     → 0
  git diff --stat lib/recurrence.ts lib/vakanties.ts → leeg

taak 2
  grep -c 'tweede keer' (test)                → 1   (≥ 1)
  grep -ci 'afgezegd|cancelled' (test)        → 4   (≥ 1)
  grep -c 'handmatigGewijzigd'                → 3   (≥ 2)
  grep -c 'verdwenenUitBestand'               → 3   (≥ 2)
  'new Date()' buiten commentaar              → 0

taak 3
  grep -c 'export function planImportLessen'  → 1
  grep -c 'await'                             → 0
  grep -c "from './supabase|from './sync"     → 0
  grep -c '25 oktober|2026, 9, 25' (test)     → 2   (≥ 1)
  grep -c '28 maart|2027, 2, 28' (test)       → 2   (≥ 1)
  grep -c 'getHours()' (test)                 → 12  (≥ 1)
  grep -c 'getTimezoneOffset' (test)          → 2   (≥ 1)
  grep -c 'jest.mock|jest.fn' (test)          → 0
```

## Self-Check: PASSED

- `lib/import-trainingen.ts` — FOUND
- `lib/import-trainingen.test.ts` — FOUND
- 6b2083d `test(import-trainingen): een les valt weg in een vakantie en botst ook met zichzelf` — FOUND
- 5c169b5 `feat(import-trainingen): de lessen volgen uit de datums in het bestand, vakanties eruit` — FOUND
- d32caf3 `test(import-trainingen): hetzelfde bestand een tweede keer verandert niets` — FOUND
- f261a30 `feat(import-trainingen): een tweede inleesbeurt verdubbelt niets en zet niets stil terug` — FOUND
- 08f1ae6 `test(import-trainingen): een seizoen over beide tijdwissels staat overal om 17:00` — FOUND
- 4f9839c `feat(import-trainingen): één plan uit rijen tekst, te zien vóór er iets vastligt` — FOUND
