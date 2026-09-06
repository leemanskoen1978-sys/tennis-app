# Roadmap: Tennisschool-module

## Overview

Zes hypothesen uit PROJECT.md worden vijf fasen. Lesgroepen komen eerst — alles (vervanging,
import, export) verwijst ernaar. Daarna, klein en apart, "wie gaf de les écht": de kleinste
wijziging met de grootste correctheids-impact, en een harde voorwaarde vóór er een
vervangerswerklijst of -voorstel op gebouwd wordt. Dan de ziekmelding met werklijst en
vervangersvoorstel — dat is de Core Value zelf. Export volgt, met een groepskenmerk dat een
latere herimport laat herkennen. Import komt laatst, omdat hij zowel lesgroepen als het
exportformaat (voor het groepskenmerk) nodig heeft.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Lesgroepen** - Een lesgroep is een blijvend gegeven met eigen roster, zichtbaar in Beheer, dat vooruit wijzigt zonder de geschiedenis te raken.
- [ ] **Phase 2: Wie gaf de les écht** - Elke les kan een vervanger vastleggen naast de vaste trainer, en loon/rapport rekenen daarmee.
- [ ] **Phase 2.1: De groep verzetten werkt door** (INSERTED) - Uur, dag, trainer of baan van een groep verzetten werkt door in alle komende lessen, met de botsingen gemeld.
- [ ] **Phase 3: Ziekmelding en vervangerswerklijst** - Eén werklijst per ziekmelding, met een vervangersvoorstel dat alleen écht beschikbare collega's toont.
- [ ] **Phase 4: Excel-export** - Eén export per periode met vier bladen, inclusief het groepskenmerk dat een latere herimport nodig heeft.
- [ ] **Phase 5: Excel-import van trainingen**
- [ ] **Phase 5.1: De groepssleutel zonder groepsnaam** (INSERTED) - Een lesgroep wordt herkend aan haar moment en terrein, niet aan een nummer uit een ander systeem. - Een seizoen in één keer inladen met droogloop, en herimporteren zonder te verdubbelen.

## Phase Details

### Phase 1: Lesgroepen
**Mode:** mvp
**Goal**: De beheerder beheert lesgroepen als eigen, blijvend gegeven — los van individuele lessen — bereikbaar vanuit Beheer en enkel zichtbaar voor de beheerder.
**Depends on**: Nothing (first phase)
**Requirements**: GROEP-01, GROEP-02, GROEP-03, GROEP-04, GROEP-05, GROEP-06, GROEP-07, TOEG-01, TOEG-02, TOEG-03
**Success Criteria** (what must be TRUE):
  1. De beheerder maakt een lesgroep aan met naam, niveau, vaste dag/uur, vaste trainer, baan en seizoensperiode, en voegt er spelers aan toe of haalt ze eruit (GROEP-01, GROEP-02).
  2. De beheerder ziet per lesgroep welke lessen ervan gepland staan en hoeveel er nog komen; elke zo ontstane les blijft een gewone boeking, te verzetten/af te zeggen/af te vinken als elke andere (GROEP-03, GROEP-04).
  3. Een wijziging aan de groep (speler, uur, trainer) werkt door vanaf vandaag; lessen die al geweest zijn blijven ongewijzigd staan met hun eigen deelnemerslijst van toen (GROEP-05, GROEP-06).
  4. De beheerder archiveert een lesgroep aan het einde van een seizoen zonder de gegeven lessen of hun geschiedenis te raken (GROEP-07).
  5. De tennisschool-module is enkel bereikbaar via Beheer en enkel zichtbaar voor een gebruiker met het beheerdersvinkje (TOEG-01).
  6. `supabase-schema.sql` bevat de nieuwe tabel(len) als `alter table ... if not exists`-blok met bijhorende RLS-policies (TOEG-03); de upsert-val is met de hand nagelopen tegen een echte Supabase-omgeving: invoegen als gebruiker A, bijwerken als gebruiker B slaagt voor een beheerder en faalt voor een niet-beheerder (TOEG-02).
