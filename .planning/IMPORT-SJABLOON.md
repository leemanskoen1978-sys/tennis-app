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

- **Sleutel: `Groep` + weekdag + beginuur**, binnen het ingelezen seizoen.
- De **roster** is de verzameling `Leerling` over alle regels met die sleutel.
- Het **niveau** is de `Type les` die bij die sleutel hoort.
- De **vaste trainer** is de `Coach` die bij die sleutel hoort.

**Waarom niet de groepsnaam alleen.** In `koen.xlsx` staat "Groep 8" op drie momenten met
drie volledig verschillende rosters — zes kinderen op woensdag 17u, vier andere op vrijdag
17u, twee volwassenen op vrijdag 19u. Nul overlap. Het nummer is een administratief label dat
hergebruikt wordt, geen groep mensen. Matchen op naam alleen zou die drie tot één groep van
twaalf samensmelten.

Deze sleutel werkt ook als de club later wél één groep twee keer per week laat trainen: dat
worden twee lesgroepen met dezelfde spelers, en dat is zichtbaar en corrigeerbaar in plaats
van stilzwijgend fout.

## De kolommen

### Verplicht

| Kolom | Vorm | Uitleg |
| --- | --- | --- |
| `Datum` | Excel-datum of `DD/MM/JJJJ` | De dag van de les. |
| `Uur` | Excel-tijd of `HH:MM` | Het beginuur. Geen einduur — zie Lesduur. |
| `Groep` | tekst | Samen met dag en uur de sleutel van de lesgroep. |
| `Coach` | tekst | Moet een bestaande trainer zijn. De import maakt géén trainers aan. |
| `Leerling` | tekst | Wordt aangemaakt als hij nog niet bestaat. |

### Optioneel

| Kolom | Uitleg |
| --- | --- |
| `Groep-ID` | Het interne kenmerk van een bestaande lesgroep. De export vult dit in. Staat het er, dan wint het van de sleutel hierboven — zo blijft een groep herkenbaar ook als de naam of het uur verandert. Leeg of afwezig = matchen op de sleutel. |
| `Type les` | Wordt het niveau van de lesgroep. Vrije tekst. |
| `E-mail leerling` | Nodig om een nieuwe speler later een account te kunnen geven. |
| `Baan` | Naam of nummer van een bestaande baan. Ontbreekt hij, dan krijgt de les geen baan. |
| `Weekdag`, `Weeknr`, `Locatie`, `Indoor/Outdoor` | Genegeerd bij het inlezen; wél geschreven bij de export omdat ze het bestand leesbaar maken. Ze staan hier zodat `koen.xlsx` ongewijzigd ingelezen kan worden. |

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

- Hetzelfde bestand een tweede keer inlezen verandert niets (IMP-06).
- Een gewijzigd bestand werkt bij, vanaf vandaag vooruit; wat geweest is blijft staan (IMP-07).
- Een les die met de hand verzet of afgezegd is, wordt niet stilzwijgend teruggezet. De
  droogloop meldt zulke botsingen apart en de beheerder beslist (IMP-08).

## De droogloop

Vóór er iets wegschrijft, in samenvatting en niet in regels:

- lesgroepen: nieuw / bijgewerkt / ongewijzigd, elk met naam, dag, uur, trainer en aantal spelers;
- spelers: hoeveel nieuw, met hun namen;
- lessen: hoeveel er ingepland worden, hoeveel er in een clubvakantie vallen en dus overgeslagen
  worden, hoeveel er botsen met een bezette trainer of baan;
- wat niet gelezen kon worden, met regelnummer en reden.

Zelfde belofte als `lib/import-leden.ts`: het plan is te zien vóór er iets vastligt, en het
plan wordt in `lib/` uitgerekend zonder databank en zonder scherm, zodat het te testen is.
