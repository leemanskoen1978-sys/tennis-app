// Eén plek voor datum- en tijdopmaak. De taal komt uit de instellingen (lib/i18n): in het
// Engels wordt "di 18 aug" vanzelf "Tue 18 Aug", zonder eigen maandtabel.
//
// Eén plek voor datum- en tijdopmaak. Zonder deze module schreef elk scherm zijn eigen
// `toLocaleString('nl-BE')`, en dan stond er ergens "18/8/2026, 09:00:00": seconden die
// niemand leest, een maand met één cijfer en geen weekdag — terwijl een trainer juist aan
// "di 18 aug" denkt en niet aan een getal. De dossierschermen deden het al goed; die vorm
// staat hier nu voor de hele app.

import { t, currentLocale } from './i18n';

/** Wat er komt te staan als de datum onbruikbaar is — nooit "Invalid Date" op het scherm. */
export const UNKNOWN_DAY = 'datum onbekend';
/** Idem voor een tijdstip. */
export const UNKNOWN_TIME = 'tijd onbekend';

/** Het gedachtestreepje tussen begin en einde van een tijdvak (en-dash, geen koppelteken). */
const RANGE_DASH = '–';
/** De scheiding tussen dag en tijd; hetzelfde punt dat de badges en samenvattingen gebruiken. */
const SEPARATOR = ' · ';

/** Een tijdstip zoals de app het bijhoudt: een ISO-string, of een Date die al klaarstaat. */
export type Moment = string | Date;

function parse(value: Moment): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Een dag met weekdag erbij: "di 18 aug". */
export function formatDay(iso: Moment): string {
  const d = parse(iso);
  if (!d) return t(UNKNOWN_DAY);
  return d.toLocaleDateString(currentLocale(), { weekday: 'short', day: '2-digit', month: 'short' });
}

/** Een tijdstip in 24 uur, zonder seconden: "09:00". */
export function formatTime(iso: Moment): string {
  const d = parse(iso);
  if (!d) return t(UNKNOWN_TIME);
  return d.toLocaleTimeString(currentLocale(), { hour: '2-digit', minute: '2-digit' });
}

/** Een tijdvak binnen één dag: "09:00–10:00". */
export function formatTimeRange(startIso: Moment, endIso: Moment): string {
  return `${formatTime(startIso)}${RANGE_DASH}${formatTime(endIso)}`;
}

/** Dag en beginuur, voor een lijst waar het einde er niet toe doet: "di 18 aug · 09:00". */
export function formatDayTime(iso: Moment): string {
  const d = parse(iso);
  if (!d) return t(UNKNOWN_DAY);
  return `${formatDay(iso)}${SEPARATOR}${formatTime(iso)}`;
}

/** De volle vorm van een les: "di 18 aug · 09:00–10:00". */
export function formatDayTimeRange(startIso: Moment, endIso: Moment): string {
  const d = parse(startIso);
  if (!d) return t(UNKNOWN_DAY);
  return `${formatDay(startIso)}${SEPARATOR}${formatTimeRange(startIso, endIso)}`;
}