**Plans**: 7 plans in 6 waves

Plans:
- [x] 01-01-PLAN.md — Het groepsmodel als pure regel: LesGroep in lib/types, lib/lesgroepen.ts met zijn test, en regressiedekking dat group_id niets breekt (wave 1)
- [x] 01-02-PLAN.md — Het schema als tekst: lesson_groups, bookings.group_id, index en twee admin-only RLS-policies onderaan supabase-schema.sql (wave 1)
- [x] 01-03-PLAN.md — Beide opslagwegen: lib/sync.ts, mockStore, supabaseStore met selectAllOptioneel, en de vier provideracties (wave 2)
- [x] 01-04-PLAN.md — Het lesgroepenscherm: lijst, aanmaakformulier, de tegel in Beheer en de beheerdersgrens op het scherm zelf (wave 3)
- [x] 01-05-PLAN.md — Groepsdetail: rooster via ParticipantPicker, de lessen van de groep, archiveren (wave 4)
- [x] 01-06-PLAN.md — Een losse les aan een groep hangen op het lesdetailblad, plus de lesduur als clubinstelling (wave 5)
- [ ] 01-07-PLAN.md — De migratie draaien en de upsert-val met de hand nalopen (wave 6, checkpoints)

### Phase 2: Wie gaf de les écht
**Mode:** mvp
**Goal**: Bij elke les is vast te leggen wie hem werkelijk gaf, apart van de vaste trainer, en elke plek die met loon of uren rekent gebruikt die ene waarheid.
**Depends on**: Phase 1
**Requirements**: VERV-01, VERV-02, VERV-03
**Success Criteria** (what must be TRUE):
  1. Bij een les is vast te leggen wie hem werkelijk gaf, zonder de toegewezen trainer te overschrijven (VERV-01).
  2. Loon, urenoverzicht en rapport rekenen overal via één plek in de code met wie de les werkelijk gaf, tegen diens eigen uurtarief — een test bevestigt dat de vaste trainer niet uitbetaald wordt voor een vervangen les en de vervanger wel (VERV-02).
  3. Overal waar een les getoond wordt, is zichtbaar dat er een vervanger stond en wie de vaste trainer was (VERV-03).
  4. De nieuwe kolom (bv. `taught_by_id`) is enkel schrijfbaar voor de beheerder; `bewaak_betaalvelden` en de RLS-policy zijn bijgewerkt en met de hand geverifieerd via de upsert-weg (insert als gebruiker A, update als gebruiker B) tegen een echte Supabase-omgeving.
**Plans**: 4 plans in 3 waves

Plans:
- [x] 02-01-PLAN.md — De ene waarheid: Booking.taught_by_id, lib/lesgever.ts met zijn test, en de vier loonplekken die ermee rekenen (wave 1)
- [x] 02-02-PLAN.md — Het schema als tekst: de kolom, de index, en bewaak_betaalvelden met de beheerdersgrens vóór de trainersuitzondering (wave 1)
- [x] 02-03-PLAN.md — De schrijfweg en de zichtbaarheid: setTaughtBy, de Omit-uitsluiting, beide namen op het detailblad en de markering op de kaart (wave 2)
- [ ] 02-04-PLAN.md — Met de hand nalopen: de migratie draaien, de trigger en de upsert-val, en wat het scherm toont (wave 3, checkpoints)

