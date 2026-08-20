// "Welke periode kijk ik naar" als één begrip. Het maandoverzicht kende alleen maanden;
// zodra je ook een kwartaal, een jaar of een eigen van-tot wilt zien, moet "valt deze les
// erin", "hoe heet deze periode" en "wat staat er in de bestandsnaam" op één plek staan —
// anders groeit er per scherm een eigen variant, en dat is precies wat er met de maandfilter
// dreigde te gebeuren.
//
// Een periode loopt van het begin van de eerste dag tot en met het einde van de laatste,
// in lokale tijd: een les van 's avonds laat hoort bij de dag zoals je hem op de klok ziet.
// Dezelfde keuze als `bookingsOnDay` in lib/hub.

import type { Booking } from './types';

/** De soorten periode die je kunt kiezen; de soort bepaalt hoe je vooruit- en achteruitbladert. */
export type PeriodKind = 'month' | 'quarter' | 'year' | 'custom';

export interface Period {
  kind: PeriodKind;
  /** Begin van de eerste dag, lokale tijd. */
  from: Date;
  /** Einde van de laatste dag (23:59:59.999), lokale tijd — de laatste dag telt dus mee. */
  to: Date;
}

const MONTH_NAMES = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];

const MONTH_SHORT = [
  'jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec',
];

/** Het begin van de dag waarop `d` valt, lokale tijd. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/**
 * Het einde van de dag waarop `d` valt. Eén milliseconde vóór middernacht, zodat een les
 * die om 23:30 op de laatste dag begint nog binnen de periode valt.
 */
export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function two(n: number): string {
  return String(n).padStart(2, '0');
}

/** De kalendermaand waarin `d` valt. */
export function monthPeriod(d: Date): Period {
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  // Dag 0 van de volgende maand is de laatste dag van deze — geen tabel met maandlengtes
  // en dus ook geen schrikkeljaarfout.
  const to = endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  return { kind: 'month', from, to };
}

/** Het kalenderkwartaal waarin `d` valt (jan–mrt, apr–jun, jul–sep, okt–dec). */
export function quarterPeriod(d: Date): Period {
  const firstMonth = Math.floor(d.getMonth() / 3) * 3;
  const from = new Date(d.getFullYear(), firstMonth, 1);
  const to = endOfDay(new Date(d.getFullYear(), firstMonth + 3, 0));
  return { kind: 'quarter', from, to };
}

/** Het kalenderjaar waarin `d` valt. */
export function yearPeriod(d: Date): Period {
  return {
    kind: 'year',
    from: new Date(d.getFullYear(), 0, 1),
    to: endOfDay(new Date(d.getFullYear(), 11, 31)),
  };
}

/**
 * Een eigen periode van dag tot en met dag. Een omgekeerde keuze (van later dan tot) wordt
 * omgedraaid in plaats van afgewezen: iemand die de twee data in de verkeerde volgorde
 * intikt bedoelt het tijdvak ertussen, en een lege lijst zou hem alleen maar laten denken
 * dat er geen lessen zijn.
 */
export function customPeriod(from: Date, to: Date): Period {
  const a = startOfDay(from);
  const b = startOfDay(to);
  const reversed = a.getTime() > b.getTime();
  return {
    kind: 'custom',
    from: reversed ? startOfDay(b) : a,
    to: endOfDay(reversed ? a : b),
  };
}

/** De periode van deze maand — de stand waarin het historiekscherm opent. */
export function currentPeriod(now: Date = new Date()): Period {
  return monthPeriod(now);
}

/** De vorige kalendermaand, als snelkeuze naast "deze maand". */
export function previousMonthPeriod(now: Date = new Date()): Period {
  return monthPeriod(new Date(now.getFullYear(), now.getMonth() - 1, 1));
}

