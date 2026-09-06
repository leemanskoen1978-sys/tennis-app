---
phase: 05-excel-import-van-trainingen
plan: 08
subsystem: de uitvoerder — van goedgekeurd plan naar rijen, en van rijen naar één opslag
tags: [import, trainingen, wegschrijven, IMP-09, veilig-opnieuw-draaien, geen-sql]
requires:
  - "lib/import-trainingen.ts: planImportLessen, GroepInPlan, spelerSleutel, nieuwLidUitSpeler, deelnemersVoorLes (plan 05-04 t/m 05-06)"
  - "lib/lesgroepen.ts: lesGroepFout (bestaand, ongewijzigd)"
  - "providers/SimpleDataProvider.tsx: commit, newId (bestaand, ongewijzigd)"
provides:
  - "lib/import-trainingen.ts: ImportWijziging, GroepBijwerking, ImportUitslagLessen"
  - "lib/import-trainingen.ts: bouwImportWijziging(plan, maakId)"
  - "providers/SimpleDataProvider.tsx: importeerTrainingen(plan)"
affects:
  - "lib/sync.ts: de schrijfvolgorde van de tabellen — lesGroepen gaat nu vóór bookings"
tech-stack:
  added: []
  patterns:
    - "de ids komen als parameter binnen, niet uit newId: alleen zo is de uitkomst voorspelbaar en testbaar"
    - "eerst de spelers, dan de groepen, dan de lessen — de volgorde die een halve import herstelbaar houdt"
    - "opbouwen in het geheugen, dan één commit: het patroon van addBookingSeries, niet dat van pasImportToe"
    - "wat verwezen wordt gaat eerst: de tabelvolgorde in lib/sync volgt de foreign keys"
key-files:
  created: []
  modified: [lib/import-trainingen.ts, lib/import-trainingen.test.ts, lib/sync.ts, lib/sync.test.ts, providers/SimpleDataProvider.tsx]
decisions:
  - "IMP-09 is uitgevoerd als 'veilig opnieuw te draaien' en niet als 'één transactie' (D-21); het commentaar in importeerTrainingen zegt met zoveel woorden wat er bij een halve mislukking overblijft"
  - "De schrijfbeurt volgt addBookingSeries (één commit), de vorm van een nieuw lid volgt lib/import-leden — precies de afweging uit het blok <spanning> van het plan"
  - "bouwImportWijziging heeft geen lijst met te verwijderen boekingen, en dat is de afspraak: een verdwenen les is een melding, nooit een opdracht"
  - "Er staat geen created_at op een nieuwe lesgroep: het veld is optioneel en een klok zou dezelfde invoer twee verschillende uitkomsten geven"
  - "IMP-09 blijft Pending in REQUIREMENTS.md: de belofte is pas heel als het scherm haar in die woorden uitspreekt (plan 05-09). Dezelfde lijn als 05-04 t/m 05-07"
metrics:
  duration: ~50 min
  completed: 2026-09-06
  tasks: 2
  tests_before: 1441
  tests_after: 1458
---

# Phase 5 Plan 08: De uitvoerder — Summary

Het goedgekeurde plan wordt omgezet in de exacte rijen die weggeschreven worden, en die rijen
gaan in één opslag de databank in. Er wordt niets opnieuw uitgerekend, er wordt niets verwijderd,
en er wordt geen trainer en geen baan aangemaakt.

## Wat er gebouwd is

**`lib/import-trainingen.ts` (1636 → 1841 regels), nog steeds puur en synchroon**

| Blok | Wat het doet |
|---|---|
| `ImportWijziging` | Vier lijsten rijen — `nieuweUsers`, `nieuweGroepen`, `gewijzigdeGroepen`, `nieuweBoekingen` — plus `fouten`. Géén lijst met te verwijderen boekingen |
| `GroepBijwerking` | Eén bestaande groep met alleen de velden die echt veranderen, plus haar nieuwe rooster |
| `ImportUitslagLessen` | Wat de import opleverde: vier aantallen en wat er niet doorging |
| `bouwImportWijziging(plan, maakId)` | Spelers → groepen → lessen, met ids die als parameter binnenkomen |

