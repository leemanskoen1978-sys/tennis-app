# Navigatie-herstructurering — ontwerp

Datum: 2026-08-19

## Probleem

De app heeft één platte tabbar met zeven tabs (Start, Reserveren, Afspraken, Lessen,
Voortgang, Rapport, Tekenen, Profiel). Alles staat op hetzelfde niveau, ongeacht hoe vaak
je het gebruikt of waar het over gaat. Beheertaken (betalingen, speler toevoegen) zitten
verstopt in een bottom sheet op de hub. Er is geen groepering, dus je moet onthouden waar
iets staat in plaats van het te kunnen afleiden.

Daarnaast gaat de app van één trainer naar **meerdere trainers**, en dat past niet in de
huidige structuur.

## Doel

Een hoofdmenu met vier duidelijke secties — **Agenda, Spelers, Trainers, Beheer** — waarbij
je uit het onderwerp kunt afleiden waar iets hoort, en waarbij je van de ene sectie naar de
andere kunt doorklikken (bijvoorbeeld: vanuit een trainer naar de opvolging van zijn speler).

## Ordenende regel

> Gaat het over een **persoon** → Spelers of Trainers.
> Gaat het over de **club, het geld of het systeem** → Beheer.
> Gaat het over **tijd** → Agenda.

Gereedschap van de trainer (tekenveld, lesmateriaal) hoort bij Trainers, niet als losse
hoofdingang.

## Navigatiemodel

Geen tabbar. Eén startscherm met vier tegels; daarbinnen een gewone stack met terugknoppen.

```
┌────────────────────────────────┐
│  Hoi Koen 👋              (KP) │ ← avatar rechtsboven = Profiel
│  Wat wil je doen?              │
│  ┌────────────┐ ┌────────────┐ │
│  │ 📅 AGENDA  │ │ 👥 SPELERS │ │
│  │ 3 vandaag  │ │ 12 actief  │ │
│  └────────────┘ └────────────┘ │
│  ┌────────────┐ ┌────────────┐ │
│  │ 🎾 TRAINERS│ │ ⚙️ BEHEER ②│ │
│  │ 2 trainers │ │ 2 openstnd │ │
│  └────────────┘ └────────────┘ │
└────────────────────────────────┘
```

- **Volgorde op gebruiksfrequentie**, niet alfabetisch: Agenda (dagelijks) → Spelers
  (kernwerk) → Trainers (af en toe) → Beheer (zelden, en bevat het gevaarlijke spul).
- **Elke tegel toont een levend cijfer.** Zonder tabbar zie je niet meer in één oogopslag
  waar iets wacht; de tegels nemen die taak over. Beheer draagt de badge voor openstaande
  betalingen die nu in het verstopte bottom sheet zit.
- **Profiel is de avatar rechtsboven**, aanwezig op elk sectiescherm. Het is geen taak zoals
  de vier andere, dus het krijgt geen tegel.
- **De terugknop volgt je pad, niet de boom.** Via Trainers → Koen → Mathis brengt terug je
  naar Koen, niet naar Spelers. Anders raken de cross-links je kwijt.

### Speler

Zelfde patroon, andere tegels: **Reserveren** (primair, volle breedte) · **Mijn agenda** ·
**Mijn lessen** · **Mijn voortgang**. Geen lege of verboden secties.

## Routes en schermen

De map `app/(tabs)/` verdwijnt. De mapstructuur spiegelt de menustructuur. Routes blijven
Engels (zoals de bestaande `players`, `player/[id]`), teksten Nederlands.

