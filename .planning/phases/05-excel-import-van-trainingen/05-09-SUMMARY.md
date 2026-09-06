---
phase: 05-excel-import-van-trainingen
plan: 09
subsystem: het scherm — de droogloop leesbaar, de bevestiging uitdrukkelijk, de mislukking eerlijk
tags: [import, trainingen, scherm, droogloop, IMP-01, IMP-02, IMP-09, veilig-opnieuw-draaien]
requires:
  - "lib/import-trainingen.ts: planImportLessen, bestandAfgekeurdLessen, kiesLessenBlad, voorbeeldTrainingenXlsx (plan 05-04 t/m 05-07)"
  - "providers/SimpleDataProvider.tsx: importeerTrainingen (plan 05-08)"
  - "lib/bestand.ts: kanBestandKiezen, kiesBinairBestand; lib/share.ts: xlsxWordtOndersteund, shareXlsx"
  - "lib/xlsx-lezen.ts: leesWerkmap; lib/rechten.ts: isAdmin; lib/slots.ts: DAY_LABELS"
provides:
  - "app/admin/trainingen-import.tsx: het importscherm"
  - "lib/import-trainingen.ts: geweigerdeNieuweGroepen(plan), overgeslagenPerReden(plan)"
affects:
  - "lib/import-trainingen.ts: bouwImportWijziging gebruikt nu geweigerdeNieuweGroepen in plaats van zijn eigen lus"
tech-stack:
  added: []
  patterns:
    - "de beheerdersgrens vóór elke hook, met de rest in een eigen component — het patroon van app/admin/export.tsx"
    - "moduleniveau-toestand die een her-mount overleeft, nu ook voor een mislukking"
    - "het scherm rekent niets uit: elke telling en elke controle komt uit lib"
key-files:
  created: [app/admin/trainingen-import.tsx]
  modified: [lib/import-trainingen.ts, lib/import-trainingen.test.ts, lib/i18n-en.ts, app/admin/index.tsx, app/_layout.tsx]
decisions:
  - "De tien lesgroepen die lesGroepFout weigert staan in de droogloop, náást de aantallen, en niet pas in de uitslag: `geweigerdeNieuweGroepen` is daarvoor uit `bouwImportWijziging` gelicht zodat beide dezelfde zinnen gebruiken"
  - "De bevestiging is een eigen stap (Importeren → Zeker weten? → Ja, nu importeren) en geen enkele knop, want dit schrijft in één beurt tientallen spelers, tien groepen en honderden lessen weg"
  - "Er staat 'veilig opnieuw te draaien' op het scherm en nergens 'atomisch' of 'in één transactie' (D-21)"
  - "Geen plakvak-terugval op een telefoon, maar een uitleg: een xlsx valt niet te plakken"
  - "IMP-01, IMP-02 en IMP-09 blijven Pending in REQUIREMENTS.md tot het handmatige nalopen (taak 3) gebeurd is"
metrics:
  duration: ~55 min
  completed: 2026-09-06
  tasks: 2 van 3 (taak 3 is een checkpoint voor de gebruiker)
  tests_before: 1458
  tests_after: 1463
---

# Phase 5 Plan 09: Het importscherm — Summary

Een beheerder kiest een Excel-bestand met een heel seizoen erin, leest in groepen en aantallen
wat ermee gaat gebeuren, zegt uitdrukkelijk ja, en ziet daarna wat er gebeurd is. Er wordt niets
weggeschreven vóór dat ja, en het scherm zegt in gewone taal wat een halve mislukking betekent.

## Wat er gebouwd is

**`app/admin/trainingen-import.tsx` (nieuw, 573 regels)**