### Phase 2.1: De groep verzetten werkt door
**Mode:** mvp
**Goal**: Een lesgroep naar een ander uur, een andere dag, een andere trainer of een andere baan verzetten, werkt door in alle lessen van vandaag en later — met de botsingen gemeld in plaats van stil overschreven.
**Depends on**: Phase 2
**Requirements**: GROEP-05
**Inserted**: 2026-09-06, na fase 1. Fase 1 leverde de helft van GROEP-05: een speler erbij of eraf werkt vooruit via `planRosterChange`. Het verzetten van uur, dag, trainer of baan doet dat niet — `updateLesGroep` past alleen de groepsrij aan. Dat is bewust niet ter plekke opgelost: doorwerken raakt de botsingscontrole én de betekenis van `coach_id`, die fase 2 net apart zet van `taught_by_id`. Daarom hier, na fase 2.
**Success Criteria** (what must be TRUE):
  1. Een groep naar een ander uur of een andere dag verzetten, verzet alle lessen van vandaag en later mee; lessen die al geweest zijn blijven staan waar ze stonden.
  2. Een groep aan een andere trainer geven, zet `coach_id` op alle komende lessen — en raakt `taught_by_id` nooit: een les die iemand anders al gaf, blijft van hem.
  3. Lessen die na het verzetten zouden botsen met een bezette trainer of baan worden gemeld vóór er iets vastligt; de beheerder ziet welke en beslist.
  4. Het rekenwerk staat puur in `lib/lesgroepen.ts` met een test ernaast, in dezelfde vorm als `planRosterChange`; het scherm rekent niets uit.
  5. `npx tsc --noEmit`, `npm test` en `npx expo export --platform web` slagen.
**Plans**: 2 plans in 2 waves

Plans:
- [x] 02.1-01-PLAN.md — Het rekenwerk: botstMet gedeeld uit lib/recurrence (trainer én baan), planGroepWijziging naast planRosterChange met zijn test (wave 1)
- [x] 02.1-02-PLAN.md — De schrijfweg en de melding: updateLesGroep verzet de komende lessen mee in één opslag, het scherm toont de gevolgen vóór het bewaren (wave 2, checkpoint)

### Phase 3: Ziekmelding en vervangerswerklijst
**Mode:** mvp
**Goal**: Als een trainer ziek is, ziet de beheerder binnen een minuut welke lessen dat raakt en hangt hij er een vervanger aan die dat uur écht kan.
**Depends on**: Phase 2
**Requirements**: VERV-04, VERV-05, VERV-06, VERV-07, VERV-08, VERV-09, VERV-10
**Success Criteria** (what must be TRUE):
  1. De beheerder meldt een trainer ziek over een periode (van–tot, eventueel met reden), en krijgt daaruit één werklijst met alle geraakte lessen (datum, uur, baan, groep of speler, aantal spelers) — inclusief lessen uit lesgroepen waar die trainer de vaste trainer is (VERV-04, VERV-05).
  2. De beheerder kiest per les in de werklijst: vervanger koppelen, laten staan met markering "zoekt vervanger", of afzeggen — een les zonder vervanger blijft gemarkeerd zichtbaar in de agenda en in de werklijst tot hij is opgelost of afgezegd (VERV-06, VERV-07).
  3. Bij het koppelen van een vervanger toont de app enkel collega's die dat uur werkelijk kunnen: geen eigen les op dat moment, binnen hun boekingstijden, niet in een afwijkende periode, niet in een clubvakantie en zelf niet ziek gemeld; niet-beschikbare trainers zijn opvraagbaar met de reden waarom niet (VERV-08, VERV-09).
  4. Het intrekken van een ziekmelding zet lessen die nog geen vervanger hebben terug naar de vaste trainer (VERV-10).
  5. Het markeren van één losse les uit een reeks met een vervanger raakt de rest van de reeks (`series_id`) niet.
  6. De nieuwe tabel voor ziekmeldingen (en eventuele vervanger-koppeling) staat als `alter table ... if not exists`-blok met admin-only RLS-policies, met de hand geverifieerd via de upsert-weg tegen een echte Supabase-omgeving.
**Plans**: 8 plans in 5 waves
**UI hint**: yes

