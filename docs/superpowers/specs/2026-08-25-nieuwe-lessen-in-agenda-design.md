# Nieuwe lessen meteen in je agenda

**Datum:** 25 augustus 2026
**Status:** goedgekeurd, klaar voor een implementatieplan

## Wat het probleem is

Een trainer die een reeks van dertig lessen aanmaakt, heeft die reeks ook in zijn eigen
agenda nodig. Vandaag kan dat alleen via *Nog te komen*: daar staat een knop die álle
komende lessen exporteert. Dat werkt, maar het is een omweg — je verlaat het scherm waar je
net aan het boeken was, en je krijgt een bestand met veel meer erin dan wat je zojuist hebt
toegevoegd.

Dit ontwerp zet de export op de plek waar de lessen ontstaan.

## Wat er komt

Na het aanmaken van een **reeks** blijft het boekingsvenster open op een eindscherm:

> **3 lessen aangemaakt**
> [Zet in mijn agenda (.ics)]  [Sluiten]

Het agendabestand bevat precies die drie lessen.

Eén losse les verandert niet: dat venster sluit meteen, zoals nu. Voor één les open je
zelden je agenda apart, en een extra klik bij elke boeking weegt niet op tegen de winst.

## Hoe het in elkaar zit

### 1. `components/AgendaExport.tsx` — een gedeelde knop

De export-logica zit nu in `app/agenda/komend.tsx`: `toIcs` aanroepen, het resultaat aan
`shareIcs` geven, en bij een fout een eigen regel tonen. Die logica verhuist naar een eigen
component.

De knop neemt een lijst boekingen aan en verder niets. Hij weet niet waar hij staat en niet
waarom die lessen bij elkaar horen; hij zet ze om en geeft ze aan het toestel. Zijn eigen
foutregel hoort erbij, want een mislukte download is iets van de knop en niet van het scherm
eromheen.

```
interface AgendaExportProps {
  bookings: Booking[];
  label?: string;      // standaard: 'Agenda-bestand (.ics)'
}
```

Geen `disabled`-prop: een lege lijst schakelt de knop zelf uit. Wie dat van buitenaf ook nog
eens mag zetten, krijgt twee plekken die hetzelfde regelen en vroeg of laat een knop die aan
staat terwijl er niets te exporteren valt.

De context die `toIcs` nodig heeft (`users`, `courts`, `viewerIsCoach`) haalt de component
zelf uit `useSimpleData` en `isCoach`. Twee schermen die dat allebei apart samenstellen is
twee kansen om het verschillend te doen.

`komend.tsx` gebruikt hem met de zichtbare lessen, het boekingsvenster met de nieuwe reeks.

### 2. De eindtoestand van het boekingsvenster

`components/BookingModal.tsx` kent al een eindtoestand. Bij een reeks waarin niet elke les
zijn betaalwijze kreeg, zet `seriesNotice` het venster op een scherm met alleen die melding
en Sluiten — de invoervelden zijn dan niet meer van toepassing, want de lessen staan er al.

Die toestand wordt verbreed van een melding naar de reeks zelf:

```
const [reeksKlaar, setReeksKlaar] = useState<{
  lessen: Booking[];
  melding?: string;
} | null>(null);
```

Elke reeks met minstens één aangemaakte les eindigt daar. De melding over openstaande
betalingen blijft wat hij is en komt naast de agenda-knop te staan; het is dezelfde
gebeurtenis en hij verdient geen tweede scherm.

Dat het één toestand blijft en geen tweede naast `seriesNotice`, is de kern van deze keuze.
Twee velden die allebei "de reeks staat er" betekenen, gaan uit elkaar lopen zodra iemand er
later iets aan verandert.

### 3. Wat er in het bestand staat

De vorm die op 25 augustus is vastgelegd, ongewijzigd:

```
SUMMARY:Tennis Baan 1
LOCATION:Baan 1
DESCRIPTION:Mathis
```

De UID's zijn dezelfde als bij de gewone export — het id van de boeking. Wie deze reeks nu
in zijn agenda zet en later op *Nog te komen* alles exporteert, krijgt geen dubbels: de
tweede invoer werkt dezelfde afspraken bij.

## Wat er misgaat, en wat er dan gebeurt

**De download mislukt.** De lessen staan er al; daar verandert niets aan. De knop toont
"Exporteren is niet gelukt. Probeer het opnieuw." en Sluiten blijft werken. Het venster mag
hier niet blijven hangen: de boeking is geslaagd, alleen het bestand niet.

**De reeks levert nul lessen op.** Dan is er niets aangemaakt en gaat het venster niet naar
de eindtoestand. Dat gedrag bestaat al en blijft.

**Op een telefoon.** `shareIcs` valt daar terug op het deelmenu met de tekst zelf. Dat is
bestaand gedrag en verandert niet.

## Tests

**`AgendaExport`**
- Roept `shareIcs` aan met een bestandsnaam en een ics-tekst waar de meegegeven lessen in
  staan.
- Toont de foutregel als `shareIcs` faalt, en toont hem niet als het lukt.
- Is uitgeschakeld bij een lege lijst.

**`BookingModal`**
- Een reeks van drie aangemaakte lessen zet het venster in `reeksKlaar` met precies die
  drie.
- Een reeks die nul lessen oplevert doet dat niet.
- Eén losse les sluit het venster, zoals nu.
- De bestaande melding over openstaande betalingen staat samen met de agenda-knop op het
  eindscherm.

**Niet stuk gegaan**
- De 874 bestaande tests blijven groen, in het bijzonder die van `komend.tsx` en `ics`.

## Wat er bewust niet in zit

- **Automatisch downloaden.** Een bestand dat vanzelf verschijnt zonder dat je erom vroeg,
  is een verrassing en geen dienst.
- **Een "enkel de nieuwe"-knop op Nog te komen.** Dat vraagt onthouden wat je al eens
  geëxporteerd had — opslag erbij voor een probleem dat de agenda zelf al oplost door
  dezelfde afspraken bij te werken.
- **Samenvoegen van lessen op hetzelfde uur.** Blijft één afspraak per boeking, zoals
  vastgelegd bij de vorige wijziging.
