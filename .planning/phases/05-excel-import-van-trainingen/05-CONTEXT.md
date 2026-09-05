# Phase 5: Excel-import van trainingen - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning
**Source:** Het kolomformaat, de groepssleutel en de lesduur zijn vastgelegd in
`.planning/IMPORT-SJABLOON.md`, afgeleid uit de échte seizoensplanning van de club
(`koen.xlsx`) en bevestigd door de gebruiker.

<domain>
## Phase Boundary

De beheerder laadt een seizoen aan trainingen in één keer in via een sjabloon, met een
droogloop vooraf en zonder ooit te verdubbelen bij herimport.

**Het formaat ligt vast. Niet opnieuw ontwerpen.** Lees `.planning/IMPORT-SJABLOON.md` en volg
het.

</domain>

<decisions>
## Implementation Decisions

### Het formaat — vastgelegd, niet ter discussie

- **D-01:** Eén regel per **les × leerling**. Een groepsles van zes staat als zes regels met
  dezelfde datum en hetzelfde uur. Zo plant de club vandaag al, en zo levert de export het aan.
- **D-02:** De lesgroep wordt **afgeleid**, niet ingevuld. Sleutel: `Groep` + weekdag +
  beginuur, binnen het ingelezen seizoen. Niet de groepsnaam alleen — in `koen.xlsx` staat
  "Groep 8" op drie momenten met drie volledig verschillende rosters en nul overlap.
- **D-03:** Staat er een `Groep-ID` in het bestand (de export vult die in), dan wint die van de
  afgeleide sleutel. Zo blijft een groep herkenbaar ook als naam of uur verandert.
- **D-04:** Verplichte kolommen: `Datum`, `Uur`, `Groep`, `Coach`, `Leerling`. Optioneel:
  `Groep-ID`, `Type les` (wordt het niveau), `E-mail leerling`, `Baan`. Genegeerd bij inlezen
  maar geschreven bij export: `Weekdag`, `Weeknr`, `Locatie`, `Indoor/Outdoor`. Onbekende
  kolommen worden genegeerd, niet afgekeurd. De koprij bepaalt wat waar staat.
- **D-05:** Lesduur is een clubinstelling met 60 minuten als beginwaarde. Geen kolom. Een
  wijziging geldt voor nieuw ingeplande lessen en nooit met terugwerkende kracht.

### Wat de import wel en niet aanmaakt

- **D-06:** Aanmaken: lesgroepen, onbekende spelers (zelfde regels als `lib/import-leden.ts`),
  en de lessen zelf.
- **D-07:** Opzoeken maar nooit aanmaken: trainers en banen. Een trainer aanmaken betekent een
  uurtarief en toegang tot de club; dat is geen bijproduct van een import. Ontbreekt de
  trainer, dan meldt de droogloop het en gaat die groep niet door.
- **D-08:** Namen worden gematcht via `normalizeName` uit `lib/students.ts`, en het matchen
  moet ertegen kunnen dat de achternaam vooraan staat ("Leemans Koen", "de Clippele Antoine").

### De droogloop

- **D-09:** Vóór er iets wegschrijft, een samenvatting — in groepen en aantallen, niet in
  1400 regels: lesgroepen nieuw/bijgewerkt/ongewijzigd, hoeveel spelers nieuw, hoeveel lessen
  ingepland worden, hoeveel er in een clubvakantie vallen en overgeslagen worden, hoeveel er
  botsen met een bezette trainer of baan, en wat niet gelezen kon worden met regelnummer en
  reden.
- **D-10:** Het plan wordt in `lib/` uitgerekend zonder databank en zonder scherm, precies zoals
  `lib/import-leden.ts` dat doet. Dat is waarom de belofte "je ziet het vóór het gebeurt"
  testbaar is.

### Herimport

- **D-11:** De sleutel van één les is `Datum` + beginuur + de lesgroep. Hetzelfde bestand een
  tweede keer inlezen verandert niets.
- **D-12:** Een gewijzigd bestand werkt bij, vanaf vandaag vooruit. Wat geweest is blijft staan.
- **D-13:** Een les die met de hand verzet of afgezegd is, wordt **niet** stilzwijgend
  teruggezet. De droogloop meldt zulke botsingen apart en de beheerder beslist.
- **D-14:** Een import die halverwege mislukt, laat geen halve groep of halve reeks achter.

### Tijd

- **D-15:** Alles in lokale tijd, met dag-, uur- en minuutvelden — nooit UTC parsen en dan
  `.toISOString()`. Een reeks die de zomer-wintertijdwissel overspant moet op elk lesmoment
  hetzelfde lokale uur tonen. `lib/recurrence.ts` doet dit al goed; volg het. Hier hoort een
  fixture-test bij die de wissel overspant.

### Toegang en databank

- **D-16:** Alleen de beheerder. Elke nieuwe of gewijzigde tabel krijgt admin-only
  RLS-policies en wordt met de hand op de upsert-val nagelopen.
- **D-17:** Schemawijzigingen als `alter table ... if not exists`-blok onderaan
  `supabase-schema.sql`. **De gebruiker draait ze zelf.** Niets in deze fase mag SQL draaien of
  de productiedatabank aanraken — en dat weegt hier het zwaarst van alle fases, want dit is de
  enige fase die in bulk schrijft.

### Beantwoord na het onderzoek van fase 5