| Blok | Wat het doet |
|---|---|
| Moduleniveau-toestand | `importDraait`, `laatsteUitslag`, `laatsteMislukking` en een luisteraarslijst — overleeft een her-mount, zodat wegnavigeren tijdens het wegschrijven geen tweede beurt over hetzelfde bestand oplevert |
| De beheerdersgrens | `isAdmin(currentUser)` vóór elke hook van het scherm; de rest zit in `ImportInhoud` |
| Sjabloon | `voorbeeldTrainingenXlsx()` door `shareXlsx`, verborgen als `xlsxWordtOndersteund` onwaar is |
| Bestandskeuze | `kiesBinairBestand()` → `leesWerkmap` → `kiesLessenBlad` → `planImportLessen`; zonder bestandskiezer een uitleg in plaats van een knop |
| `PlanInBeeld` | De droogloop in de volgorde van `.planning/IMPORT-SJABLOON.md`, en de knoppen |

**`lib/import-trainingen.ts` (1841 → 1908 regels), nog steeds puur en synchroon**

| Nieuw | Wat het doet |
|---|---|
| `geweigerdeNieuweGroepen(plan)` | De nieuwe lesgroepen die `lesGroepFout` weigert, met de zin erbij — vóór er iets weggeschreven is |
| `overgeslagenPerReden(plan)` | De overgeslagen lessen geteld als `{ vakantie, bezet, verleden }` |

`bouwImportWijziging` gebruikt `geweigerdeNieuweGroepen` nu zelf in plaats van zijn eigen lus.
Vijf nieuwe tests, waaronder één die de twee lijsten zinnen letterlijk gelijk houdt.

**`lib/i18n-en.ts` (+99 regels)** — een Engelse tegenhanger voor elke nieuwe schermzin, plus voor
de achttien meldingen die uit `lib/import-trainingen.ts` komen en hier voor het eerst op een
scherm belanden.

**`app/admin/index.tsx`** — de tegel "Trainingen importeren · Een seizoen uit Excel" (`FileUp`),
naast de export en net als die alleen voor een beheerder. **`app/_layout.tsx`** — de route met
haar kop.

## De droogloop, in de volgorde die is afgesproken

1. de aantallen: nieuwe / bijgewerkte / ongewijzigde lesgroepen, nieuwe spelers, ingeplande
   lessen, lessen die al goed staan, en hoeveel er in een clubvakantie vallen, botsen met een
   bezette trainer of baan, of al geweest zijn;
2. **de lesgroepen die niet aangemaakt worden** — zie hieronder;
3. per groep: naam · dag · uur · trainer · aantal spelers, in drie kaarten (nieuw, bijgewerkt,
   ongewijzigd);
4. de nieuwe spelers, met hun namen op één regel;
5. wat met de hand verzet of afgezegd is, met de dag en beide tijden — het lijstje waarover de
   beheerder beslist (IMP-08); het bestand overrulet dat nooit;
6. lessen die wel in de app staan maar niet meer in het bestand, met erbij dat ze blijven staan;
7. de waarschuwingen en de fouten, met regelnummer en reden.

Nergens 1398 regels. Elke reden loopt door `t(reden, vars)`: de zinnen uit `lib/` dragen
`{plaatshouders}` en worden hier pas ingevuld.

## Het ding dat 05-08 aan dit plan doorgaf, en wat ermee gedaan is

Plan 05-08 eindigde met een gevolg: `lesGroepFout` eist een `coach_id`, `koen.xlsx` heeft een
trainer zonder account, dus een import van dat bestand levert vandaag **tien fouten en nul
groepen** op — terwijl de droogloop tien nieuwe groepen telt.

Die tien fouten stonden alleen in `bouwImportWijziging`, dus pas ná het wegschrijven. Dat is
precies de val die de hele fase probeert te vermijden: "tien nieuwe lesgroepen" lezen, op
Importeren drukken, en er nul krijgen.

