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

/**
 * Het ISO-weeknummer van een dag: 1 tot en met 52 of 53, of `null` als de datum onbruikbaar is.
 *
 * De jaarwissel staat hier apart genoemd omdat een zelfgeschreven weeknummer daar altijd
 * misgaat: 1 januari 2027 hoort bij week 53 van 2026 en 31 december 2025 bij week 1 van 2026.
 * De regel die dat oplost: de week van een dag is de week van de donderdag ernaast, en week 1
 * is de week waarin 4 januari valt.
 *
 * Gerekend op de kalenderdag zoals je hem op de klok ziet en niet op UTC — dezelfde reden als
 * bij `datumNaarSerie` in `lib/xlsx.ts`: een les van 's avonds laat hoort niet in de week
 * ervoor te belanden.
 */
export function isoWeeknummer(iso: Moment): number | null {
  const d = parse(iso);
  if (!d) return null;

  // Zondag komt uit getDay() als 0; in de ISO-week is hij dag 7, de laatste.
  const dagInWeek = d.getDay() === 0 ? 7 : d.getDay();
  // Naar de donderdag van dezelfde week: die donderdag bepaalt bij welk jaar de week hoort.
  const donderdag = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (4 - dagInWeek));
  // 4 januari zit per definitie in week 1, dus tellen we de weken vanaf die week.
  const vierJanuari = new Date(donderdag.getFullYear(), 0, 4);
  const dagInWeekVanVier = vierJanuari.getDay() === 0 ? 7 : vierJanuari.getDay();
  const eersteMaandag = new Date(
    vierJanuari.getFullYear(),
    0,
    4 - (dagInWeekVanVier - 1),
  );

  // Over de dagen tellen en niet over de milliseconden: een zomertijdsprong maakt een dag
  // 23 of 25 uur lang, en dan valt een deling op 24 uur net verkeerd uit.
  const dagen = Math.round(
    (Date.UTC(donderdag.getFullYear(), donderdag.getMonth(), donderdag.getDate())
      - Date.UTC(eersteMaandag.getFullYear(), eersteMaandag.getMonth(), eersteMaandag.getDate()))
    / 86_400_000,
  );
  return Math.floor(dagen / 7) + 1;
}
