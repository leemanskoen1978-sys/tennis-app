# Het importsjabloon voor trainingen

**Vastgelegd:** 2026-09-05
**Geldt voor:** Phase 4 (export) en Phase 5 (import) van de tennisschool-module.

Dit bestand legt vast hoe een trainingenbestand eruitziet en waarom. Het is met opzet
gebaseerd op `koen.xlsx` — de echte seizoensplanning die de club vandaag al gebruikt — en
niet op een bedacht formaat. De planner van fase 5 hoeft dus niet opnieuw te ontwerpen.

## Wat `koen.xlsx` is

Een volledig seizoen van één trainer: 1398 regels, 9 september 2026 tot 25 juni 2027, samen
325 lessen. De kolommen: `Datum`, `Weekdag`, `Weeknr`, `Uur`, `Type les`, `Groep`, `Coach`,
`Leerling`, `Locatie`, `Indoor/Outdoor`. Eén regel per **les × leerling**: een groepsles van
zes staat er als zes regels met dezelfde datum en hetzelfde uur.

Groepsgroottes die erin voorkomen: 2 (65×), 4 (130×), 5 (32×), 6 (98×).

## De vorm: een uitgeklapte lessenlijst

**Eén regel per les × leerling.** Niet een compact blad met groepsdefinities en een
herhaalregel.

Waarom:
- Het is hoe de club vandaag al plant. Een formaat dat de gebruiker moet leren is een
  formaat dat verkeerd ingevuld wordt.
- Het is precies wat de export oplevert (blad "Lessen"), dus een export kan er ongewijzigd
  weer in. Dat is wat herimport zonder verdubbelen praktisch haalbaar maakt.
- Uitzonderingen spreken voor zich. Een week zonder les staat er gewoon niet in; een speler
  die er in januari bij komt, verschijnt vanaf januari. In een herhaalregel zou dat allemaal
  apart uitgedrukt moeten worden.

De prijs: een seizoen is ~1400 regels. Dat is voor Excel niets, en de droogloop vat het samen
in groepen en aantallen in plaats van in regels.

## De lesgroep wordt afgeleid, niet ingevuld

Er is geen apart blad met groepsdefinities. Een lesgroep volgt uit de regels:

- **Sleutel: weekdag + beginuur + baan**, binnen het ingelezen seizoen.
- De **roster** is de verzameling `Leerling` over alle regels met die sleutel.
- Het **niveau** is de `Type les` die bij die sleutel hoort.
- De **vaste trainer** is de `Coach` die bij die sleutel hoort — een *eigenschap*, geen deel
  van de sleutel. Dat is het punt: verandert de trainer in het bestand, dan is dat een
  wijziging van een bestaande groep en niet een nieuwe groep.

**De kolom `Groep` doet niet mee.** Bij de club komt die uit het Tennis Vlaanderen-systeem en
betekent daar iets anders: hetzelfde nummer staat op momenten met totaal verschillende
spelers. In de echte planning staat "Groep 8" op drie momenten met twaalf verschillende
mensen en nul overlap. Meenemen in de sleutel zou die drie samensmelten; als naam gebruiken
zou een nummer tonen dat niemand herkent.

Uitzondering: staat er een `Groep-ID` in de rij, dan komt het bestand uit de export van deze
app, en is `Groep` juist wél de echte naam van die groep. Zo werkt hernoemen via de
heen-en-terugweg gewoon.

Getest op de echte planning: sleutelen op weekdag + beginuur levert dezelfde tien groepen op
als sleutelen op naam + weekdag + beginuur, maar dan zonder dat "Groep 8" over drie groepen
verspreid staat. Elke groep heeft precies één lessoort en er is geen enkel conflict.

### Hoe een groep heet

Bij het aanmaken wordt de naam gemaakt uit het moment: `Woensdag 17:00`, of
`Woensdag 17:00 — baan 3` als er een baan bij staat. Daarna is het gewoon een naam: je kan
hem op het groepsscherm wijzigen, en een herimport zonder `Groep-ID` overschrijft hem nooit.