Wat er gedaan is: de controle is uit `bouwImportWijziging` gelicht naar
`geweigerdeNieuweGroepen(plan)`, en `bouwImportWijziging` roept die nu zelf aan. Eén bron, dus
wat de beheerder leest is letterlijk wat de uitvoerder straks weigert — een test legt dat vast
(`zegt hetzelfde als wat de uitvoerder straks weigert`). Het scherm zet die zinnen in een rode
kaart **meteen onder de aantallen**, met als kop *"Deze lesgroepen worden niet aangemaakt"*, als
eerste regel *"10 van de nieuwe lesgroepen hierboven komen er nu niet, en hun lessen dus ook
niet."*, daaronder per groep *"Regel 2: Ik kan de lesgroep Groep 8 niet aanmaken: Kies een
trainer voor de lesgroep. Haar lessen gaan dus ook niet door."*, en als slot de weg eruit:

> Ontbreekt de trainer? Geef hem eerst een traineraccount in Beheer en kies daarna hetzelfde
> bestand opnieuw; dan komen deze groepen er alsnog bij.

Dat is één handeling — `Leemans Koen` een traineraccount geven — en ze laat deze tien meldingen
tegelijk met de tien over de ontbrekende trainer uit 05-07 verdwijnen.

## "Veilig opnieuw te draaien", niet "atomisch"

Onder de knop Importeren, vóór het bevestigen, staat één alinea:

> Eerst gaan de spelers weg, dan de lesgroepen, dan de lessen. Gaat er onderweg iets mis, dan
> blijft staan wat er al stond en komt er niets dubbel bij: hetzelfde bestand nog een keer
> inlezen maakt het af. Het is dus veilig om opnieuw te draaien, maar het is geen import die
> zichzelf in één keer terugdraait.

Het woord "transactie" komt er niet in voor en "atomisch" evenmin — die belofte kan deze app niet
nakomen (D-21, en het commentaarblok bij `importeerTrainingen` uit 05-08). Mislukt het
wegschrijven echt, dan zegt het scherm *"Het wegschrijven is halverwege misgegaan"*, herhaalt het
dat wat er al stond blijft staan, en biedt het **Opnieuw proberen**: dat rekent het plan opnieuw
uit uit dezelfde bytes tegen de intussen bijgewerkte lijsten, en toont dus wat er nog openstaat.

## De vier dingen die precies goed moesten

**1. Het scherm rekent niets uit.** `grep -cE '\.filter\(|\.reduce\(|groepSleutel|botstMet|vakantieOp'`
geeft `0`. Daarvoor moest `overgeslagenPerReden` erbij: de droogloop hoort te tonen hoeveel lessen
er in een vakantie vallen en hoeveel er botsen, en een scherm dat dat zelf telt komt vroeg of laat
op een ander getal uit dan de uitvoerder.

**2. De grens vóór elke andere return.** `isAdmin` staat in de default-export, boven alles; de
hooks zitten in `ImportInhoud`. Het patroon van `app/admin/export.tsx`, en dat moest hier ook —
`leden-import.tsx` zet zijn grens ná zijn hooks en die volgorde is precies wat het plan niet vroeg.
De grens is de beleefde; de echte staat in `lesson_groups_write` (`is_admin()`).

**3. Twee keer ja.** "Importeren" opent "Zeker weten?" met "Ja, nu importeren" en "Nee, toch
niet". De knop staat uit zolang er niets nieuws in het plan zit. Erboven de herinnering over
"Confirm email" in Supabase, dezelfde operationele afspraak als bij de ledenimport
(`.planning/codebase/CONCERNS.md`) en hier zwaarder, want dit maakt in één beurt tientallen
spelersaccounts aan.

**4. Geen plakvak op een telefoon.** De ledenimport heeft er een; hier kan dat niet, want een xlsx
is een zip vol bytes en geen tekst. Het scherm zegt dat, met de reden er als commentaar naast.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Ontbrekende noodzaak] De droogloop kon de geweigerde lesgroepen niet tonen**

