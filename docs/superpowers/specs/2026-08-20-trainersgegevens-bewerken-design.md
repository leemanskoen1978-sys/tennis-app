# Trainersgegevens bewerken — ontwerp

Datum: 2026-08-20

## Probleem

Een trainer kan zijn eigen gegevens nergens aanpassen. `UserManagement` vult bij het
aanmaken een naam, een gegenereerd e-mailadres en eventueel een uurtarief in; daarna staat
het vast. De provider heeft `addUser`, maar geen `updateUser` — een gebruiker wijzigen is
in de hele app niet mogelijk.

Daar komt bij dat het datamodel al velden heeft die nergens worden gebruikt:

| Veld | Staat in `User` | Wordt gebruikt |
| --- | --- | --- |
| `email` | ja | ja — getoond op dossier en profiel |
| `phone` | ja | ja — getoond op dossier |
| `hourly_rate` | ja | ja — alleen getoond, nooit gerekend |
| `working_days` | ja | **nee** |
| `working_hours` | ja | **nee** |

De agenda maakt zijn uurvakken clubbreed: `generateSlots(settings.booking_end_time)` loopt
van 09:00 tot de clubgrens en kijkt nooit naar de trainer. Een trainer die alleen 's avonds
lesgeeft is dus overdag gewoon boekbaar.

## Doel

Een trainer bewerkt zijn eigen e-mailadres, gsm-nummer, lesdagen, lesuren en uurtarief. De
ingevulde dagen en uren zijn niet decoratief: de agenda laat alleen zien wat die trainer
echt geeft.

## Beslissingen

**De beschikbaarheid stuurt de agenda, hij beschrijft hem niet.** Een veld dat je invult en
dat vervolgens niets doet, is erger dan geen veld: het wekt de indruk dat het geregeld is.
Dus `working_days` en `working_hours` versmallen de boekbare uurvakken echt.

**Alleen je eigen gegevens.** Een trainer bewerkt zijn eigen dossier. Bij een collega staat
de knop er niet — niet grijs, maar afwezig. Een knop die je nooit mag gebruiken hoort er
niet te staan. Het uurtarief van een nieuwe collega raakt daarmee niet onbereikbaar:
`UserManagement` vraagt dat al bij het aanmaken.

**Niets ingevuld betekent overal beschikbaar.** Alle bestaande trainers hebben lege
`working_days` en `working_hours`. Zou leeg "geeft geen les" betekenen, dan is er na deze
wijziging niets meer boekbaar in de hele club. Leeg valt dus terug op het clubvenster: elke
dag, 09:00 tot de clubgrens — exact het gedrag van vandaag.

**De clubgrens is de buitenrand.** Een trainer legt zijn uren *binnen* 09:00–
`settings.booking_end_time`. Vult hij 07:00–23:00 in, dan wint de club. De club bepaalt
wanneer de banen open zijn; de trainer bepaalt wanneer hij daarbinnen werkt.

**Hele uren.** De agenda werkt in blokken van een uur. Een trainer die 16:30 kan invullen,
krijgt een halfuur dat nergens te boeken is. De uren komen daarom uit een keuzelijst van
hele uren.

**`role` is niet bewerkbaar.** Van een trainer een speler maken is geen formulierdetail
maar een ingreep met gevolgen voor bestaande boekingen, lessen en voortgang. Dat blijft
buiten deze wijziging.

## Datamodel

Er komt geen veld bij. `User` heeft alles al:

```ts
export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone?: string;                                  // gsm
  working_hours?: { start: string; end: string };  // 'HH:00'
  working_days?: number[];                         // 0 = zondag, zoals Date.getDay()
  hourly_rate?: number;
  // …
}
```

`working_days` telt zondag als 0. Dat is wat `Date.getDay()` teruggeeft en het is ook de
volgorde van `DAY_NAMES` in `app/agenda/new.tsx`. Een tweede telling ernaast is een bron
van fouten die niets oplevert.

De provider krijgt één functie erbij, in dezelfde vorm als `updateLesson`:

```ts
updateUser: (id: string, patch: Partial<Omit<User, 'id' | 'role'>>) => Promise<void>;
```

## Beschikbaarheid: `lib/slots.ts`

Twee pure functies erbij, naast het bestaande `generateSlots`:

```ts
/** Geeft deze trainer les op deze weekdag? Geen dagen ingevuld = elke dag. */
export function worksOnDay(coach: Pick<User, 'working_days'>, date: Date): boolean;

/** Uurvakken die deze trainer echt geeft: het clubvenster, versmald door zijn eigen uren. */
export function slotsForCoach(
  coach: Pick<User, 'working_hours'>,
  clubEndTime: string,
): string[];
```

`slotsForCoach` begint bij `generateSlots(clubEndTime)` en houdt de vakken over die vallen
binnen `[working_hours.start, working_hours.end)`. Ontbreekt `working_hours`, dan komt het
clubvenster ongewijzigd terug. Een lege uitkomst is geldig: een trainer die 09:00–09:00
invult geeft geen les, en dan is er niets te kiezen.

Ze nemen `Pick<User, …>` in plaats van een hele `User`, zodat een test een trainer kan
beschrijven met precies het veld dat ertoe doet.

## Schermen

### `app/coaches/[id].tsx`

De bovenste kaart toont naast e-mail, gsm en tarief voortaan ook de lesdagen en lesuren.
Is er niets ingevuld, dan staat er dat de trainer op alle dagen beschikbaar is — niet een
leeg vlak dat je laat raden.

Is `coach.id === currentUser.id`, dan komt er een **Bewerken**-knop op die kaart die
`CoachDetailsModal` opent.

### `components/CoachDetailsModal.tsx` (nieuw)

Gebouwd als tegenhanger van `UserManagement.tsx`: hetzelfde bodemvenster, dezelfde
veldopmaak, dezelfde manier van sluiten.

```
Mijn gegevens                            ✕
──────────────────────────────────────────
E-mailadres
┌──────────────────────────────────────┐
│ koen@…                               │
└──────────────────────────────────────┘

Gsm
┌──────────────────────────────────────┐
│ 0470 12 34 56                        │
└──────────────────────────────────────┘

Lesdagen
[Ma] [Di] [Wo] [Do] [Vr] [Za] [Zo]
 ●         ●         ●

Lesuren
  van [16:00 ▾]    tot [21:00 ▾]

Uurtarief
┌──────────────────────────────────────┐
│ 45                                   │
└──────────────────────────────────────┘

              [ Opslaan ]
```

Regels voor opslaan. De knop is uitgeschakeld tot alles klopt:

- e-mail is niet leeg
- van-uur ligt vóór tot-uur
- uurtarief is leeg of een geldig getal ≥ 0

Een leeg gsm-nummer, geen enkele dag aangevinkt of een leeg tarief zijn geldig; die velden
zijn optioneel en verdwijnen dan uit het profiel. Bij opslaan gaat een `updateUser` met
alleen de gewijzigde velden naar de provider.

### `app/agenda/new.tsx`

De uurvakken komen van `slotsForCoach(coach, settings.booking_end_time)` in plaats van van
`generateSlots(settings.booking_end_time)`. Een dag waarop de trainer niet lesgeeft is
uitgeschakeld, met de reden erbij in plaats van alleen een grijze knop.

Bij "Alle coaches" — de kijkstand waarin je toch niet kunt boeken — blijft het clubvenster
staan.

## Wat er niet gebeurt

**Bestaande boekingen blijven staan.** Verandert een trainer zijn uren, dan verdwijnt een
afspraak die daarbuiten valt niet, en er komt geen waarschuwing. Een afspraak die gemaakt
is, is gemaakt.

**Het uurtarief blijft display-only.** De omzetberekening in `lib/payments.ts` loopt op het
baantarief, niet op het trainerstarief. Dat verandert hier niet.

**Een speler bewerkt zijn eigen gegevens niet.** `updateUser` maakt het mogelijk, maar er
komt in deze wijziging alleen een scherm voor trainers.

## Tests

`lib/slots.test.ts` groeit met tests op de twee nieuwe functies, want dat is het stuk waar
de regels echt zitten:

- een trainer zonder `working_days` geeft les op elke dag
- een dag buiten `working_days` valt af
- een trainer zonder `working_hours` krijgt het volledige clubvenster
- uurvakken vóór `start` en vanaf `end` vallen af
- een trainer die ruimer instelt dan de club krijgt niet meer dan de club toestaat
- 09:00–09:00 levert geen enkel uurvak op