**`providers/SimpleDataProvider.tsx`** — `importeerTrainingen(plan)`: één `bouwImportWijziging`,
één `await commit(...)`, één uitslag terug.

**`lib/import-trainingen.test.ts` (1873 → 2113 regels)** — twaalf nieuwe tests, geen `jest.mock`,
geen `jest.fn`.

## De vier dingen die precies goed moesten

**1. "Veilig opnieuw te draaien", eerlijk gezegd.** Er is geen kruistabel-transactie in deze app
en die kan er niet komen zonder SQL te draaien, wat deze module niet doet. `commit` zet de lokale
opslag terug en gooit de fout door, maar `saveToSupabase` schrijft tabel voor tabel: breekt het
tussen twee tabellen af, dan kunnen er leerlingen zonder groep achterblijven, of een groep zonder
haar lessen. Het commentaarblok bij `importeerTrainingen` zegt dat in drie delen — waarom één
commit, wat er bij een mislukking overblijft, en waarom dat aanvaardbaar is — en verwijst naar
plan 05-09 voor wat het scherm de beheerder in diezelfde woorden moet vertellen. Er wordt nergens
atomiciteit beloofd.

Waarom opnieuw inlezen het afmaakt: elke leerling wordt op zijn genormaliseerde naam herkend,
elke groep op `Groep-ID` of op `naam|weekdag|beginuur`, en elke les op groep + dag + beginuur.
Niets wordt blind toegevoegd. De test `schrijft niets weg voor een groep die niet verandert`
leest hetzelfde bestand een tweede keer tegen de toestand die het zelf opleverde: nul spelers,
nul groepen, nul patches, nul lessen, nul fouten.

**2. Eén opslag, geen commit per rij.** `koen.xlsx` levert 42 leerlingen, tien groepen en 325
lessen op. Een lus met `addUser`/`addLesGroep` per rij — de vorm van `pasImportToe` in de
ledenimport — zou 377 opslagbeurten zijn, elk met een volledige vergelijking van de hele opslag
en een ronde naar Supabase, en ze kan op rij 200 stranden. De *regels* van `lib/import-leden.ts`
worden hergebruikt (`nieuwLidUitSpeler`: naam, adres, rol, geen sleutel met `undefined` erin), de
*schrijfbeurt* volgt `addBookingSeries`. Dat is letterlijk de afweging uit het blok `<spanning>`
van het plan, en ze staat als commentaar in de provider.

**3. De droogloop beslist, de uitvoerder voert uit.** `bouwImportWijziging` roept
`planImportLessen` niet aan, kent geen ledenlijst, geen banenlijst en geen boekingen. Het krijgt
het plan dat de beheerder zag en zet dat om. Zet een test `groepenNieuw[0].baan` op `null`, dan
verdwijnen de lessen van die groep — de uitvoerder gaat niet zelf op zoek naar een baan.

**4. Nooit iets weg.** Er is geen `verwijderdeBoekingen` en er komt er geen. Een les die uit het
bestand verdween staat in `plan.verdwenenUitBestand` als melding; de uitvoerder noemt haar niet
eens. Een aparte test legt dat vast.

## De volgorde, en waarom ze de kern van IMP-09 is

Spelers, dan groepen, dan lessen. Dat moet technisch — een rooster verwijst naar spelers, een les
naar allebei — maar het is vooral de volgorde waarin een afgebroken import het minst schadelijk
achterblijft:

| Wat er achterblijft | Hoe erg | Wat een tweede inleesbeurt doet |
|---|---|---|
| Een speler zonder groep | Onschadelijk; hij staat in de ledenlijst | Herkent hem op naam en maakt hem niet nog eens |
| Een groep zonder lessen | Zichtbaar in het lesgroepenscherm | Herkent haar op sleutel of `Groep-ID` en plant haar lessen alsnog |
| Een les met een id dat nergens bij hoort | Niet met opnieuw inlezen recht te zetten | — en dáárom komen de lessen laatst |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blokkerend] De lessen werden vóór hun eigen lesgroep weggeschreven**