- **Found during:** taak 1, bij het nalezen van het gevolg dat 05-08 doorgaf.
- **Issue:** de tien fouten van `lesGroepFout` bestonden alleen binnen `bouwImportWijziging` en
  kwamen dus pas ná het wegschrijven in beeld. Het scherm zou "tien nieuwe lesgroepen" tonen en
  er nul opleveren.
- **Fix:** `geweigerdeNieuweGroepen(plan)` toegevoegd aan `lib/import-trainingen.ts`;
  `bouwImportWijziging` gebruikt haar nu, zodat er één bron is. Drie tests erbij.
- **Files modified:** `lib/import-trainingen.ts`, `lib/import-trainingen.test.ts`
- **Commit:** cb9e043

**2. [Rule 3 - Blokkerend] De droogloop vroeg om tellingen die het scherm niet mag maken**

- **Found during:** taak 1.
- **Issue:** `.planning/IMPORT-SJABLOON.md` vraagt "hoeveel er in een clubvakantie vallen, hoeveel
  er botsen". `ImportPlanLessen.overgeslagen` is een lijst met redenen, geen telling — en het
  acceptatiecriterium verbiedt `.filter(` en `.reduce(` op het scherm, terecht.
- **Fix:** `overgeslagenPerReden(plan)` in `lib/import-trainingen.ts`, met twee tests.
- **Files modified:** `lib/import-trainingen.ts`, `lib/import-trainingen.test.ts`
- **Commit:** eb3dcbb

### Buiten de opgegeven bestandenlijst

De frontmatter noemt vier bestanden; er zijn er zes aangeraakt. `lib/import-trainingen.ts` en
`lib/import-trainingen.test.ts` staan er niet bij, en dat kon ook niet anders: de twee functies
hierboven horen in `lib` en niet op het scherm — dat is de regel waar de rest van deze fase op
gebouwd is.

### Verder dan gevraagd: de meldingen uit `lib` hebben nu ook Engels

De acceptatiecontrole kijkt alleen naar de `t('...')`-teksten in het scherm zelf. De achttien
meldingen uit `lib/import-trainingen.ts` (ontbrekende trainer, onleesbare datum, twee naamgenoten
…) hadden nog geen Engelse tegenhanger, en ze komen op dít scherm voor het eerst in beeld. Een
beheerder die de app op Engels heeft staan zou anders een Engels scherm met Nederlandse
foutmeldingen krijgen. Ze staan er nu bij.

### Bewust niet gedaan

**IMP-01, IMP-02 en IMP-09 blijven Pending in REQUIREMENTS.md.** Taak 3 is een
`checkpoint:human-verify` met `gate="blocking"` en die is niet gedaan — hij kán niet door mij
gedaan worden, want hij vraagt om een draaiende dev-server met de omgeving uitgezet. Een eis
afvinken op grond van een build die slaagt zou precies de belofte breken die deze fase maakt.
Dezelfde lijn als 05-04 t/m 05-08.

**Geen SQL, geen Supabase.** Er is geen server gedraaid, geen `.env` aangeraakt en geen script dat
verbindt uitgevoerd. Alleen `tsc`, `jest` en de webbuild.

## Wat er met de hand nagelopen moet worden (taak 3)

Zie het plan voor de negen stappen. Twee dingen die daar staan kloppen vandaag níet, en dat is
geen fout van het scherm maar het gevolg dat 05-08 aankondigde:

- **Stap 5** verwacht "nul ingeplande lessen, met als enige melding dat de trainer en de baan
  gekoppeld moeten worden". Er staat een melding méér, en die hoort er te staan: tien keer *"Ik
  kan de lesgroep … niet aanmaken: Kies een trainer voor de lesgroep."*
- **Stap 7 en 8** verwachten tien groepen in Beheer → Lesgroepen en daarna een lege droogloop.
  Zolang `Leemans Koen` geen traineraccount heeft, komen er nul groepen en blijft de tweede
  droogloop hetzelfde tonen als de eerste. Geef die trainer eerst een account, doe dan stap 5 tot
  en met 8 opnieuw; dan klopt het wél.

