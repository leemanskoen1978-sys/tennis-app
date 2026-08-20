// Het maandoverzicht als gegevens (monthRows) en als tekst (toCsv), los van elkaar zodat
// het scherm dezelfde rijen kan tonen die het uitvoert.

import { PAYMENT_LABELS } from './payments';
import { BOOKING_STATUS_LABELS } from './status';
import type { Booking, Court, User } from './types';

export interface CsvRow {
  id: string;
  date: string;    // dd/mm/jjjj
  time: string;    // HH:MM
  coach: string;
  player: string;
  court: string;
  minutes: number;
  price: number;   // euro
  status: string;
  payment: string;
}

/** Eén bedrag-opmaak voor de hele export: twee decimalen en een komma. */
export function formatEuro(n: number): string {
  return n.toFixed(2).replace('.', ',');
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
  { label: 'Terrein', value: (r) => r.court },
  { label: 'Duur (min)', value: (r) => String(r.minutes) },
  { label: 'Prijs (EUR)', value: (r) => formatEuro(r.price) },
  { label: 'Status', value: (r) => r.status },
  { label: 'Betaalwijze', value: (r) => r.payment },
];

export const CSV_HEADER: readonly string[] = CSV_COLUMNS.map((c) => c.label);

function two(n: number): string {
  return String(n).padStart(2, '0');
}

function inMonth(iso: string, month: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
}

/** De lessen van één kalendermaand, op tijd gesorteerd, met de namen al opgezocht. */
export function monthRows(
  bookings: Booking[], users: User[], courts: Court[], month: Date,
): CsvRow[] {
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  const courtById = new Map(courts.map((c) => [c.id, c]));

  return bookings
    .filter((b) => inMonth(b.start_time, month))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .map((b) => {
      const start = new Date(b.start_time);
      const rawMinutes = Math.round((new Date(b.end_time).getTime() - start.getTime()) / 60000);
      // Een kapotte of omgekeerde eindtijd mag geen NaN of negatief bedrag in de export zetten:
      // de les blijft zichtbaar staan, maar met duur en prijs op 0.
      const minutes = Number.isFinite(rawMinutes) && rawMinutes > 0 ? rawMinutes : 0;
      const court = courtById.get(b.court_id);
      return {
        id: b.id,
        date: `${two(start.getDate())}/${two(start.getMonth() + 1)}/${start.getFullYear()}`,
        time: `${two(start.getHours())}:${two(start.getMinutes())}`,
        coach: nameById.get(b.coach_id) ?? 'Onbekend',
        player: nameById.get(b.player_id) ?? 'Onbekend',
        court: court?.name ?? 'Onbekend terrein',
        minutes,
        price: minutes === 0 ? 0 : Math.round(((court?.hourly_rate ?? 0) * minutes) / 60 * 100) / 100,
        status: BOOKING_STATUS_LABELS[b.status],
        payment: PAYMENT_LABELS[b.payment_method],
      };
    });
}

/** Excel hier leest puntkomma's en een komma als decimaalteken. */
function cell(value: string): string {
  return /[;"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: CsvRow[]): string {
  const lines = [CSV_COLUMNS.map((c) => c.label).map(cell).join(';')];
  for (const r of rows) {
    lines.push(CSV_COLUMNS.map((c) => cell(c.value(r))).join(';'));
  }
  return lines.join('\n');
}