- **Found during:** taak 2, bij het nalezen van de schrijfweg (`lib/sync.ts` → `saveToSupabase`).
- **Issue:** `bookings.group_id` verwijst in `supabase-schema.sql` (regel 930) naar
  `lesson_groups(id)`, maar `diffStores` gaf de tabellen terug in de volgorde `users, courts,
  bookings, …, lesGroepen`. `saveToSupabase` loopt die lijst letterlijk af. Een nieuwe groep mét
  haar lessen in één opslag — precies wat dit plan bouwt — zou de boekingenrijen laten weigeren
  op een verwijzing naar een groep die nog niet bestond. De hele import zou op zijn eerste nieuwe
  groep stuklopen. Dit viel niet eerder op omdat geen enkele bestaande actie een groep en een les
  tegelijk aanmaakt: `addLesGroep` commit alleen de groep, `updateLesGroep` raakt alleen
  bestaande.
- **Fix:** `lesGroepen` staat in `diffStores` nu tussen `courts` en `bookings`, met een
  commentaar dat de regel benoemt: wat verwezen wordt, gaat eerst. `lesson_groups` verwijst zelf
  naar `users` en `courts`, en die staan nog steeds eerder. Plus een test die de volgorde
  vastlegt.
- **Files modified:** `lib/sync.ts`, `lib/sync.test.ts`
- **Commit:** 7fcdad2

**2. [Rule 1 - Bug] Twee commentaren braken hun eigen acceptatiecriterium**

- **Found during:** taak 1.
- **Issue:** het doc-commentaar bij `bouwImportWijziging` schreef "zonder één `await`" en noemde
  `newId` bij naam om uit te leggen waar de ids vandaan komen. De acceptatiecriteria tellen die
  woorden in het hele bestand: `grep -c 'await'` gaf `1` en `grep -c 'newId'` gaf `1` in plaats
  van `0`. Exact dezelfde valkuil als `planSeries` in plan 05-06 en `Date.UTC` in 05-05.
- **Fix:** dezelfde waarschuwing zonder de woorden die de controle in de war sturen — "zonder een
  enkele belofte om op te wachten" en "de provider geeft er zijn eigen idmaker in". Dat laatste
  is bovendien juister: `lib/` mag niets uit `providers/` kennen, ook niet bij naam.
- **Files modified:** `lib/import-trainingen.ts`
- **Commit:** 168cb58

**3. [Rule 1 - Bug] Een eigen testverwachting klopte niet**

- **Found during:** taak 1, GREEN-fase.
- **Issue:** de test over een verdwenen les verwachtte nul nieuwe boekingen, terwijl het bestand
  twee lessen bevat die de club nog niet had. De verwachting, niet de code, was fout.
- **Fix:** de test bewijst nu wat ze bedoelde: de twee lessen uit het bestand komen erbij, en
  `b-weg` wordt nergens genoemd — ook niet om hem weg te halen.
- **Files modified:** `lib/import-trainingen.test.ts`
- **Commit:** 168cb58

### Eén acceptatiecriterium is onhaalbaar zoals het geschreven staat

Taak 2 vraagt: `grep -c 'bouwImportWijziging' providers/SimpleDataProvider.tsx` geeft `1`.
`grep -c` telt regels, en een benoemde import plus een aanroep zijn altijd minstens twee regels.
Het is `2` (de `import`-regel en de aanroep), en de aanroep zelf komt precies één keer voor:
`grep -c 'bouwImportWijziging('` geeft `1` — dat is ook het patroon dat `key_links` in de
frontmatter van het plan controleert (`bouwImportWijziging\(`). De bedoeling — de provider rekent
op één plek en rekent verder niets uit — is dus gehaald; het getal `1` is dat niet en kan dat niet
zijn. Het overtollige commentaar dat de naam nog een derde keer noemde is wél weggehaald.

### Bewust niet gedaan