### Waarom de baan in de sleutel zit

Zolang er één trainer is, volstaat weekdag + beginuur. Met meerdere trainers geven er twee
tegelijk les op verschillende terreinen, en dan is de baan het enige dat die twee groepen uit
elkaar houdt.

### Wat er gebeurt als je iets uit de sleutel wijzigt

Verzet je een groep in het bestand van 17:00 naar 18:00, dan ziet de import een andere groep.
Dat is inherent aan een afgeleide sleutel. Daarvoor bestaat `Groep-ID`: importeer één keer,
exporteer, en vanaf dan draagt het bestand het kenmerk mee. Dan mag álles wijzigen — naam,
dag, uur, trainer, baan — en wordt het nog steeds als dezelfde groep herkend. **De
heen-en-terugweg is het update-mechanisme.**

## De kolommen

### Verplicht

| Kolom | Vorm | Uitleg |
| --- | --- | --- |
| `Datum` | Excel-datum of `DD/MM/JJJJ` | De dag van de les. |
| `Uur` | Excel-tijd of `HH:MM` | Het beginuur. Geen einduur — zie Lesduur. |
| `Groep` | tekst | Alleen een label. Doet niet mee aan de sleutel en wordt niet de naam — tenzij er een `Groep-ID` bij staat, dan is het de echte naam. Mag leeg zijn: dat is een privéles. |
| `Coach` | tekst | Moet een bestaande trainer zijn. De import maakt géén trainers aan. |
| `Leerling` | tekst | Wordt aangemaakt als hij nog niet bestaat. |

### Optioneel

| Kolom | Uitleg |
| --- | --- |
| `Groep-ID` | Het interne kenmerk van een bestaande lesgroep. De export vult dit in. Staat het er, dan wint het van de sleutel hierboven — zo blijft een groep herkenbaar ook als de naam, de dag, het uur, de trainer of de baan verandert. Leeg of afwezig = matchen op weekdag + beginuur + baan. |
| `Type les` | Wordt het niveau van de lesgroep. Vrije tekst. |
| `E-mail leerling` | Nodig om een nieuwe speler later een account te kunnen geven. |
| `Baan` | Naam of nummer van een bestaande baan. Ontbreekt hij, dan krijgt de les geen baan. |
| `Indoor/Outdoor` | Een tweede naam voor `Baan`. De planning van de club draagt het terreinnummer in deze kolom, omdat het Tennis Vlaanderen-blad die kop gebruikt. Staat er `Indoor` of `Outdoor` in plaats van een terrein, dan is er geen baan. |
| `Weekdag`, `Weeknr`, `Locatie` | Genegeerd bij het inlezen; `Weekdag` en `Weeknr` worden wél geschreven bij de export omdat ze het bestand leesbaar maken. |

**Een les zonder groep.** Staat `Groep` leeg, dan is het een gewone privéles: er wordt geen
lesgroep van gemaakt en er wordt er ook geen aan gekoppeld. De export schrijft zo'n les weg met
een lege `Groep` en `Type les` = "Privéles". Zo blijft de round-trip kloppen voor lessen die
nooit bij een groep hoorden.

`Locatie` wordt door de export niet geschreven — de app kent geen locatiebegrip en er is geen
bron voor. De kolom blijft wel leesbaar, zodat `koen.xlsx` ongewijzigd binnenkomt.
`Indoor/Outdoor` wordt wél geschreven, afgeleid uit de baan.

Onbekende kolommen worden genegeerd, niet afgekeurd. Kolomvolgorde doet er niet toe; de
koprij bepaalt wat waar staat — dezelfde aanpak als `lib/import-leden.ts`.

## Lesduur

**60 minuten**, als clubinstelling (`club_settings`), niet als kolom en niet hardgecodeerd.

`koen.xlsx` heeft geen einduur en geen duur, en de club werkt met lessen van een uur. Een
kolom die altijd hetzelfde is, is een kolom die verkeerd ingevuld kan worden. Een instelling
laat de club het later wijzigen zonder elk bestand aan te passen.

