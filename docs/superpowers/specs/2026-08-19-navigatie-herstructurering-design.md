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