Plans:
- [x] 03-01-PLAN.md — Eén botsingsregel in plaats van twee: lib/overlap.ts met zijn test, en recurrence + de provider wijzen erheen (wave 1)
- [x] 03-02-PLAN.md — Het hart als pure regel: SickLeave, ziekmeldingFout, lessenVoorZiekmelding en het afgeleide zoektVervanger, met de zomertijd-fixture (wave 1)
- [x] 03-03-PLAN.md — Het schema als tekst: sick_leaves, de index en twee admin-only RLS-policies onderaan supabase-schema.sql (wave 1)
- [x] 03-04-PLAN.md — Het vervangersvoorstel: kanVervangen met alle vijf de redenen, en vervangersVoor die niemand stil weglaat (wave 2)
- [x] 03-05-PLAN.md — De opslagweg: de vier stops plus meldZiek en trekZiekmeldingIn, die geen enkele boeking aanraakt (wave 2)
- [x] 03-06-PLAN.md — Het ziekmeldingsscherm: formulier, lijst, intrekken, de tegel in Beheer en de beheerdersgrens op het scherm zelf (wave 3)
- [x] 03-07-PLAN.md — De werklijst: drie keuzes per les, het voorstel met redenen, en de markering "zoekt vervanger" in de agenda (wave 4)
- [ ] 03-08-PLAN.md — De migratie draaien, de upsert-val nalopen en het fasedoel met de hand bevestigen (wave 5, checkpoints)

### Phase 4: Excel-export
**Mode:** mvp
**Goal**: De beheerder trekt op elk moment een kloppende Excel-export over een periode, met een groepskenmerk dat een latere herimport laat herkennen.
**Depends on**: Phase 3
**Requirements**: EXP-01, EXP-02, EXP-03, EXP-04, EXP-05, EXP-06, EXP-07
**Success Criteria** (what must be TRUE):
  1. De beheerder kiest een periode (van–tot) en krijgt daar één Excel-bestand van met vier bladen (EXP-01).
  2. Blad "Lessen" toont één rij per les met datum, begin-/einduur, baan, toegewezen trainer, wie hem werkelijk gaf, groep of speler, aantal spelers en status (EXP-02).
  3. Blad "Uren per trainer" rekent uren en loon per trainer over de periode op basis van wie de les werkelijk gaf — dezelfde waarheid als het bestaande loonrapport (EXP-03).
  4. Blad "Aanwezigheid" toont per lesgroep de spelers in de rijen en de lesdata in de kolommen, gevuld uit de bestaande aanwezigheidsgegevens en leeg afdrukbaar voor een vervanger zonder app (EXP-04).
  5. Blad "Groepen" toont één rij per lesgroep (naam, niveau, dag/uur, trainer, aantal spelers, aantal ingeplande lessen) met het groepskenmerk `Groep-ID` (EXP-05); blad "Lessen" staat in exact het kolomformaat dat de import leest, inclusief `Groep-ID`, zodat een export ongewijzigd weer ingelezen kan worden zonder te verdubbelen (EXP-07). Zie `.planning/IMPORT-SJABLOON.md`.
  6. Bedragen zijn getallen en datums zijn datums in het bestand, sorteerbaar en optelbaar zonder Excel iets uit te leggen (EXP-06).
**Plans**: 5 plans in 5 waves

Plans:
- [x] 04-01-PLAN.md — Het gereedschap: buildWorkbook naast het onveranderde buildXlsx, en het ISO-weeknummer in lib/datetime (wave 1)
- [x] 04-02-PLAN.md — Blad "Lessen" in exact het kolomformaat dat de import leest, één rij per les × leerling, met Groep-ID (wave 2)
- [x] 04-03-PLAN.md — Blad "Uren per trainer" via payoutsByCoach zonder omzet, en blad "Groepen" met het groepskenmerk (wave 3)
- [x] 04-04-PLAN.md — Blad "Aanwezigheid" uit de lessen zelf en niet uit het rooster van nu, plus exportWerkmap met de vier bladen (wave 4)
- [x] 04-05-PLAN.md — Het exportscherm met de beheerdersgrens erop, de tegel in Beheer, en met de hand nalopen in Excel (wave 5, checkpoint)

