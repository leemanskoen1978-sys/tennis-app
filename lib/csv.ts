// Het overzicht als gegevens (csvRows) en als tekst (toCsv), los van elkaar zodat het
// scherm dezelfde rijen kan tonen die het uitvoert.

import { groupSize, shortGroupLabel } from './groups';
import { formatEuro } from './money';
import { bookingMinutes, bookingPrice, coachPayout, PAYMENT_LABELS, splitOf } from './payments';
import { bookingStatusLabel } from './status';
import { t } from './i18n';
import type { Booking, Court, User } from './types';

/** Eén bedrag-opmaak voor de hele app; de export houdt zijn eigen ingang. Zie lib/money. */
export { formatEuro } from './money';

export interface CsvRow {
  id: string;
  date: string;    // dd/mm/jjjj
  time: string;    // HH:MM
  coach: string;
  /** De betaler, en bij een groepsles hoeveel spelers er nog bij stonden: "Mathis +2". */
  player: string;
  /** Hoeveel spelers er op de baan stonden; 1 bij een privéles. */
  players: number;
  /** Wie de factuur krijgt: "Samen" (de betaler) of "Apart" (ieder zijn deel). */
  billing: string;
  court: string;
  minutes: number;
  price: number;    // euro — de prijs van de HELE les, op het tarief van het terrein
  coachPay: number; // euro — wat de trainer krijgt, op zijn eigen uurtarief
  status: string;
  payment: string;
}



export interface CsvColumn {
  label: string;
  value: (row: CsvRow) => string;
}

// De enige bron van waarheid voor kolommen: kop én cel staan hier naast elkaar, zodat het
// scherm en het bestand niet uit elkaar kunnen schuiven als de volgorde verandert.
export const CSV_COLUMNS: readonly CsvColumn[] = [
  { label: 'Datum', value: (r) => r.date },
  { label: 'Uur', value: (r) => r.time },
  { label: 'Trainer', value: (r) => r.coach },
  { label: 'Speler', value: (r) => r.player },
  // Eén regel per LES, ook bij een groepsles die apart gefactureerd wordt. Een export is een
  // lijst lessen — zo telt een trainer zijn maand, en zo sluit hij aan op de omzetkaart. Wie
  // welk deel krijgt, is een zaak van de facturatie en staat in de app bij de les zelf; hier
  // zeggen deze twee kolommen wat er te verdelen valt en of dat gebeurt.
  { label: 'Spelers', value: (r) => String(r.players) },
  { label: 'Facturatie', value: (r) => r.billing },
  { label: 'Terrein', value: (r) => r.court },
  { label: 'Duur (min)', value: (r) => String(r.minutes) },
  // Twee bedragen naast elkaar, en de kop zegt van wie ze zijn: de spelers betalen samen de
  // baan, de trainer krijgt zijn eigen uurtarief. Wat de club overhoudt is het verschil.
  { label: 'Prijs les (EUR)', value: (r) => formatEuro(r.price) },
  { label: 'Loon trainer (EUR)', value: (r) => formatEuro(r.coachPay) },
  { label: 'Status', value: (r) => r.status },
  { label: 'Betaalwijze', value: (r) => r.payment },
];

export const CSV_HEADER: readonly string[] = CSV_COLUMNS.map((c) => c.label);

/**
 * De koppenrij zoals hij in het bestand komt, in de gekozen taal.
 *
 * Een functie en geen constante: `CSV_COLUMNS` staat op het hoogste niveau van deze module
 * en wordt dus één keer gemaakt, bij het opstarten. Had de vertaling daar gestaan, dan was
 * de taal van dat ene moment voor de rest van de sessie vastgelegd.
 */
export function csvHeader(): string[] {
  return CSV_COLUMNS.map((c) => t(c.label));
}

function two(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * De lessen die je meekrijgt, op tijd gesorteerd en met de namen al opgezocht. Wélke lessen
 * dat zijn beslist het scherm (periode, trainer) — de selectie stond hier eerst vast op één
 * kalendermaand, en dat maakte elke andere periode onmogelijk. Filteren doe je met
 * `bookingsInPeriod` uit lib/period; dit blijft de vertaling naar rijen.
 */
export function csvRows(bookings: Booking[], users: User[], courts: Court[]): CsvRow[] {
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  const rateById = new Map(users.map((u) => [u.id, u.hourly_rate]));
  const courtById = new Map(courts.map((c) => [c.id, c]));

  return [...bookings]
    // Het bestand staat altijd op tijd oplopend, ook als het scherm anders sorteert.
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .map((b) => {
      const start = new Date(b.start_time);
      // Duur en prijs komen uit `payments`, zodat het maandoverzicht en de omzet op het
      // exportscherm hetzelfde bedrag tonen. Een kapotte of omgekeerde eindtijd geeft daar
      // 0: de les blijft zichtbaar staan, maar met duur en prijs op nul.
      const minutes = bookingMinutes(b);
      const court = courtById.get(b.court_id);
      const size = groupSize(b);
      return {
        id: b.id,
        date: `${two(start.getDate())}/${two(start.getMonth() + 1)}/${start.getFullYear()}`,
        time: `${two(start.getHours())}:${two(start.getMinutes())}`,
        coach: nameById.get(b.coach_id) ?? t('Onbekend'),
        player: shortGroupLabel(nameById.get(b.player_id) ?? t('Onbekend'), size),
        players: size,
        billing: splitOf(b) === 'separate' ? t('Apart') : t('Samen'),
        court: court?.name ?? t('Onbekend terrein'),
        minutes,
        price: bookingPrice(b, court),
        // Wat de trainer krijgt, op zijn eigen uurtarief. Nog geen tarief ingevuld (of een
        // trainer die niet meer bestaat) geeft 0 — zichtbaar nul in plaats van een leeg vak.
        coachPay: coachPayout(b, rateById.get(b.coach_id)),
        status: bookingStatusLabel(b.status),
        payment: t(PAYMENT_LABELS[b.payment_method]),
      };
    });
}

/** Excel hier leest puntkomma's en een komma als decimaalteken. */
function cell(value: string): string {
  return /[;"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: CsvRow[]): string {
  const lines = [csvHeader().map(cell).join(';')];
  for (const r of rows) {
    lines.push(CSV_COLUMNS.map((c) => cell(c.value(r))).join(';'));
  }
  return lines.join('\n');
}