Gevolg voor het geld: de prijs van een les loopt op de duur (zie `lib/payments.ts`). Wordt de
instelling gewijzigd, dan geldt dat voor nieuw ingeplande lessen — nooit met terugwerkende
kracht op lessen die al ingepland of gegeven zijn.

## Wat de import wel en niet aanmaakt

| | |
| --- | --- |
| **Aanmaken** | Lesgroepen, spelers die nog niet bestaan, lessen (boekingen). |
| **Opzoeken, nooit aanmaken** | Trainers en banen. Een trainer aanmaken betekent een tarief en toegang tot de club; dat is geen bijproduct van een import. Ontbreekt de trainer, dan meldt de droogloop dat en gaat die groep niet door. |

Namen worden gematcht via `normalizeName` uit `lib/students.ts`, dezelfde regel als de
ledenimport. Let op: in `koen.xlsx` staat de achternaam eerst ("Leemans Koen", "de Clippele
Antoine"). Het matchen moet daar tegen kunnen.

## Herimport

De sleutel van één les is `Datum` + beginuur + de lesgroep. Dezelfde les die al bestaat,
wordt niet nog eens aangemaakt.

**Een andere trainer in het bestand werkt door.** Noemt het bestand trainer Y waar de agenda
nog trainer X heeft staan, dan krijgen de komende lessen van die groep trainer Y, en zegt de
droogloop vooraf om hoeveel lessen het gaat. Wie de les wérkelijk gaf (`taught_by_id`, een
eerdere vervanging) blijft ongemoeid — dat is een ander veld met een andere betekenis, en het
bepaalt het loon. Lessen die al geweest zijn veranderen nooit.

- Hetzelfde bestand een tweede keer inlezen verandert niets (IMP-06).
- Een gewijzigd bestand werkt bij, vanaf vandaag vooruit; wat geweest is blijft staan (IMP-07).
- Een les die met de hand verzet of afgezegd is, wordt niet stilzwijgend teruggezet. De
  droogloop meldt zulke botsingen apart en de beheerder beslist (IMP-08).

**Waarom de app hier remt.** Een importbestand is een foto van het moment waarop het gemaakt
is: lees je het maanden later opnieuw in, dan duwt die foto zich over de werkelijkheid heen —
de trainer die je in januari op het groepsscherm wisselde staat er weer af, en het kind dat je
er toen bij zette is er weer uit. Daarom staat de rem alleen op wat wegneemt of omzet en niet op
de rest: de app beschermt tegen de vergissing, niet tegen de bedoeling.

## De droogloop

Vóór er iets wegschrijft, in samenvatting en niet in regels:

- lesgroepen: nieuw / bijgewerkt / ongewijzigd, elk met naam, dag, uur, trainer en aantal spelers;
- spelers: hoeveel nieuw, met hun namen;
- lessen: hoeveel er ingepland worden, hoeveel er in een clubvakantie vallen en dus overgeslagen
  worden, hoeveel er botsen met een bezette trainer of baan;
- wat niet gelezen kon worden, met regelnummer en reden;
- bovenaan, vóór alle aantallen: een waarschuwing als het bestand grotendeels over het verleden
  gaat, met de periode van het bestand en het percentage daarvan dat al geweest is erbij — en,
  als er al eerder een seizoen ingelezen is én dit bestand iets zou terugdraaien, de datum van
  die vorige import (IMP-17);
- een apart bevestigingsblok voor wat deze import van bestaande gegevens zou wegnemen of
  omzetten: een andere trainer op komende lessen, en een speler die uit een roster verdwijnt.
  Met de groepen, de aantallen en de namen erbij, en met een vinkje dat standaard uit staat. De
  rest van de import — nieuwe groepen, nieuwe spelers, nieuwe lessen — gaat gewoon door zonder
  dat vinkje (IMP-16).

Zelfde belofte als `lib/import-leden.ts`: het plan is te zien vóór er iets vastligt, en het
plan wordt in `lib/` uitgerekend zonder databank en zonder scherm, zodat het te testen is.