### Phase 5: Excel-import van trainingen
**Mode:** mvp
**Goal**: De beheerder laadt een seizoen aan trainingen in één keer in via een sjabloon, met een droogloop vooraf en zonder ooit te verdubbelen bij herimport. Het kolomformaat, de groepssleutel en de lesduur liggen vast in `.planning/IMPORT-SJABLOON.md` — niet opnieuw ontwerpen.
**Depends on**: Phase 4
**Requirements**: IMP-01, IMP-02, IMP-03, IMP-04, IMP-05, IMP-06, IMP-07, IMP-08, IMP-09, IMP-10, IMP-11
**Success Criteria** (what must be TRUE):
  1. De beheerder downloadt een leeg sjabloonbestand dat de verwachte kolommen toont (IMP-01).
  2. Vóór er iets wegschrijft toont een droogloop welke groepen erbij komen of bijgewerkt worden, welke spelers nieuw zijn, hoeveel lessen ingepland worden en wat niet gelezen kon worden (IMP-02).
  3. De import maakt lesgroepen aan (trainer, dag, uur, baan, spelers), maakt onbekende spelers aan volgens dezelfde regels als de bestaande ledenimport, en plant de lessen van elke groep in met de clubvakanties eruit gefilterd — bezette trainer/baan wordt gemeld, niet stil overschreven (IMP-03, IMP-04, IMP-05).
  4. Hetzelfde bestand een tweede keer inlezen verandert niets (automatische test); een gewijzigd bestand opnieuw inlezen past een aangepaste groep aan en verwijdert een speler die er niet meer in staat — alles vanaf vandaag vooruit; een met de hand verzette of afgezegde les wordt niet stilzwijgend teruggezet, de droogloop meldt zulke botsingen apart (IMP-06, IMP-07, IMP-08).
  5. Een import die halverwege mislukt laat geen halve groep of halve reeks achter (IMP-09).
  6. Een fixture-test met een reeks die de lente- of herfst-tijdswissel overspant toont voor elke lesdatum hetzelfde lokale uur (geen uur verschoven door DST).
  7. Elke nieuwe of gewijzigde tabel in dit importpad is met de hand geverifieerd op de upsert-val tegen een echte Supabase-omgeving.
  8. `koen.xlsx` — de echte seizoensplanning van de club, 1398 regels — leest ongewijzigd in en levert tien lesgroepen met hun eigen roster en 42 spelers op (zeven groepsnamen, maar "Groep 8" staat op drie momenten en "Groep 12" op twee, elk met andere spelers). Er worden nog geen lessen ingepland omdat het bestand geen baan kent en zijn trainer nog niet in de app bestaat; de droogloop meldt precies die twee dingen (IMP-10).
  9. De lesduur is een clubinstelling met 60 minuten als beginwaarde; een wijziging raakt geen les die al ingepland of gegeven is (IMP-11).
**Plans**: 10 plans in 9 waves

Plans:
- [x] 05-01-PLAN.md — De uitpakker met de hand: RFC 1951 in lib/inflate.ts, bewezen tegen bekende bytevectoren (wave 1)
- [x] 05-02-PLAN.md — Twee kleine uitbreidingen: namen herkennen ongeacht de volgorde, en een .xlsx als bytes kiezen (wave 1)
- [x] 05-03-PLAN.md — De lezer, eerst en alleen: zip, XML, datum en tijd, byte-exact bewezen tegen het echte koen.xlsx (wave 2)
- [x] 05-04-PLAN.md — De kolomtabel, de koprij, de regels met betekenis, en het sjabloon om te downloaden (wave 3)
- [x] 05-05-PLAN.md — Lesgroepen afleiden op de sleutel naam+dag+uur; spelers aanmaken, trainer en baan alleen opzoeken (wave 4)
- [x] 05-06-PLAN.md — De lessen: vakanties eruit, botsingen gemeld, herimport zonder verdubbelen, en de zomertijdtest (wave 5)
- [x] 05-07-PLAN.md — De acceptatie: koen.xlsx van bytes tot plan, twee keer inlezen, en de export weer inlezen (wave 6)
- [x] 05-08-PLAN.md — De uitvoerder: het hele plan in één opslag, en eerlijk over wat een halve mislukking betekent (wave 7)
- [x] 05-09-PLAN.md — Het importscherm met de droogloop, de tegel in Beheer en de Engelse teksten (wave 8, checkpoint)
- [ ] 05-10-PLAN.md — Met de hand nalopen: de upsert-val, en het echte seizoen één keer bewust inlezen (wave 9, checkpoints)

