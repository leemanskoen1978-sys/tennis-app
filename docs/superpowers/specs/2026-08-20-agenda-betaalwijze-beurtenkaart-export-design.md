# Agenda: betaalwijze, beurtenkaart en maandexport

Datum: 2026-08-20

## Aanleiding

De agenda kent nu één betaalveld met drie waarden (betaald / onbetaald / factuur). De club
werkt in de praktijk met meer betaalwijzen — cash, factuur, QR, 10-beurtenkaart, sponsor —
en wil per maand een overzicht kunnen uitvoeren. Kalender-import uit de telefoonagenda valt
bewust buiten deze spec: dat vraagt `expo-calendar` en een native build, en de app draait nu
ook op web.

## Beslissingen

1. **Eén veld, geen tweede status.** De betaalwijze *is* de status. `payment_status` wordt
   vervangen door `payment_method`. Waarde `open` betekent "nog niets afgesproken" en houdt
   de werklijst van Beheer → Betalingen in stand.
2. **Beurten als lijst, niet als teller.** Zo is de gebruiksgeschiedenis zichtbaar en kan
   een beurt netjes terug bij annulering.
3. **Geen nieuwe dependencies.** Export gebeurt met een download-link op web en
   `Share.share()` op telefoon.

## Datamodel (`lib/types.ts`)

```ts
export type PaymentMethod =
  | 'open' | 'cash' | 'invoice' | 'qr' | 'beurtenkaart' | 'sponsor';

export interface BeurtenkaartUse {
  booking_id: string;
  date: string; // ISO — het tijdstip van de les waarvoor de beurt ging
}

export interface Beurtenkaart {
  id: string;
  player_id: string;
  total_sessions: number; // 10
  remarks?: string;
  created_at: string; // ISO
  uses: BeurtenkaartUse[];
}
```

Wijzigingen op bestaande types:

- `Booking.payment_status: PaymentStatus` → `Booking.payment_method: PaymentMethod`
- `Booking.beurtenkaart_id?: string` — welke kaart de beurt voor deze les droeg
- `User.default_payment_method?: PaymentMethod` — standaard voor een speler
- `PaymentStatus` verdwijnt uit `lib/types.ts`

`StoreData` krijgt `beurtenkaarten: Beurtenkaart[]`.

### Migratie

`withDefaults()` in `providers/mockStore.ts` zet bestaande boekingen om, zodat een
bestaande store niet gewist hoeft te worden:

| oud `payment_status` | nieuw `payment_method` |
| --- | --- |
| `null` / ontbreekt | `open` |
| `'unpaid'` | `open` |
| `'paid'` | `cash` |
| `'invoice'` | `invoice` |

`beurtenkaarten` wordt `[]` als de sleutel ontbreekt.

## Betaalregels

- **Werklijst** (`needsPayment`): boeking is `confirmed` / `completed` / `synchronized`
  én `payment_method === 'open'`.
- **Omzet** (`totalRevenue`): telt `cash`, `invoice`, `qr` en `beurtenkaart`; `open` en
  `sponsor` tellen niet mee. Geannuleerde boekingen tellen nooit mee.
- **Standaard bij boeken**: een nieuwe afspraak krijgt `default_payment_method` van de
  speler, of `open` als die niet is ingesteld.

## Beurtenkaart-koppeling

Alle beurten-logica loopt via één functie in de provider,
`setPaymentMethod(bookingId, method)`:

- **naar `beurtenkaart`**: zoek de kaart van die speler met de minste resterende beurten
  die er nog minstens één over heeft. Gevonden → beurt afboeken (`uses` + 1) en
  `beurtenkaart_id` op de boeking zetten. Niet gevonden → foutmelding
  "Geen beurtenkaart met beurten over" en de methode verandert niet.
- **weg van `beurtenkaart`**: de beurt met dit `booking_id` valt weg uit `uses`, en
  `beurtenkaart_id` wordt gewist.
- **boeking geannuleerd of verwijderd**: idem, de beurt komt terug.
- Handmatig bijstellen op het kaartscherm blijft mogelijk (beurt toevoegen/weghalen zonder
  boeking); zulke beurten hebben een leeg `booking_id`.

## Nieuwe, pure modules

| Module | Inhoud |
| --- | --- |
| `lib/payments.ts` (uitgebreid) | `PAYMENT_LABELS`, `paymentMeta()`, `needsPayment`, `pendingPaymentsFor`, `totalRevenue`, `defaultMethodFor(user)` |
| `lib/beurtenkaart.ts` (nieuw) | `remaining(card)`, `usableCardFor(cards, playerId)`, `useSession(card, bookingId, date)`, `releaseSession(card, bookingId)` |
| `lib/csv.ts` (nieuw) | `monthRows(bookings, users, courts, month)` → rijen; `toCsv(rows)` → string met `;` als scheidingsteken en Belgische datum/bedragnotatie |
| `lib/share.ts` (nieuw) | `shareCsv(filename, text)`: op web een `Blob` + download-link, op telefoon `Share.share()` |

Alles behalve `lib/share.ts` is puur en krijgt jest-tests naast het bestand, zoals de rest
van `lib/`.

## Schermen

| Scherm | Wijziging |
| --- | --- |
| `app/agenda/index.tsx` | Betaal-badge wordt aantikbaar → keuzelijst met de zes waarden; bij `beurtenkaart` toont de badge de resterende beurten. Knoppen **Beurtenkaarten** en **Maandoverzicht** bij de bestaande knoppenrij |
| `app/agenda/beurtenkaarten.tsx` (nieuw) | Alle kaarten: speler, voortgangsbalk, resterend, beurten ±, opmerking, gebruiksgeschiedenis, kaart aanmaken en verwijderen (met bevestiging) |
| `app/agenda/export.tsx` (nieuw) | Maandkiezer, tabel met datum/uur/trainer/speler/duur/prijs/status/betaalwijze, knop Downloaden (web) of Delen (telefoon) |
| `app/agenda/new.tsx`, `components/BookingModal.tsx` | Nieuwe boeking krijgt de standaard betaalwijze van de speler |
| `app/admin/payments.tsx` | Knoppenrij wordt de zes betaalwijzen |
| `app/admin/reports.tsx` | Uitsplitsing per betaalwijze in plaats van per status |
| `app/players/[id].tsx` | Keuze "standaard betaalwijze" bij de speler |
| `app/_layout.tsx` | Titels voor de twee nieuwe routes |
| `app/index.tsx` | Badge telt boekingen op `open` |

## Foutafhandeling

- Beurtenkaart vol of afwezig: `error` in de provider, zoals bij een dubbele boeking.
- Kaart verwijderen terwijl er beurten aan boekingen hangen: bevestiging die zegt hoeveel
  lessen hun koppeling verliezen; die lessen vallen terug op `open`.
- Export van een lege maand: knop blijft, met de melding "Geen lessen in deze maand".

## Testplan

- `lib/payments.test.ts`: uitgebreid met de zes waarden, omzetregels, `defaultMethodFor`.
- `lib/beurtenkaart.test.ts`: afboeken, teruggeven, vol, dubbele afboeking van dezelfde
  boeking.
- `lib/csv.test.ts`: maandfilter, kolomvolgorde, scheidingsteken, lege maand.
- Bestaande tests die `payment_status` gebruiken (`lib/seed.test.ts`, `lib/hub.test.ts`,
  `lib/relations.test.ts`) worden meegenomen in de omzetting.

## Buiten scope

Kalender-import en -synchronisatie, mailen van rapporten, JSON-backup/restore,
Google Calendar voor spelers.
