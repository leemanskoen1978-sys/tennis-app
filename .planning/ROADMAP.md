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
- [ ] **Phase 3: Ziekmelding en vervangerswerklijst** - Eén werklijst per ziekmelding, met een vervangersvoorstel dat alleen écht beschikbare collega's toont.
- [ ] **Phase 4: Excel-export** - Eén export per periode met vier bladen, inclusief het groepskenmerk dat een latere herimport nodig heeft.
- [ ] **Phase 5: Excel-import van trainingen** - Een seizoen in één keer inladen met droogloop, en herimporteren zonder te verdubbelen.

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
**Plans**: TBD

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
**Plans**: TBD

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
**Plans**: TBD
**UI hint**: yes

### Phase 4: Excel-export
**Mode:** mvp
**Goal**: De beheerder trekt op elk moment een kloppende Excel-export over een periode, met een groepskenmerk dat een latere herimport laat herkennen.
**Depends on**: Phase 3
**Requirements**: EXP-01, EXP-02, EXP-03, EXP-04, EXP-05, EXP-06
**Success Criteria** (what must be TRUE):
  1. De beheerder kiest een periode (van–tot) en krijgt daar één Excel-bestand van met vier bladen (EXP-01).
  2. Blad "Lessen" toont één rij per les met datum, begin-/einduur, baan, toegewezen trainer, wie hem werkelijk gaf, groep of speler, aantal spelers en status (EXP-02).
  3. Blad "Uren per trainer" rekent uren en loon per trainer over de periode op basis van wie de les werkelijk gaf — dezelfde waarheid als het bestaande loonrapport (EXP-03).
  4. Blad "Aanwezigheid" toont per lesgroep de spelers in de rijen en de lesdata in de kolommen, gevuld uit de bestaande aanwezigheidsgegevens en leeg afdrukbaar voor een vervanger zonder app (EXP-04).
  5. Blad "Groepen" toont één rij per lesgroep (naam, niveau, dag/uur, trainer, spelers, aantal ingeplande lessen) in het kolomformaat dat de import straks leest, met een groepskenmerk dat een herimport dezelfde groep laat terugvinden (EXP-05).
  6. Bedragen zijn getallen en datums zijn datums in het bestand, sorteerbaar en optelbaar zonder Excel iets uit te leggen (EXP-06).
**Plans**: TBD

### Phase 5: Excel-import van trainingen
**Mode:** mvp
**Goal**: De beheerder laadt een seizoen aan trainingen in één keer in via een sjabloon, met een droogloop vooraf en zonder ooit te verdubbelen bij herimport.
**Depends on**: Phase 4
**Requirements**: IMP-01, IMP-02, IMP-03, IMP-04, IMP-05, IMP-06, IMP-07, IMP-08, IMP-09
**Success Criteria** (what must be TRUE):
  1. De beheerder downloadt een leeg sjabloonbestand dat de verwachte kolommen toont (IMP-01).
  2. Vóór er iets wegschrijft toont een droogloop welke groepen erbij komen of bijgewerkt worden, welke spelers nieuw zijn, hoeveel lessen ingepland worden en wat niet gelezen kon worden (IMP-02).
  3. De import maakt lesgroepen aan (trainer, dag, uur, baan, spelers), maakt onbekende spelers aan volgens dezelfde regels als de bestaande ledenimport, en plant de lessen van elke groep in met de clubvakanties eruit gefilterd — bezette trainer/baan wordt gemeld, niet stil overschreven (IMP-03, IMP-04, IMP-05).
  4. Hetzelfde bestand een tweede keer inlezen verandert niets (automatische test); een gewijzigd bestand opnieuw inlezen past een aangepaste groep aan en verwijdert een speler die er niet meer in staat — alles vanaf vandaag vooruit; een met de hand verzette of afgezegde les wordt niet stilzwijgend teruggezet, de droogloop meldt zulke botsingen apart (IMP-06, IMP-07, IMP-08).
  5. Een import die halverwege mislukt laat geen halve groep of halve reeks achter (IMP-09).
  6. Een fixture-test met een reeks die de lente- of herfst-tijdswissel overspant toont voor elke lesdatum hetzelfde lokale uur (geen uur verschoven door DST).
  7. Elke nieuwe of gewijzigde tabel in dit importpad is met de hand geverifieerd op de upsert-val tegen een echte Supabase-omgeving.
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Lesgroepen | 0/? | Not started | - |
| 2. Wie gaf de les écht | 0/? | Not started | - |
| 3. Ziekmelding en vervangerswerklijst | 0/? | Not started | - |
| 4. Excel-export | 0/? | Not started | - |
| 5. Excel-import van trainingen | 0/? | Not started | - |