### Phase 5.1: De groepssleutel zonder groepsnaam
**Mode:** mvp
**Goal**: De import herkent een lesgroep aan haar moment en haar terrein in plaats van aan een groepsnaam uit een ander systeem, zodat een trainerswissel een wijziging is en geen nieuwe groep.
**Depends on**: Phase 5
**Requirements**: IMP-03, IMP-10, IMP-12, IMP-13, IMP-14, IMP-15, IMP-16, IMP-17
**Inserted**: 2026-09-06, na fase 5, op aangeven van de gebruiker. De kolom `Groep` in de planning van de club komt uit het Tennis Vlaanderen-systeem en betekent daar iets anders: hetzelfde nummer staat op momenten met totaal verschillende spelers. Hem in de sleutel meenemen maakte van één groep drie, en van een trainerswissel een nieuwe groep in plaats van een wijziging. Het terreinnummer komt in de plaats, in de kolom die nu `Indoor/Outdoor` heet.
**Success Criteria** (what must be TRUE):
  1. De sleutel van een lesgroep is weekdag + beginuur + baan; de kolom `Groep` doet niet mee aan het matchen (IMP-03).
  2. `koen.xlsx` levert nog steeds tien groepen met dezelfde rosters, nu genoemd naar hun moment in plaats van naar een nummer (IMP-10, IMP-12).
  3. Hetzelfde bestand opnieuw inlezen met een andere naam in de kolom `Coach` werkt de komende lessen van die groep bij naar die trainer, meldt vooraf om hoeveel lessen het gaat, laat `taught_by_id` ongemoeid en raakt geen enkele les uit het verleden (IMP-13).
  4. Staat er een `Groep-ID` in het bestand, dan mogen naam, dag, uur, trainer en baan allemaal wijzigen op de bestaande groep (IMP-14).
  5. Het terreinnummer wordt gelezen uit `Baan` én uit `Indoor/Outdoor`; de woorden `Indoor` en `Outdoor` zelf betekenen "geen baan" (IMP-15).
  6. Een trainerswissel op komende lessen en een speler die uit een roster verdwijnt worden apart bevestigd, los van de rest van de import (IMP-16).
  7. Een bestand dat grotendeels over het verleden gaat, of een app die sinds de vorige import gewijzigd is, levert bovenaan de droogloop een waarschuwing met de periode van het bestand erbij (IMP-17).
  8. `npx tsc --noEmit`, `npm test` en `npx expo export --platform web` slagen.
**Plans**: 4 plans in 4 waves

Plans:
- [ ] 05.1-01-PLAN.md — De baankolom: Indoor/Outdoor draagt het terrein, de woorden zelf betekenen geen baan (wave 1)
- [ ] 05.1-02-PLAN.md — De sleutel en de naam: weekdag + beginuur + baan, en een groep die naar haar moment heet (wave 2)
- [ ] 05.1-03-PLAN.md — De trainerswissel: de komende lessen krijgen de nieuwe trainer, taught_by_id en het verleden ongemoeid (wave 3)
- [ ] 05.1-04-PLAN.md — De droogloop op het scherm, de Engelse teksten, en met eigen ogen nalopen (wave 4, checkpoint)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 2.1 → 3 → 4 → 5 → 5.1

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Lesgroepen | 6/7 | In Progress|  |
| 2. Wie gaf de les écht | 2/4 | In Progress|  |
| 2.1 De groep verzetten werkt door | 1/2 | In Progress|  |
| 3. Ziekmelding en vervangerswerklijst | 7/8 | In Progress|  |
| 4. Excel-export | 5/5 | In Progress| Code af; taak 3 van 04-05 is een handmatige controle in Excel |
| 5. Excel-import van trainingen | 9/10 | In Progress| Taak 3 van 05-09 is een handmatige controle van het scherm, met .env uitgezet |
