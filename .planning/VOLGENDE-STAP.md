# Waar het werk staat, en wat er nog moet

Bijgewerkt op 6 september 2026. Bedoeld om in een nieuw gesprek verder te kunnen zonder de
hele geschiedenis te lezen.

## Klaar en online

Fases 1, 2, 2.1, 3, 4, 5 en 5.1 staan op `main`, de build is groen en de site is bijgewerkt.
1574 tests. De testlijst voor de gebruiker staat in `TESTEN-tennisschool.md`.

Drie SQL-bestanden die de gebruiker zelf draait, in deze volgorde:
1. `MIGRATIE-tennisschool.sql` — de tabellen. **Gedraaid op 6 september 2026**, door de gebruiker bevestigd als correct. Daarmee bestaan `lesson_groups`, `sick_leaves`, `bookings.group_id` en `bookings.taught_by_id`, is `bewaak_betaalvelden` bijgewerkt en staat `courts_write` op `is_admin()`.
2. `BANEN-toevoegen.sql` — terrein 1 t/m 11. **Gedraaid.**
3. `KALENDER-2026-2027.sql` — dertien vakantieperiodes. **Gedraaid op 6 september 2026**, geverifieerd: 13 periodes in `club_settings`.

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

**BESLIST door de gebruiker, 6 september 2026 — en het is één regel voor allebei:**

> Een overlap **blokkeert nooit** en **waarschuwt altijd**. Het mag, maar het moet in het rood
> staan.

Dat geldt voor de trainer die twee groepen tegelijk draait ("Devries Ann" is bovendien een
voorlopige naam, dus dezelfde naam kan twee keer op hetzelfde moment voorkomen — dat mag) én
voor twee groepen op één terrein (blauw en rood hebben elk maar een halve baan nodig).

Geen capaciteit per baan dus, geen veld op `Court`. Gewoon: laat het door en toon het.

**Waar dit vandaag nog blokkeert en dus om moet:**

| Plek | Nu | Wordt |
| --- | --- | --- |
| `addBooking` in `providers/SimpleDataProvider.tsx` | weigert de boeking bij overlap | boekt, met de waarschuwing zichtbaar |
| `planSeries` in `lib/recurrence.ts` | slaat botsende momenten over | plant ze in, gemarkeerd |
| `planGroepWijziging` in `lib/lesgroepen.ts` | les blijft staan, reden `'bezet'` | verzet mee, gemarkeerd |
| `lessenUitGroep` in `lib/import-trainingen.ts` | plant de les niet in | plant in, in de droogloop in het rood |
| `kanVervangen` in `lib/vervanger.ts` | reden `eigen_les` | ongewijzigd — die lijst toont niet-beschikbaren al mét reden en laat je toch kiezen |

`botstMet` zelf blijft wat het is: de ene plek die zegt óf er overlap is. Alleen wat de
aanroepers ermee doen verandert — van weigeren naar melden. Let op dat de vakantieregel wél
blokkerend blijft: een les op een dag dat de club dicht is, hoort niet ingepland te worden.

Dit is een gedragsverandering in het plannen van lessen, en lessen raken geld. Verdient een
eigen fase met tests per aanroeper, niet een snelle ingreep.

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

---

## 4. HET PRIJSMODEL KLOPT NIET — belangrijkste vondst, 6 september 2026

De gebruiker leverde het tarievenblad van de club aan. **De club rekent per lesvolger, per
seizoen (30 lesweken), per lessoort.** Een vast bedrag per speler:

| Aanbod | Per lesvolger, 30 lesweken | Per speler per les |
| --- | --- | --- |
| Kidstennis wit | € 450 | € 15,00 |
| Kidstennis blauw | € 500 | € 16,67 |
| Kidstennis rood | € 500 | € 16,67 |
| Kidstennis oranje | € 575 | € 19,17 |
| Kidstennis groen | € 600 | € 20,00 |
| Tienertennis | € 600 | € 20,00 |
| Tienertennis voor starters | € 600 | € 20,00 |
| Groepslessen voor volwassenen | € 600 | € 20,00 |
| Groepslessen voor (her)starters | € 600 | € 20,00 |
| Duoles | € 1.150 | € 38,33 |
| Groepsles 3 spelers | € 800 | € 26,67 |
| Privéles | € 2.000 | € 66,67 |

**De app rekent iets anders.** `bookingPrice` in `lib/payments.ts` neemt het uurtarief van de
**baan** naar rato van de duur, met `Court.group_rates` als staffel op groepsgrootte. Dat
staat als vaste afspraak in `OPENSTAAND.md` en er zitten tests omheen.

Die twee modellen zijn niet hetzelfde en te herleiden is er niets:

- De prijs hangt bij de club aan de **lessoort**, bij de app aan de **baan**. De app heeft
  geen prijsveld op een lessoort of op een lesgroep.
- Een duoles brengt bij de club méér op dan een privéles (2 × € 1.150 = € 2.300 tegen
  € 2.000). Geen enkele staffel op een baan levert dat op, want een staffel gaat naar beneden
  naarmate de groep groter wordt.
- Beheer → Rapport toont dus niet de omzet van deze club. Het telt baanuren.
- De € 60/uur die op terrein 1 t/m 11 gezet is, speelt in het echte model geen rol.

**Wat de gebruiker al besliste:** alles op `invoice`. Dat past bij de bestaande regel dat een
groepsles altijd op factuur gaat.

**Wat nog open staat, en het is een ontwerpvraag, geen detail:**

1. Blijft de prijs per les (seizoensprijs ÷ 30, per speler) of wordt het een seizoensbijdrage
   per speler die los van de losse lessen staat? Het eerste past in het bestaande model met
   één nieuw prijsveld; het tweede is eerlijker tegenover hoe de club werkelijk factureert en
   maakt "een speler stapt in januari in" oplosbaar.
2. Waar hangt het bedrag? Voorstel: op de **lesgroep** (die kent haar niveau al) of op een
   nieuwe tabel lessoort→prijs. Niet op de baan.
3. Wat gebeurt er met `bookingPrice`, `totalRevenue` en Beheer → Rapport? Die zijn vandaag
   correct voor het baanmodel en fout voor dit. De geldregels in `OPENSTAAND.md` moeten
   navenant herschreven worden — dat zijn afspraken die tot nu toe als vast golden.
4. `payment_split`: bij een vast bedrag per lesvolger is 'separate' het enige dat klopt, want
   iedereen betaalt zijn eigen seizoensprijs. Te bevestigen.

**Niets hiervan is gebouwd.** Er is bewust niet aan begonnen: het raakt vastgelegde
geldregels en 550 facturen. Dit hoort vóór de lessen ingelezen worden, want elke boeking
draagt een betaalwijze en een bedrag.