```
app/
  _layout.tsx          Stack + provider (tabbar eruit)
  index.tsx            HUB — 4 tegels met tellers        ← was (tabs)/index.tsx
  login.tsx            ongewijzigd
  profile.tsx          jouw gegevens + uitloggen         ← afgeslankt

  agenda/
    index.tsx          Vandaag / Deze week / Later       ← was (tabs)/bookings.tsx
    new.tsx            Nieuwe afspraak                   ← was (tabs)/home.tsx

  players/
    index.tsx          Spelerslijst + zoeken + toevoegen ← was players.tsx
    [id].tsx           DOSSIER: lesdagen/lesplan/voortg. ← was player/[id].tsx
    progress.tsx       Voortgang noteren (los formulier) ← was (tabs)/progress.tsx

  coaches/
    index.tsx          Trainerslijst + toevoegen         ← NIEUW
    [id].tsx           Trainerdossier                    ← NIEUW
    drawing.tsx        Tekenveld                         ← was (tabs)/drawing.tsx
    lessons.tsx        Lesmateriaal-bibliotheek          ← was (tabs)/lessons.tsx

  admin/
    index.tsx          Beheer-sectiescherm               ← NIEUW (vervangt bottom sheet)
    payments.tsx       Betalingen als scherm             ← was PaymentStatusModal
    reports.tsx        Inkomsten & overzicht             ← was (tabs)/reports.tsx
    courts.tsx         Banen (eenvoudige lijst)          ← NIEUW
    settings.tsx       Boekingstijd, thema, taal, reset  ← uit profile.tsx gehaald
```

### Toelichting bij drie niet-vanzelfsprekende keuzes

**Instellingen verhuizen van Profiel naar Beheer.** Boekingseindtijd, thema, taal en
noodopruiming zijn systeeminstellingen, geen persoonsgegevens. Profiel houdt naam, e-mail en
uitloggen.

**Betalingen worden een scherm in plaats van een modaal venster.** Zo heeft het een eigen
route, kan de Beheer-badge erheen linken, en kun je vanaf een betaling doorklikken naar het
spelerdossier.

**Trainerstarief is weergave-only.** De omzetberekening loopt volledig op het baantarief
(`lib/payments.ts` telt `court.hourly_rate`). Een trainerstarief in de omzet meenemen zou
stilzwijgend de financiële cijfers veranderen; dat hoort niet in een layout-wijziging.
`hourly_rate` komt als optioneel veld op de trainer en wordt getoond, niet gerekend.
Per-trainer afrekenen is een aparte, latere beslissing.

## Meerdere trainers per speler

**De koppeling is afgeleid, niet apart bijgehouden.** Een trainer heeft een speler zodra er
tussen hen een afspraak, les of voortgangsnotitie bestaat (`coach_id` + `player_id`). Geen
koppeltabel, geen toewijzingsscherm dat kan verlopen. Dit is meteen many-to-many: boek je
Mathis bij Sanne, dan staat Mathis in Sannes lijst.

**Het spelerdossier is de gedeelde waarheid.** Bovenaan een doorklikbare rij trainers
("Trainers: Koen · Sanne"). Lesdagen, lesplan en voortgang tonen alles, van welke trainer
ook, met per item een label van wie het komt. Zonder die labels wordt een gedeeld dossier
onleesbaar.

**Trainerdossier** toont: gegevens + tarief (weergave), zijn agenda, en zijn spelers —
doorklikbaar naar het spelerdossier. Dat is de cross-link "opvolging van speler vanuit het
menu Trainers".

## Toegangsregels

| Wie | Ziet |
|---|---|
| Trainer | Alle afspraken, alle spelers, alle voortgang, alle lessen, alle trainers |
| Trainer | **Alleen de eigen omzet** — geen clubtotaal |
| Speler | Enkel het eigen dossier, met de notities van al zijn trainers |
| Speler | Geen spelerslijst, geen dossier van een andere speler, geen omzet |

Concreet in de code: drie bestaande coach-filters gaan eruit, één blijft.

| Plek | Nu | Wordt |
|---|---|---|
| `app/(tabs)/bookings.tsx:61` | coach ziet alleen eigen afspraken | alle afspraken, met trainersnaam; filterchip "Alleen die van mij" (standaard uit) |
| `app/(tabs)/progress.tsx:63` | recente activiteit alleen van jezelf | alle activiteit, met wie het noteerde |
| `app/player/[id].tsx:242` | lesmateriaal alleen van jezelf | hele bibliotheek, met eigenaar |
| `app/(tabs)/reports.tsx:45` | omzet alleen van eigen boekingen | **blijft ongewijzigd** |

De filterchip bij Agenda is een weergavekeuze, geen afscherming: "alles zien" is de
standaard, maar op een drukke dag kun je terugvallen op je eigen lessen.

## Cross-links