**IMP-09 blijft Pending in REQUIREMENTS.md.** Het wegschrijven staat er en is te testen, maar de
eis is pas heel als de beheerder op het scherm leest wat er gebeurt als het misgaat en waarom
opnieuw inlezen het rechtzet — dat is uitdrukkelijk onderdeel van D-21 en het staat op plan
05-09. Dezelfde lijn als 05-04 t/m 05-07.

## Een gevolg dat plan 05-09 en 05-10 moeten kennen

**Een groep zonder gekoppelde trainer wordt niet weggeschreven.** Het plan draagt uitdrukkelijk
op `lesGroepFout` aan te roepen vóór een groep in de lijst komt, "dezelfde controle die
`addLesGroep` doet". Die controle eist een `coach_id` (`lib/lesgroepen.ts`, regel 59). `koen.xlsx`
heeft een trainer die nog geen account heeft, dus vandaag zou een import van dat bestand tien
fouten opleveren en nul groepen — met per groep de melding *"Ik kan de lesgroep Groep 8 niet
aanmaken: Kies een trainer voor de lesgroep. Haar lessen gaan dus ook niet door."*

Dat is de juiste uitkomst en geen tekortkoming: zonder trainer worden haar lessen toch niet
ingepland (`Booking.coach_id` is verplicht), en een groep aanmaken die het lesgroepenscherm zelf
zou weigeren is erger dan haar te weigeren. Maar het is wél een verschil met wat de droogloop
toont: die telt tien nieuwe groepen. **Plan 05-09 moet die tien fouten naast die tien groepen
laten zien**, zodat een beheerder niet op "Toepassen" drukt in de veronderstelling dat er tien
groepen komen. En de weg eruit is één handeling: geef `Leemans Koen` een traineraccount, dan
verdwijnen deze tien meldingen tegelijk met de tien over de trainer uit 05-07. `ImportUitslagLessen.fouten`
draagt precies die zinnen, met regelnummer, klaar voor het scherm.

## Het schema: er is niets veranderd, en er hoefde niets te veranderen

`git diff supabase-schema.sql` is leeg. Met de hand nagelopen:

| Tabel | Bestaat | Kolommen die dit plan schrijft | Policy |
|---|---|---|---|
| `users` | ja (regel ~30) | `id`, `name`, `email`, `role` | `users_insert`: `is_coach() or is_admin() or auth_id = auth.uid()` |
| `lesson_groups` | ja (regel 914) | `name`, `level`, `weekday`, `start_hour`, `start_minute`, `coach_id`, `court_id`, `season_start`, `season_end`, `roster`, `archived` | `lesson_groups_write` `for all`: `is_admin()` |
| `bookings` | ja (regel 63) | `group_id`, `player_id`, `participant_ids`, `coach_id`, `court_id`, `start_time`, `end_time`, `status`, `payment_method` | `bookings_insert`: `is_admin() or …` |

`created_at` heeft in alle drie een `default now()` en wordt niet meegeschreven. Geen enkele van
de drie policies stelt in de beheerderstak een voorwaarde over de *maker* van de rij, dus de
upsert-val uit `.planning/codebase/CONCERNS.md` speelt hier niet — maar dat blijft een controle
met de hand in plan 05-10, langs de upsert-weg (invoegen als A, bijwerken als B).

**Let op voor plan 05-10:** de migraties voor `lesson_groups` en `sick_leaves` zijn nog steeds
niet gedraaid. Dit plan heeft daar niets aan veranderd en heeft niets uitgevoerd.

## Threat Flags

Geen nieuw aanvalsvlak: geen scherm, geen netwerk erbij, geen tabel erbij, geen SQL, geen
Supabase-verbinding. De vijf dreigingen die dit plan toegewezen kreeg:

| Threat ID | Waar |
|---|---|
| T-05-20 (een niet-beheerder die de import aanroept) | De actie hangt in de provider maar heeft nog geen scherm (05-09, beheerdersscherm); de echte grens is RLS: `lesson_groups_write` is `is_admin()`, en `bookings_insert`/`users_insert` laten een gewone speler geen vreemde rij schrijven. Met de hand na te lopen in 05-10 |
| T-05-21 (de RLS-upsertval) | Geen nieuwe policy en geen schemawijziging in dit plan; de bestaande drie zijn hierboven nagelezen en kennen in de beheerderstak geen makersvoorwaarde |
| T-05-22 (een half doorgevoerde import) | Aanvaard en uitgeschreven, niet weggemoffeld: de schrijfvolgorde staat in `bouwImportWijziging`, het gevolg staat in het commentaar van `importeerTrainingen`, en de test bewijst dat opnieuw inlezen niets verdubbelt |
| T-05-23 (de dev-server praat met de echte Supabase) | Er is geen server gedraaid: alleen `tsc`, `jest` en de webbuild |
| T-05-SC (npm-installs) | Niets geïnstalleerd; `git diff --stat package.json package-lock.json` is leeg |

## Known Stubs

Geen. Wat dit plan niet doet, doet het met opzet niet: er is nog geen scherm dat
`importeerTrainingen` aanroept (plan 05-09) en er is nog niets tegen een echte databank gedraaid
(plan 05-10).

## Deferred Issues

- De hernoemingsbevinding van 05-07 is in `31967eb` opgelost en staat niet meer open.
- `lib/goals.test.ts` → `newGoalId does not hand out the same id twice` bleef in deze run groen;
  het staat sinds 05-06 als los genoteerd punt in `deferred-items.md` en is niet aangeraakt.

## Verification

```
npx tsc --noEmit                → nul fouten
npx jest lib/import-trainingen  → 170 passed (was 154)
npx jest lib/sync               → 25 passed (was 24)
npm test                        → 52 suites, 1458 tests passed (was 1441)
npx expo export --platform web  → gelukt (entry-bundle 3,83 MB)
git diff --stat package.json package-lock.json → leeg
git diff supabase-schema.sql | grep -c '^-'    → 0 (het bestand is niet aangeraakt)
```

Acceptatiecriteria per taak:

```
taak 1  — alle gehaald
  npx jest lib/import-trainingen                       → 170 passed
  grep -c 'export function bouwImportWijziging'        → 1
  grep -c 'await'                    (lib/import-trainingen.ts) → 0
  grep -c 'lesGroepFout'                               → 4   (≥ 1)
  grep -c 'GROEPSLES_METHOD'                           → 3   (≥ 1)
  grep -c 'newId'                                      → 0
  grep -v '^\s*[/*]' | grep -c "from '\.\./"           → 0
  npx tsc --noEmit                                     → nul fouten

taak 2  — één criterium onhaalbaar zoals geschreven, zie hierboven
  grep -c 'importeerTrainingen'   (provider)           → 4   (≥ 3)
  grep -c 'bouwImportWijziging'   (provider)           → 2   (gevraagd: 1 — zie hierboven)
  grep -c 'bouwImportWijziging('  (provider)           → 1   (de aanroep, één keer)
  awk-bereik importeerTrainingen | grep -c 'await commit('              → 1
  awk-bereik importeerTrainingen | grep -c 'addUser(|addLesGroep(|addBooking(' → 0
  git diff supabase-schema.sql | grep -c '^-'          → 0
  geen .env-wijziging, geen script dat verbindt uitgevoerd
  npx tsc --noEmit / npm test / webbuild               → alle drie geslaagd
```

## Self-Check: PASSED

- `lib/import-trainingen.ts` — FOUND (`bouwImportWijziging`, `ImportWijziging`, `ImportUitslagLessen`)
- `providers/SimpleDataProvider.tsx` — FOUND (`importeerTrainingen`)
- f818c02 `test(import-trainingen): het plan als concrete rijen, met ids die de test kan voorspellen` — FOUND
- 168cb58 `feat(import-trainingen): het goedgekeurde plan als de rijen die weggeschreven worden` — FOUND
- 7fcdad2 `fix(opslaan): een lesgroep gaat de databank in vóór de lessen die eraan hangen` — FOUND
- dba208a `feat(import-trainingen): een heel seizoen trainingen in één opslag` — FOUND
