# Requirements: Tennisschool-module

**Defined:** 2026-09-05
**Core Value:** Als een trainer ziek is, ziet de beheerder binnen een minuut welke lessen dat
raakt en hangt hij er een vervanger aan die dat uur écht kan — zonder in vijf agenda's te zoeken.

## v1 Requirements

### Lesgroepen

- [ ] **GROEP-01**: De beheerder kan een lesgroep aanmaken met naam, niveau, vaste dag en uur,
      vaste trainer, baan en seizoensperiode (van–tot).
- [ ] **GROEP-02**: De beheerder kan spelers aan een lesgroep toevoegen en eruit halen.
- [ ] **GROEP-03**: De beheerder ziet per lesgroep welke lessen ervan ingepland staan en
      hoeveel er nog komen.
- [ ] **GROEP-04**: Een les die uit een lesgroep is ontstaan, verwijst naar die groep en blijft
      een gewone boeking — hij is te verzetten, af te zeggen en af te vinken als elke andere les.
- [ ] **GROEP-05**: Een wijziging aan een lesgroep (speler erbij of eraf, ander uur, andere
      trainer) werkt door in alle lessen van vandaag en later; lessen die al geweest zijn
      blijven staan zoals ze waren.
- [ ] **GROEP-06**: Elke les houdt zijn eigen deelnemerslijst op het moment van de les, zodat
      de groepsprijs en de aanwezigheid van een oude les niet verandert door een wijziging van
      vandaag.
- [ ] **GROEP-07**: De beheerder kan een lesgroep archiveren aan het einde van een seizoen
      zonder de gegeven lessen of hun geschiedenis te raken.

### Vervanging en loon

- [ ] **VERV-01**: Bij elke les is vast te leggen wie hem werkelijk gaf, apart van de trainer
      aan wie de les is toegewezen.
- [ ] **VERV-02**: Loon, urenoverzicht en rapport rekenen met wie de les werkelijk gaf, tegen
      diens eigen uurtarief — via één plek in de code, zodat de twee nooit uit elkaar lopen.
- [ ] **VERV-03**: Waar een les getoond wordt, is zichtbaar dat er een vervanger stond en wie
      de vaste trainer was.
- [ ] **VERV-04**: De beheerder kan een trainer ziek melden over een periode (van–tot,
      eventueel met een reden).
- [ ] **VERV-05**: Een ziekmelding levert één werklijst op met alle lessen van die trainer in
      die periode, met per les de datum, het uur, de baan, de groep of speler en het aantal spelers.
- [ ] **VERV-06**: De beheerder kiest per les in de werklijst: vervanger koppelen, laten staan
      met de markering "zoekt vervanger", of de les afzeggen.
- [ ] **VERV-07**: Een les zonder vervanger blijft zichtbaar gemarkeerd in de agenda en blijft
      in de werklijst staan tot hij is opgelost of afgezegd.
- [ ] **VERV-08**: Bij het koppelen van een vervanger toont de app alleen collega's die dat uur
      werkelijk kunnen: geen eigen les op dat moment, binnen hun boekingstijden, niet in een
      afwijkende periode, niet in een clubvakantie en zelf niet ziek gemeld.
- [ ] **VERV-09**: Trainers die niet kunnen, zijn opvraagbaar mét de reden waarom niet, zodat
      de beheerder toch bewust kan afwijken.
- [ ] **VERV-10**: De beheerder kan een ziekmelding intrekken; lessen die nog geen vervanger
      hebben, gaan terug naar de vaste trainer.

### Excel-export

- [ ] **EXP-01**: De beheerder kiest een periode (van–tot) en krijgt daar één Excel-bestand van.
- [ ] **EXP-02**: Blad "Lessen": één rij per les met datum, begin- en einduur, baan, toegewezen
      trainer, wie hem werkelijk gaf, groep of speler, aantal spelers en status.
- [ ] **EXP-03**: Blad "Uren per trainer": uren en loon per trainer over de periode, gerekend
      op wie de les werkelijk gaf.