## Threat Flags

Geen nieuw aanvalsvlak buiten het scherm zelf: geen tabel erbij, geen policy erbij, geen SQL, geen
netwerkoproep die er niet al was.

| Threat ID | Waar |
|---|---|
| T-05-24 (een trainer die het importscherm opent) | `isAdmin` in de default-export, vóór elke hook en vóór elke andere return; de tegel in Beheer staat ook alleen voor een beheerder. RLS blijft de echte bewaker (`lesson_groups_write` is `is_admin()`) |
| T-05-25 (claimbare spelersrijen) | De herinnering over "Confirm email" staat boven de importknop, in beeld vóór het bevestigen |
| T-05-26 (twee keer drukken, of wegnavigeren) | `importDraait` staat op moduleniveau en `voerUit` keert er meteen op terug; de bevestigingsstap zit er bovendien tussen |
| T-05-27 (de dev-server praat met de echte Supabase) | Er is geen server gedraaid; het nalopen met de omgeving uit staat als taak 3 klaar voor de gebruiker |
| T-05-SC (npm-installs) | Niets geïnstalleerd; `git diff --stat package.json package-lock.json` is leeg |

## Known Stubs

Geen. Elk getal op het scherm komt uit het plan, elke lijst uit `lib`, en er is geen kaart die op
een lege plaatshouder wacht.

## Verification

```
npx tsc --noEmit                                → nul fouten
npm test                                        → 52 suites, 1463 tests passed (was 1458)
npx expo export --platform web                  → gelukt (entry-bundle 3,84 MB)
git diff --stat package.json package-lock.json  → leeg
```

Acceptatiecriteria per taak:

```
taak 1 — alle gehaald
  grep -c 'planImportLessen'          (scherm) → 2   (≥ 1)
  grep -c 'kiesBinairBestand'         (scherm) → 2   (≥ 1)
  grep -c 'isAdmin'                   (scherm) → 2   (≥ 1)
  grep -c 'importDraait\|laatsteUitslag'       → 9   (≥ 2)
  grep -c 'voorbeeldTrainingenXlsx'   (scherm) → 2   (≥ 1)
  grep -cE '\.filter\(|\.reduce\(|groepSleutel|botstMet|vakantieOp' → 0

taak 2 — alle gehaald
  grep -c 'importeerTrainingen'       (scherm) → 2   (≥ 1)
  grep -c 'trainingen-import'  (admin/index)   → 1   (≥ 1)
  grep -c 'trainingen-import'  (_layout)       → 1   (≥ 1)
  grep -c 'Trainingen importeren' (i18n-en)    → 2   (≥ 1)
  de Engelse-tegenhangercontrole uit het plan  → geen uitvoer
  grep -ci 'opnieuw'                  (scherm) → 19  (≥ 1)
  grep -ci 'confirm email'            (scherm) → 1   (≥ 1)

taak 3 — checkpoint, ligt bij de gebruiker
```

## Self-Check: PASSED

- `app/admin/trainingen-import.tsx` — FOUND (`planImportLessen`, `importeerTrainingen`)
- `lib/import-trainingen.ts` — FOUND (`geweigerdeNieuweGroepen`, `overgeslagenPerReden`)
- `lib/i18n-en.ts` — FOUND (`'Trainingen importeren'`)
- `app/admin/index.tsx`, `app/_layout.tsx` — FOUND (`trainingen-import`)
- cb9e043 `feat(import-trainingen): de droogloop weet welke lesgroepen geweigerd worden` — FOUND
- eb3dcbb `feat(import-trainingen): de overgeslagen lessen geteld per reden` — FOUND
- 4076c6f `feat(trainingen-import): zie een heel seizoen vóór er iets weggeschreven wordt` — FOUND
- 7345a24 `feat(trainingen-import): pas na een uitdrukkelijk ja, en eerlijk over wat een halve mislukking betekent` — FOUND