- **D-18:** De xlsx-lezer krijgt een **zelfgeschreven inflate** (RFC 1951: stored, vaste en
  dynamische Huffman), ongeveer 300-500 regels, in een eigen `lib/`-bestand met een eigen test.
  Geen pakket erbij. Dat is dezelfde afweging die de schrijver in `lib/xlsx.ts` al maakte, en
  om dezelfde reden: dit draait op web én op een telefoon, en een afhankelijkheid die op één
  van de twee stilvalt is erger dan vierhonderd regels die volledig te testen zijn.
  `DecompressionStream` is géén alternatief: het bestaat niet overal waar deze app draait.
- **D-19:** De lezer wordt **eerst** gebouwd en byte-exact bewezen tegen `koen.xlsx` vóór er
  één regel importlogica op komt. Dat is een eigen plan, met een eigen test die het echte
  bestand uitleest en de bekende waarden controleert: 1398 regels, de kop
  `Datum/Weekdag/Weeknr/Uur/Type les/Groep/Coach/Leerling/Locatie/Indoor/Outdoor`, datum 46274
  = 9 september 2026, tijdbreuk 0.625 = 15:00.
- **D-20:** Een tijdbreuk wordt omgerekend door **eerst de totale minuten af te ronden**, niet
  door het uur apart te nemen. `0.58333333333333337 × 24 = 13.999...` en `Math.floor` daarvan
  is 13, niet 14. Precies het soort fout dat pas opvalt als een heel seizoen een uur te vroeg
  staat.
- **D-21:** IMP-09 betekent **"veilig opnieuw te draaien"**, niet "één databanktransactie".
  Supabase krijgt de tabellen na elkaar; er is geen kruistabel-transactie en die kan er niet
  komen zonder SQL te draaien, wat deze module niet doet. Wat wél waar moet zijn: een import
  die halverwege afbreekt, laat een toestand achter die door hetzelfde bestand opnieuw in te
  lezen compleet wordt gemaakt — zonder verdubbeling. Dat is te testen en het is eerlijk.
  Zeg het ook zo tegen de gebruiker op het scherm.
- **D-22:** Namen matchen ongeacht de volgorde van voor- en achternaam gebeurt met een
  woordenvergelijking in `lib/students.ts`, zodat de trainerzoekopdracht en de spelerzoekopdracht
  dezelfde regel gebruiken. Twee verschillende regels zouden IMP-10 stilzwijgend breken.
- **D-23:** `lib/lesgroepen.ts` heeft al `groepSleutel` met precies de sleutel uit het sjabloon
  (`naam|weekdag|beginuur`). De import gebruikt die en schrijft geen tweede versie.

### Claude's Discretion

- Het lezen van een xlsx (`lib/xlsx.ts` schrijft alleen; lezen moet erbij, zonder pakket).
- De schermindeling van de droogloop.
- Hoe het sjabloonbestand gegenereerd en aangeboden wordt.

</decisions>

<specifics>
## Specific Ideas

- **IMP-10 is een harde eis:** `koen.xlsx` — 1398 regels, 9 sep 2026 t/m 25 jun 2027 — leest
  ongewijzigd in en levert zeven lesgroepen op met hun eigen roster. De enige melding mag zijn
  dat trainer en banen gekoppeld moeten worden. Gebruik dit bestand als testfixture.
- Wat erin zit: datums als Excel-serienummer, uren als Excel-tijdbreuk (0.625 = 15:00), zeven
  groepen met groottes 2 tot 6, één coach ("Leemans Koen", achternaam vooraan), locatie
  "GANTOISE", alles "Indoor", niveaus als vrije tekst.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/IMPORT-SJABLOON.md` — **het formaat. Bindend. Lees dit eerst.**
- `.planning/REQUIREMENTS.md` — IMP-01 t/m IMP-11.
- `koen.xlsx` — de echte planning, en de testfixture voor IMP-10.
- `lib/import-leden.ts` + `lib/import-leden.test.ts` — het droogloop-patroon dat hier herhaald wordt.
- `lib/xlsx.ts` + `lib/xlsx.test.ts` — de schrijver; het lezen moet erbij.
- `lib/recurrence.ts` — lokale tijd, vakanties eruit, botsingen gemeld. Niet nabouwen.
- `lib/vakanties.ts`, `lib/students.ts`, `lib/contact.ts`, `lib/money.ts`.
- `.planning/phases/01-lesgroepen/` en `.planning/phases/04-excel-export/` — het groepsmodel en het exportformaat waarop dit leunt.
- `.planning/research/PITFALLS.md` — idempotente import, DST, RLS-upsertval, dev-server-raakt-productie.
- `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/CONCERNS.md`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/import-leden.ts` — de vorm: rijen tekst plus de huidige lijst erin, een plan eruit. Geen databank, geen scherm, geen bestand.
- `app/admin/leden-import.tsx` — het bijbehorende scherm.
- `lib/recurrence.ts` — welke datums een wekelijkse reeks oplevert, vakanties eruit, en welke botsen omdat de trainer bezet is.
- `lib/xlsx.ts` — de zip- en XML-helft van een xlsx; lezen kan erop voortbouwen.

### Constraints from Existing Code
- Geen nieuwe afhankelijkheden. De xlsx-lezer wordt met de hand geschreven, net als de schrijver.
- `lib/` importeert nooit uit `providers/`, `components/` of `app/`. Geen `jest.mock`.
- Oplevering: `npx tsc --noEmit`, `npm test`, `npx expo export --platform web`.

</code_context>

<deferred>
## Deferred Ideas

- Importeren uit iets anders dan Excel — niet gevraagd.
- Automatisch importeren op schema — niet gevraagd.
- Controlelijst vóór het seizoen (dubbele banen, lessen in vakantie als apart scherm) — v2 (CONTR-01).

</deferred>

---

*Phase: 05-excel-import-van-trainingen*
*Context gathered: 2026-09-05*