- [ ] **EXP-04**: Blad "Aanwezigheid": per lesgroep de spelers in de rijen en de lesdata in de
      kolommen, gevuld uit de bestaande aanwezigheidsgegevens en leeg afdrukbaar voor een
      vervanger die geen app heeft.
- [ ] **EXP-05**: Blad "Groepen": één rij per lesgroep met naam, niveau, dag en uur, trainer,
      het aantal spelers en het aantal ingeplande lessen, plus het groepskenmerk (`Groep-ID`).
- [ ] **EXP-07**: Blad "Lessen" staat in exact het kolomformaat dat de import leest, met het
      `Groep-ID` erin, zodat een export ongewijzigd weer ingelezen kan worden en dezelfde
      groepen en lessen terugvindt in plaats van ze te verdubbelen.
- [ ] **EXP-06**: Bedragen zijn getallen en datums zijn datums in het bestand, zodat de
      beheerder kan sorteren en optellen zonder het eerst uit te leggen aan Excel.

### Excel-import van trainingen

- [ ] **IMP-01**: De beheerder kan een leeg sjabloonbestand downloaden dat toont welke kolommen
      de import verwacht, volgens het formaat in `.planning/IMPORT-SJABLOON.md`: één regel per
      les × leerling, met Datum, Uur, Groep, Coach en Leerling verplicht.
- [ ] **IMP-02**: De beheerder kiest een bestand en ziet vóór er iets wegschrijft een volledige
      droogloop: welke groepen erbij komen, welke worden bijgewerkt, welke spelers nieuw zijn,
      hoeveel lessen er ingepland worden, en wat er niet gelezen kon worden.
- [ ] **IMP-03**: De import leidt lesgroepen af uit het bestand op sleutel `Groep` + weekdag +
      beginuur, met trainer, baan, niveau en de spelers erin — één groepsnaam op twee
      momenten levert twee lesgroepen op, elk met hun eigen roster.
- [ ] **IMP-04**: Een speler die nog niet in de ledenlijst staat, wordt tijdens de import
      aangemaakt — met dezelfde regels als de bestaande ledenimport. Een trainer of baan die
      niet bestaat wordt nooit aangemaakt; de droogloop meldt het en die groep gaat niet door.
      Namen worden gematcht ook als de achternaam vooraan staat ("Leemans Koen").
- [ ] **IMP-05**: De import plant de lessen van elke groep in over de opgegeven periode, met de
      clubvakanties eruit gefilterd, en meldt welke lessen niet konden omdat de trainer of de
      baan al bezet was.
- [ ] **IMP-06**: Hetzelfde bestand een tweede keer inlezen verandert niets: bestaande groepen
      en lessen worden herkend en niet verdubbeld.
- [ ] **IMP-07**: Een gewijzigd bestand opnieuw inlezen werkt bij: een aangepaste groep wordt
      aangepast, een speler die er niet meer in staat gaat eruit — alles vanaf vandaag vooruit.
- [ ] **IMP-08**: Een les die met de hand is verzet of afgezegd, wordt door een herimport niet
      stilzwijgend teruggezet; de droogloop meldt zulke botsingen apart.
- [ ] **IMP-09**: Een import die halverwege mislukt, laat geen halve groep of halve reeks achter.
- [ ] **IMP-10**: `koen.xlsx` — de bestaande seizoensplanning van de club — leest ongewijzigd in,
      met alleen de melding dat trainer en banen nog gekoppeld moeten worden.
- [ ] **IMP-11**: De lesduur is een clubinstelling met 60 minuten als beginwaarde; een wijziging
      geldt voor nieuw ingeplande lessen en nooit met terugwerkende kracht.

### Toegang en databank

- [ ] **TOEG-01**: De hele tennisschool-module is bereikbaar vanuit Beheer en alleen zichtbaar
      voor een gebruiker met het beheerdersvinkje.
- [ ] **TOEG-02**: Elke nieuwe tabel en elk nieuw veld heeft een RLS-policy die schrijven
      beperkt tot beheerders, ook langs de upsert-weg — met de hand nagelopen, want tsc en de
      testsuite zien dit niet.