Deze maken de structuur werkbaar; zonder deze links worden de secties doodlopend.

| Van | Naar | Wanneer |
|---|---|---|
| Trainerdossier → speler | Spelerdossier | opvolging van een speler vanuit Trainers |
| Agenda-afspraak → speler | Spelerdossier | tik op de naam in een les |
| Agenda-afspraak → trainer | Trainerdossier | tik op de trainersnaam |
| Spelerdossier → agenda | Nieuwe afspraak, voorgevuld | vanuit lesdagen |
| Spelerdossier → lesmateriaal | Les toewijzen | vanuit lesplan |
| Spelerdossier → trainer | Trainerdossier | via de trainersrij bovenaan |
| Hub-badge → betalingen | Beheer › Betalingen | openstaande bedragen |
| Betaling → speler | Spelerdossier | wie moet er nog betalen |
| Tekenen → voortgang | Tekening bij een notitie bewaren | oefening vastleggen |

## Datamodelwijzigingen

Klein en additief:

- `User` krijgt `hourly_rate?: number` (alleen voor rol `coach`, weergave-only).
- `UserManagement` krijgt een rolkeuze zodat je ook een trainer kunt toevoegen; nu voegt het
  altijd een speler toe.
- Geen nieuwe tabellen. De speler↔trainer-relatie wordt afgeleid uit bestaande velden.

## Wat buiten scope blijft

- **Oefeningen** als nieuwe sectie — bestaat nog niet, is een feature en geen herindeling.
- **Per-trainer afrekenen** in de omzetberekening.
- Supabase, echte auth, native features — die staan al in HANDOVER.md §10 en veranderen niet
  door deze klus. De toegangsregels hierboven zijn UI-regels; met echte auth moeten ze
  daarnaast in RLS worden afgedwongen.

## Verificatie

- `npx tsc --noEmit` → 0 fouten.
- `npm test` → alle bestaande tests groen (payments/slots/seed raken niet aan deze klus).
- Nieuwe unit tests voor de afgeleide relatie: `coachesForPlayer()` en `playersForCoach()`.
- Handmatige doorloop van elke cross-link uit de tabel hierboven, plus terugknopgedrag.
- Browser-smoketest met 0 console-errors, als coach én als speler.

---

## Uitgevoerd

De structuur hierboven staat er: `app/(tabs)/` is weg, de mapstructuur spiegelt het
menu, en de terugknop volgt het pad (doorloop bevestigd: Agenda → trainer Koen → speler
Mathis → terug landt op Koen, niet op Spelers).

Vier dingen wijken af van het ontwerp, met reden:

**`CoachDashboard` is verwijderd in plaats van verplaatst.** Het toonde knoppen naar
Betalingen en Speler toevoegen — die staan nu in Beheer — en twee cijfers die de kaart
eronder in Rapport al gaf. Wat overbleef was een lege huls.

**`PaymentStatusModal` is verwijderd, niet omgebouwd.** `app/admin/payments.tsx` is
nieuw geschreven; het modale venster had geen route en kon niet doorlinken.

**De cross-link "Spelerdossier → Nieuwe afspraak, voorgevuld" is er alsnog**, nadat
"trainer boekt namens een speler" als aparte feature is toegevoegd. Zie hieronder.

**De cross-link "Tekenen → voortgang" is er alsnog**, nadat het bewaren van een tekening
als aparte feature is toegevoegd. Zie onderaan.

De hub-badge linkt naar Beheer in plaats van rechtstreeks naar Betalingen. Beheer draagt
de badge daar nog een keer, zodat je in één stap ziet waar hij vandaan komt.

## Trainer boekt namens een speler

`BookingModal` krijgt een optionele `playerId`. Zonder die prop boekt hij op naam van de
ingelogde gebruiker — het bestaande spelerpad, ongewijzigd. Mét die prop boekt een trainer
voor die speler, en noemt het venster de naam ("Voor Mathis"), want per ongeluk voor iemand
anders boeken is makkelijk gedaan.