/** Het aantal dagen dat een periode beslaat; alleen een eigen periode heeft dit nodig. */
function dayCount(p: Period): number {
  // +1 ms omdat `to` een milliseconde vóór middernacht ligt. Afronden vangt het uur op dat
  // bij een zomertijdwissel in of uit het tijdvak schuift.
  return Math.max(1, Math.round((p.to.getTime() - p.from.getTime() + 1) / 86400000));
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

/**
 * Bladeren binnen dezelfde soort: een maand terug, een kwartaal vooruit, enzovoort.
 * Een eigen periode schuift op met zijn eigen lengte, zodat "de vorige twee weken" ook echt
 * twee weken opschuift.
 */
export function shiftPeriod(p: Period, delta: number): Period {
  switch (p.kind) {
    case 'month':
      return monthPeriod(new Date(p.from.getFullYear(), p.from.getMonth() + delta, 1));
    case 'quarter':
      return quarterPeriod(new Date(p.from.getFullYear(), p.from.getMonth() + delta * 3, 1));
    case 'year':
      return yearPeriod(new Date(p.from.getFullYear() + delta, 0, 1));
    case 'custom': {
      const n = dayCount(p);
      const from = addDays(p.from, delta * n);
      return customPeriod(from, addDays(from, n - 1));
    }
  }
}

/** Eén dag als "1 aug" of, als het jaar erbij moet, "1 aug 2026". */
function shortDay(d: Date, withYear: boolean): string {
  const base = `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
  return withYear ? `${base} ${d.getFullYear()}` : base;
}

/** Hoe de periode heet op het scherm: "augustus 2026", "3e kwartaal 2026", "2026", "1 aug – 15 aug 2026". */
export function periodLabel(p: Period): string {
  switch (p.kind) {
    case 'month':
      return `${MONTH_NAMES[p.from.getMonth()]} ${p.from.getFullYear()}`;
    case 'quarter':
      return `${Math.floor(p.from.getMonth() / 3) + 1}e kwartaal ${p.from.getFullYear()}`;
    case 'year':
      return String(p.from.getFullYear());
    case 'custom': {
      const sameYear = p.from.getFullYear() === p.to.getFullYear();
      const oneDay =
        sameYear && p.from.getMonth() === p.to.getMonth() && p.from.getDate() === p.to.getDate();
      if (oneDay) return shortDay(p.from, true);
      // Bij één jaar staat het jaartal alleen achteraan; over een jaargrens heen moet het
      // twee keer, anders lijkt "28 dec – 3 jan 2027" op december 2027.
      return `${shortDay(p.from, !sameYear)} – ${shortDay(p.to, true)}`;
    }
  }
}

/**
 * De bestandsnaam van een export: de periode moet eruit af te lezen zijn, want in een map
 * met downloads is "lessen.csv" naast "lessen (3).csv" niets waard.
 */
export function periodFilename(p: Period): string {
  const y = p.from.getFullYear();
  switch (p.kind) {
    case 'month':
      return `lessen-${y}-${two(p.from.getMonth() + 1)}.csv`;
    case 'quarter':
      return `lessen-${y}-K${Math.floor(p.from.getMonth() / 3) + 1}.csv`;
    case 'year':
      return `lessen-${y}.csv`;
    case 'custom':
      return `lessen-${y}-${two(p.from.getMonth() + 1)}-${two(p.from.getDate())}-tot-`
        + `${p.to.getFullYear()}-${two(p.to.getMonth() + 1)}-${two(p.to.getDate())}.csv`;
  }
}

/** Valt dit tijdstip binnen de periode? Grenzen tellen mee. */
export function isInPeriod(iso: string, p: Period): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= p.from.getTime() && t <= p.to.getTime();
}

function byStartTime(a: Booking, b: Booking): number {
  return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
}

/**
 * De boekingen die in de periode beginnen, op tijd oplopend. Opvolger van `bookingsInMonth`:
 * scherm en bestand lopen allebei hierlangs, zodat "welke lessen zie ik" en "welke lessen
 * exporteer ik" niet uiteen kunnen lopen.
 */
export function bookingsInPeriod(bookings: Booking[], p: Period): Booking[] {
  return bookings.filter((b) => isInPeriod(b.start_time, p)).sort(byStartTime);
}

/**
 * De lessen die al begonnen zijn — de historiek. Een geannuleerde les blijft staan: hij is
 * gebeurd in je agenda, ook al is hij niet doorgegaan.
 */
export function pastBookings(bookings: Booking[], now: Date): Booking[] {
  return bookings.filter((b) => {
    const t = new Date(b.start_time).getTime();
    return !Number.isNaN(t) && t < now.getTime();
  }).sort(byStartTime);
}

/**
 * De lessen die nog moeten plaatsvinden, op tijd oplopend. Geannuleerd valt hier wél weg:
 * die les komt niet meer, dus hij hoort niet in "nog te komen".
 */
export function upcomingBookings(bookings: Booking[], now: Date): Booking[] {
  return bookings.filter((b) => {
    if (b.status === 'cancelled') return false;
    const t = new Date(b.start_time).getTime();
    return !Number.isNaN(t) && t >= now.getTime();
  }).sort(byStartTime);
}

/**
 * Een datum uit een invulveld: "1/8/2026", "01-08-2026" of "2026-08-01". null zodra het
 * geen bestaande dag oplevert, zodat een typfout niet stilletjes een andere maand kiest.
 */
export function parseDayInput(text: string): Date | null {
  const trimmed = text.trim();
  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(trimmed);
  const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  let y: number, m: number, d: number;
  if (dmy) {
    d = Number(dmy[1]); m = Number(dmy[2]); y = Number(dmy[3]);
  } else if (ymd) {
    y = Number(ymd[1]); m = Number(ymd[2]); d = Number(ymd[3]);
  } else {
    return null;
  }
  const date = new Date(y, m - 1, d);
  // Rolt 31/02 door naar maart? Dan bestond de dag niet en is het een typfout.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

/** Een dag terug in het invulveld: "01/08/2026". */
export function formatDayInput(d: Date): string {
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`;
}