- [ ] **TOEG-03**: Alle schemawijzigingen staan als `alter table ... if not exists`-blok in
      `supabase-schema.sql`, klaar om door de gebruiker zelf in Supabase gedraaid te worden.

## v2 Requirements

- **RASTER-01**: Clubbreed weekraster met alle trainers en banen in één beeld.
- **CONTR-01**: Controlelijst vóór het seizoen: lessen in een vakantie, trainer op twee plekken,
  baan dubbel geboekt, les buiten de boekingstijden.
- **BERICHT-01**: Bij een gewijzigde les meteen de spelers en ouders kunnen aanschrijven.
- **ZIEK-01**: Een trainer kan zichzelf ziek melden zonder de beheerder.
- **INHAAL-01**: Een afgezegde speler een plek zoeken bij een groep van hetzelfde niveau.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Automatisch berichten sturen naar spelers en ouders | De app verstuurt niets; `lib/contact.ts` opent hooguit de mail-app. Eigen infrastructuur, eigen brok werk. |
| Automatisch een vervanger toewijzen zonder bevestiging | De beheerder moet de keuze maken; een stille toewijzing die fout is, merk je pas op de baan. |
| Wachtlijsten, inschrijvingen en indelen op niveau | Nieuw domein, niet nodig om ziekte op te vangen. |
| Toegang voor gewone trainers tot deze module | Houdt de rechtenvragen klein; `magInElkeAgenda` regelt dit al. |
| Slim rangschikken van vervangers op geschiktheid of voorkeur | Voor één club met een handvol trainers is "kan hij of niet" genoeg. |
| Een apart Supabase-testproject | De gebruiker draait de migraties zelf; een tweede project is een eigen opzetfase. |
| Meerdere clubs of vestigingen in één installatie | De app bedient één club. |

## Traceability

Elke v1-requirement is toegewezen aan precies één fase in .planning/ROADMAP.md.

| Requirement | Phase | Status |
|-------------|-------|--------|
| GROEP-01 | Phase 1 | Pending |
| GROEP-02 | Phase 1 | Pending |
| GROEP-03 | Phase 1 | Pending |
| GROEP-04 | Phase 1 | Pending |
| GROEP-05 | Phase 1 | Pending |
| GROEP-06 | Phase 1 | Pending |
| GROEP-07 | Phase 1 | Pending |
| VERV-01 | Phase 2 | Pending |
| VERV-02 | Phase 2 | Pending |
| VERV-03 | Phase 2 | Pending |
| VERV-04 | Phase 3 | Pending |
| VERV-05 | Phase 3 | Pending |
| VERV-06 | Phase 3 | Pending |
| VERV-07 | Phase 3 | Pending |
| VERV-08 | Phase 3 | Pending |
| VERV-09 | Phase 3 | Pending |
| VERV-10 | Phase 3 | Pending |
| EXP-01 | Phase 4 | Pending |
| EXP-02 | Phase 4 | Pending |
| EXP-03 | Phase 4 | Pending |
| EXP-04 | Phase 4 | Pending |
| EXP-05 | Phase 4 | Pending |
| EXP-06 | Phase 4 | Pending |
| EXP-07 | Phase 4 | Pending |
| IMP-01 | Phase 5 | Pending |
| IMP-02 | Phase 5 | Pending |
| IMP-03 | Phase 5 | Pending |
| IMP-04 | Phase 5 | Pending |
| IMP-05 | Phase 5 | Pending |
| IMP-06 | Phase 5 | Pending |
| IMP-07 | Phase 5 | Pending |
| IMP-08 | Phase 5 | Pending |
| IMP-09 | Phase 5 | Pending |
| IMP-10 | Phase 5 | Pending |
| IMP-11 | Phase 5 | Pending |
| TOEG-01 | Phase 1 | Pending |
| TOEG-02 | Phase 1 | Pending |
| TOEG-03 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 38 total
- Mapped to phases: 38
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-05*
*Last updated: 2026-09-05 after pinning the import template to koen.xlsx*