**Een trainer boekt alleen op zijn eigen agenda.** Voor een trainer verdwijnt de
trainerkeuze uit `agenda/new`; `coach_id` is altijd de ingelogde trainer. Andermans agenda
vullen is een handeling, geen weergave — dat doet die trainer zelf. In plaats van de
trainerkeuze verschijnt een spelerkiezer (`StudentCombobox`).

**Twee ingangen.** Vanuit het spelerdossier, sectie Lesdagen, met de speler voorgevuld via
`?playerId=`; en via Agenda › Nieuwe afspraak met een lege kiezer.

**De prefill uit de URL wordt gecontroleerd.** `?playerId=` komt van buiten, dus de id
wordt getoetst aan de echte spelerslijst voordat hij wordt vertrouwd — anders boekt
`?playerId=<een trainer>` een trainer als speler. Onbekende of niet-toegestane ids vallen
terug op "geen speler gekozen", en dan is boeken geblokkeerd.

## Tekening bewaren als lesmateriaal

**Een veldsituatie is lesmateriaal, geen opmerking over één speler.** Een kruisoefening
met kegels teken je één keer en gebruik je opnieuw, bij Mathis en bij de volgende. Daarom
landt de tekening in de lesbibliotheek naast de video's en de PDF's, niet in het dossier
van een speler. Toewijzen aan een speler gaat daarna via het gewone lesplan.

**De tekening wordt opgeslagen als de situatie zelf, niet als plaatje.** `CourtDrawing`
bewaart de streken (SVG-paden), de geplaatste objecten met hun positie, de oriëntatie en
de maat waarin getekend is. Dat blijft klein, blijft scherp op elk formaat, en laat een
oefening later heropenen — een PNG zou geen van drieën doen. Het veld hangt aan `Lesson`,
niet aan `StudentProgress`.

**Er zijn twee wegen naar het tekenveld.** Zonder les erbij maak je een nieuwe: je geeft
een titel, optioneel een beschrijving en optioneel meteen een speler. Vanuit een les —
`/coaches/drawing?lessonId=…` — teken je de situatie die bij díé les hoort; de knop heet
dan "Bewaren bij <lestitel>", slaat direct op en brengt je terug.

**Het id uit de URL wordt getoetst.** Het komt van buiten, dus het wordt gecontroleerd
tegen de echte lessenlijst voordat het wordt vertrouwd. Klopt het niet, dan gedraagt het
tekenveld zich als vanouds en maakt het een nieuwe les.

## Een bewaarde tekening heropenen

**Aanpassen laadt de tekening terug in het canvas.** `rescaleDrawing` in `lib/drawing.ts`
schaalt de scène naar de huidige canvasmaat met één factor voor beide assen — de kleinste
van de twee — zodat een veld zijn verhouding houdt in plaats van tot een ovaal te rekken.
Anders dan `scaleFactor` schaalt deze wél omhoog: heropen je op een groter scherm, dan
hoort de tekening dat scherm te vullen, niet in een hoek te blijven zitten. De paden zijn
ons eigen formaat (`M x,y L x,y …`), dus elk getal erin is een coördinaat en kan worden
geschaald zonder SVG te parsen.

Ongedaan en Wissen werken daarna gewoon: de ingeladen streken en objecten komen in
dezelfde geschiedenis terecht als wat je er daarna bij tekent.

Bij de les staan **Aanpassen** en **Verwijderen**; is er nog niets, dan staat er
**Veldsituatie toevoegen**.

## Uitleg bij de veldsituatie

**De uitleg groeit aan onder de tekening.** Losse punten, vrij te bewerken en te
verwijderen — geen datum en geen auteur, want de huidige stand telt, niet de geschiedenis
van hoe hij zo geworden is. Een oud punt corrigeer je gewoon.

**De uitleg staat in het leesvenster, niet achter de bewerkknop.** Een punt toevoegen is
de handeling die je vaak doet; die moet geen drie tikken kosten. Elke wijziging wordt
meteen weggeschreven.

Het label zegt expliciet "Uitleg bij de veldsituatie", omdat een les intussen ook
`focus_points` heeft ("Aandachtspunten training", uit het KDT-boekje). Twee lijsten punten
op één scherm hebben elk een eigen naam nodig, anders weet je niet waar je moet typen.

Wat er niet is: meerdere veldsituaties per les. Eén les, één tekening.
