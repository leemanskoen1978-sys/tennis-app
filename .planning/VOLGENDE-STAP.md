# Waar het werk staat, en wat er nog moet

Bijgewerkt op 6 september 2026. Bedoeld om in een nieuw gesprek verder te kunnen zonder de
hele geschiedenis te lezen.

## Klaar en online

Fases 1, 2, 2.1, 3, 4, 5 en 5.1 staan op `main`, de build is groen en de site is bijgewerkt.
1574 tests. De testlijst voor de gebruiker staat in `TESTEN-tennisschool.md`.

Drie SQL-bestanden die de gebruiker zelf draait, in deze volgorde:
1. `MIGRATIE-tennisschool.sql` — de tabellen. **Nog niet gedraaid.**
2. `BANEN-toevoegen.sql` — terrein 1 t/m 11. **Gedraaid.**
3. `KALENDER-2026-2027.sql` — dertien vakantieperiodes. **Nog niet gedraaid.**

Sinds fase 5.1 nog bijgekomen, buiten de fases om: het banenscherm compact (keuzelijst +
detail + overzichtslijst), een baan kunnen toevoegen, het banenscherm beheerder-only, de
komende lessen op het afvinkscherm, en de tegelpagina van zeventien naar elf tegels met
"Lessen beheren" als ingang naar de tennisschool.

## Wat er nog moet

### 1. Het tweede importformaat — de échte clubijst

De gebruiker leverde de volledige lijst van de club aan. Die heeft een **andere vorm** dan
`koen.xlsx` en de importer kan hem niet lezen. Geanalyseerd, cijfers hard:

- 192 groepen, **550 verschillende spelers**, 12 trainers, terreinen 7 t/m 11, 13 doelgroepen.
- Kolommen: `Doelgroep`, `Groep`, `Weekdag`, `Uur`, `Terrein(en)`, `Trainer(s)`, `Speler(s)`.
- **Eén regel per groep**, spelers komma-gescheiden in één cel. Niet één regel per les × leerling.
- **Geen datums.** Het is een weekschema. De lessen volgen uit de clubkalender hierboven,
  seizoen 7 september 2026 – 30 juni 2027.
- `Uur` is een reeks (`16:00 - 17:00`). Duur: 188× 60 min, 2× 30 min, 2× 90 min — de vaste
  60 minuten als clubinstelling klopt dus niet voor vier groepen.
- Twee regels hebben **meerdere terreinen** (`Terrein 10, Terrein 11, Terrein 8, Terrein 9`).
- Twee regels hebben **geen spelers**.
- `Doelgroep` en `Groep` spreken elkaar soms tegen ("Kidstennis rood" met groepsnaam
  "Kidstennis groen - Groep 4"). `Doelgroep` is dus geen betrouwbaar niveau.

**Sleuteltest op de echte lijst:**

| Sleutel | Botsingen |
| --- | --- |
| weekdag + uur + terrein | 5 |
| + trainer | 4 |
| + `Groep` | 0 |

**Beslissing van de gebruiker: de groepsnaam komt er alleen bij als tiebreak**, niet standaard
in de sleutel. Dus weekdag + uur + terrein, en de naam alleen op de momenten waar het anders
botst. Zo blijft hernoemen werken voor de 187 groepen zonder botsing.

### 2. Een terrein kan meerdere groepen dragen — DIT BLOKKEERT DE IMPORT

De gebruiker: *"op 1 terrein kunnen idd verschillende groepen staan. Blauw en rood
bijvoorbeeld hebben maar een half terrein nodig."*

De app gaat vandaag uit van één groep per terrein. `botstMet` in `lib/recurrence.ts` — de ene
regel voor "is dat uur bezet", en met opzet de enige — meldt een botsing zodra twee lessen op
hetzelfde terrein overlappen. Gevolg:

- De import zou op die vijf momenten weigeren in te plannen ("Terrein 7 is bezet"), en dat is
  precies het kleutertennis.
- Het vervangersvoorstel meldt een trainer bezet die op een halve baan staat.
- `planGroepWijziging` blokkeert een verzetting op valse gronden.

De vijf plekken, alle vijf Terrein 7:

```
woensdag 14:00   wit/Multimove Gr1 (Lasoen)  | blauw Gr1 (Devries)  | rood Gr3 (Devries)
woensdag 15:00   wit/Multimove Gr2 (Lasoen)  | blauw Gr4 (Devries)
woensdag 16:00   blauw Gr2 (Devries)         | rood Gr7 (Devries)
zaterdag 09:00   wit/Multimove Gr3 (Devries) | blauw Gr2 (Devries)  | rood Gr1 (Devries)
zaterdag 10:00   wit/Multimove Gr4 (Lasoen)  | blauw Gr3 (Devries)  | rood Gr7 (Devries)
```

Merk op dat dezelfde trainer (Devries Ann) twee groepen tegelijk draait. De trainerbotsing is
dus óók geen harde fout bij kleutertennis.

Nog te beslissen met de gebruiker: een baan die weet hoeveel groepen erop passen (een veld op
`Court`, standaard 1, Terrein 7 hoger), of de terreinbotsing tot waarschuwing degraderen die
je kan aanvaarden. Het eerste is eerlijker, het tweede is minder werk. De trainerbotsing
vraagt een eigen antwoord.

### 3. De doorlichting van de hele app

Door de gebruiker gevraagd: een consultantsblik op de volledige app, met cijfers per onderdeel
en waar het beter kan. Afgesproken opzet: aparte reviewagenten per domein (correctheid en
geld, beveiliging en RLS, architectuur, gebruik, tests, bedrijfsvoering), elk een cijfer met
onderbouwing en wat verbeteren zou kosten. Expliciet afgesproken dat de bevindingen
ongefilterd doorgegeven worden, ook waar ze het gebouwde werk tegenspreken.

Aandachtspunten die nu al bekend zijn en in die review horen:
- 1574 tests, allemaal op `lib/`. Nul op de schermen, nul op de RLS-policies.
- De build stond een dag rood zonder dat het opviel — er wordt lokaal geverifieerd, niet op de
  server. GitHub meldt ook dat Node 20 afgeschreven is.
- De dev-server praat met de échte productiedatabank van de club; er is geen tweede omgeving.
- `bookings` doet viervoudig werk (les, aanvraag, betaling, aanwezigheid).
- De export werkt alleen op web, niet op de telefoon.
- Een losse boeking controleert alleen de trainer op bezetting, niet de baan.
- `newGoalId` in `lib/goals.ts` leunt op `Date.now()` plus vier tekens toeval.

## Waar de gegevens staan

`koen.xlsx` en de clubijst met 550 namen staan **niet** in de repository en horen daar niet:
de repo is publiek. `koen.xlsx` is gitignored; de clubijst stond alleen in het gesprek. Het
testbestand `lib/__fixtures__/lessen-voorbeeld.xlsx` is een geanonimiseerde kopie met
verzonnen namen, met een test die bewaakt dat er geen echte naam in terechtkomt.
