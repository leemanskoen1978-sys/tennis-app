# Toegangsregels en coach-filters — spec

Datum: 2026-08-19
Hoort bij: [2026-08-19-navigatie-herstructurering-design.md](./2026-08-19-navigatie-herstructurering-design.md) §Toegangsregels

## Beslissing

De app wordt **open tussen trainers, gesloten tussen spelers, en geld blijft per trainer.**

| Wie | Ziet |
|---|---|
| Trainer | Alle afspraken, alle spelers, alle voortgang, alle lessen, alle trainers |
| Trainer | Alleen de **eigen** omzet — geen clubtotaal |
| Speler | Enkel het eigen dossier, met de notities van al zijn trainers |
| Speler | Geen spelerslijst, geen dossier van een andere speler, geen omzet |

Dit zijn UI-regels. Ze staan los van de layout-klus en moeten bij echte auth
opnieuw worden afgedwongen in RLS (zie HANDOVER.md §10).

## Waarom "open tussen trainers" geen afscherming weghaalt

Een trainer die de afspraak van een collega niet ziet, kan geen les overnemen, geen
gat in de baanbezetting zien en geen speler opvolgen die bij twee trainers loopt. De
huidige filters lossen geen privacyprobleem op — ze zijn een overblijfsel uit de tijd
dat er één trainer was. Wat wél privé is (het dossier van een andere speler, andermans
omzet) blijft privé.

## De vier filters

Drie eruit, één blijft — maar die ene moet worden uitgebreid, niet met rust gelaten.

### 1. `app/(tabs)/bookings.tsx:61` — Agenda

```
isCoach ? b.coach_id === currentUser.id : b.player_id === currentUser.id
```

Wordt: een coach ziet alle afspraken; de spelerregel blijft ongewijzigd.

```ts
const filtered = bookings.filter((b) =>
  isCoach
    ? (!onlyMine || b.coach_id === currentUser.id)
    : b.player_id === currentUser.id,
);
```

- `onlyMine` is lokale state, **standaard `false`**, gerenderd met de bestaande
  `<Chip label="Alleen die van mij" />` uit `components/ui/Chip.tsx`.
- De chip is een **weergavekeuze, geen afscherming**: alles zien is de standaard, maar
  op een drukke dag kun je terugvallen op je eigen lessen.
- De chip toont alleen voor `isCoach`.
- `otherPartyName()` (regel ~74) klopt niet meer zodra je andermans afspraak ziet: bij
  een vreemde afspraak moet de rij **beide** namen tonen (trainer én speler), niet "de
  andere partij". Vervangen door aparte trainersnaam + spelersnaam.

### 2. `app/(tabs)/progress.tsx:63` — Recente activiteit

```
[...progress].filter((p) => p.coach_id === currentUser.id)
```

Wordt: geen coach-filter; de lijst van 5 recente notities toont alles.

```ts
const recent = isCoach ? [...progress].sort(byDateDesc).slice(0, 5) : [];
```

Elke regel krijgt het label van de noterende trainer (`nameOf(p.coach_id)`).
`ownEntries` (de speler-kant, regel ~68) blijft ongewijzigd.

### 3. `app/player/[id].tsx:242` — Lesmateriaalbibliotheek

```
lessons.filter((l) => !l.student_id && (!currentUser || l.coach_id === currentUser.id))
```

Wordt: de hele bibliotheek van niet-toegewezen lessen, met eigenaar erbij.

```ts
const library = lessons.filter((l) => !l.student_id);
```

Per item de eigenaar tonen (`nameOf(l.coach_id)`), zodat je bij het toewijzen ziet van
wie het materiaal komt. `!l.student_id` blijft — dat filtert al toegewezen lessen weg
en is geen afscherming.

### 4. `app/(tabs)/reports.tsx` — Omzet ⚠️ moet strenger, niet losser

De filter op **regel 45** (`coachBookings`) blijft ongewijzigd. Maar hij dekt alleen de
betaalstatus-uitsplitsing. Het bedrag onder "Totale omzet" komt van **regel 58**:

```ts
const revenue = useMemo<number>(() => totalRevenue(bookings, courts), [bookings, courts]);
```

Dat telt `court.hourly_rate` over **alle betaalde boekingen van de hele club**. Een
trainer ziet daar vandaag dus andermans omzet in. Dat is in strijd met de beslissing en
moet mee in deze klus:

```ts
const revenue = useMemo<number>(
  () => totalRevenue(isCoach ? coachBookings : playerBookings, courts),
  [isCoach, coachBookings, playerBookings, courts],
);
```

Het label "Totale omzet" wordt **"Jouw omzet"** — anders leest het getal als een
clubtotaal en zou een trainer denken dat de club maar half zo veel draait.

`lib/payments.ts` verandert niet: `totalRevenue()` is al puur en neemt de lijst die je
hem geeft. Dit is alleen een aanroepfout.

## Afgeleide speler↔trainer-relatie

Geen koppeltabel, geen toewijzingsscherm. Twee helpers, met unit tests:

```ts
// lib/relations.ts
export function coachesForPlayer(playerId, bookings, lessons, progress): string[]
export function playersForCoach(coachId, bookings, lessons, progress): string[]
```

Een trainer "heeft" een speler zodra er tussen hen een afspraak, les of
voortgangsnotitie bestaat (`coach_id` + `player_id` / `student_id`). Dat is meteen
many-to-many: boek je Mathis bij Sanne, dan staat Mathis in Sannes lijst. Beide geven
gededuplicerde id's terug, gesorteerd op naam bij weergave.

## Naamlabels zijn geen versiering

Zodra het dossier gedeeld is, is "wie noteerde dit" onderdeel van de inhoud. Zonder de
labels uit §1–3 kun je een oordeel over een speler niet meer wegen tegen wie het gaf.
De labels horen dus bij dezelfde wijziging als het weghalen van de filter, niet bij een
latere polish-ronde.

Eén hulpfunctie voor alle drie de plekken:

```ts
const nameOf = (id?: string) => users.find((u) => u.id === id)?.name ?? 'Onbekend';
```

## Betalingen zijn ook geld

`usePendingPaymentBookings()` gaf alle openstaande betalingen van de club, dus trainer A
zag en kon de onbetaalde les van trainer B afvinken. Dat valt onder dezelfde regel als de
omzet, dus de hook is gescoped op de huidige gebruiker via een nieuwe pure helper
`pendingPaymentsFor(user, bookings)` in `lib/payments.ts`. Eén plek, drie schermen
gerepareerd: de Beheer-badge op de hub, de teller in `CoachDashboard` en de
`PaymentStatusModal`.

Dezelfde omzetlek zat ook in `components/CoachDashboard.tsx` — daar stond eveneens
`totalRevenue(bookings, courts)` over de hele club, gelabeld "Inkomsten (cash)". Ook
gescoped, label nu "Jouw inkomsten (cash)".

## Trainerdossier

De trainersrij bovenaan het spelerdossier is doorklikbaar naar `app/coach/[id].tsx`:
gegevens, de agenda van die trainer, en zijn spelers (uit `playersForCoach()`),
doorklikbaar terug naar het spelerdossier. Dat sluit de cross-link "opvolging van een
speler vanuit Trainers".

De route heet `coach/[id]` en niet `coaches/[id]` zoals in de ontwerpnota, omdat het
naast het bestaande `player/[id]` moet passen. Bij de navigatie-herstructurering worden
beide tegelijk meervoud.

## Wat níét verandert

- `lib/payments.ts` — zuiver, blijft zoals het is.
- De speler-kant van elke filter (`b.player_id === currentUser.id`, `ownEntries`,
  `playerBookings`). Spelers onderling blijven gescheiden.
- Trainerstarief blijft weergave-only; de omzet loopt op het baantarief. Per-trainer
  afrekenen is een aparte, latere beslissing.

## Verificatie

- `npx tsc --noEmit` → 0 fouten.
- `npm test` → bestaande tests groen.
- Nieuwe tests: `coachesForPlayer()` / `playersForCoach()` — leeg, één bron, meerdere
  bronnen, dedup.
- Nieuwe test: `totalRevenue(coachBookings)` ≠ `totalRevenue(bookings)` bij twee
  trainers met betaalde boekingen — dit is de regressie die nu bestaat.
- Handmatig als trainer A: agenda toont de les van trainer B mét beide namen; chip
  "Alleen die van mij" verbergt hem weer; omzet toont alleen A's bedrag.
- Handmatig als speler: geen spelerslijst, geen omzet, wél notities van beide trainers.
