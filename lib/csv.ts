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

export const CSV_HEADER = [
  'Datum', 'Uur', 'Trainer', 'Speler', 'Terrein', 'Duur (min)', 'Prijs (EUR)', 'Status', 'Betaalwijze',
] as const;

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
      const minutes = Math.round((new Date(b.end_time).getTime() - start.getTime()) / 60000);
      const court = courtById.get(b.court_id);
      return {
        id: b.id,
        date: `${two(start.getDate())}/${two(start.getMonth() + 1)}/${start.getFullYear()}`,
        time: `${two(start.getHours())}:${two(start.getMinutes())}`,
        coach: nameById.get(b.coach_id) ?? 'Onbekend',
        player: nameById.get(b.player_id) ?? 'Onbekend',
        court: court?.name ?? 'Onbekend terrein',
        minutes,
        price: Math.round(((court?.hourly_rate ?? 0) * minutes) / 60 * 100) / 100,
        status: BOOKING_STATUS_LABELS[b.status],
        payment: PAYMENT_LABELS[b.payment_method],
      };
    });
}

/** Excel hier leest puntkomma's en een komma als decimaalteken. */
function cell(value: string): string {
  return /[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: CsvRow[]): string {
  const lines = [CSV_HEADER.join(';')];
  for (const r of rows) {
    lines.push([
      r.date, r.time, r.coach, r.player, r.court,
      String(r.minutes), r.price.toFixed(2).replace('.', ','), r.status, r.payment,
    ].map(cell).join(';'));
  }
  return lines.join('\n');
}
