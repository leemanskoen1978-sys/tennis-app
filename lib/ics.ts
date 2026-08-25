// De lessen als agendabestand (.ics), om in Outlook, Google Agenda of Apple Agenda te laden.
//
// Het belangrijkste aan dit bestand is niet dat het afspraken maakt, maar dat het er geen
// dubbele maakt. Wie zijn lessen vandaag inleest en volgende week opnieuw, wil geen tweede
// rij van dezelfde afspraken naast de eerste. Een agenda herkent een afspraak aan zijn UID,
// en die is hier het id van de boeking zelf: dezelfde les krijgt bij elke export dezelfde
// UID, dus de tweede invoer wérkt de eerste bij in plaats van ernaast te gaan staan.
//
// Daar hoort SEQUENCE bij. Een agenda neemt een wijziging alleen aan als het volgnummer
// hoger ligt dan wat er al staat; blijft dat op 0 staan, dan houdt Outlook de oude tijd vast
// en lijkt de export stuk. Het nummer telt daarom de minuten sinds 2020 op het moment van
// exporteren: elke nieuwe export ligt hoger dan de vorige, zonder dat er ergens een teller
// bewaard hoeft te worden.
//
// De vorm volgt RFC 5545: CRLF tussen de regels, regels van hoogstens 75 tekens, en tekst
// waarin een komma, een puntkomma, een backslash of een regeleinde ontsnapt wordt.
//
// In de afspraak staat alleen wat je in je agenda nodig hebt: wanneer, met wie, en waar.
// De betaalwijze en de notities stonden er eerst bij en zijn er weer uit — dat leest niemand
// terug in Outlook, het staat in de app zelf, en een omschrijving die niemand leest maakt de
// afspraak in een weekbeeld alleen maar onleesbaar.

import { groupSize, shortGroupLabel } from './groups';
import { t } from './i18n';
import type { Booking, Court, User } from './types';

/** Het einde van een regel in een ics-bestand. Geen losse \n: sommige lezers slikken dat niet. */
const CRLF = '\r\n';

/**
 * Het domein achter de UID. Hoeft niet te bestaan — het hoort er alleen voor te zorgen dat
 * een id van deze app niet botst met een id uit een ander programma.
 */
const UID_DOMEIN = 'tennis-app';

/** Het nulpunt van het volgnummer. Zie de uitleg bovenaan. */
const SEQUENCE_NULPUNT = Date.UTC(2020, 0, 1);

/** Wat een export nodig heeft om er namen bij te zoeken. */
export interface IcsContext {
  users: User[];
  courts: Court[];
  /** Wie het bestand maakt. Bepaalt wiens naam er in de titel komt te staan. */
  viewerIsCoach: boolean;
}

/**
 * Een tijdstip in de vorm die een ics-bestand wil: `20260825T090000Z`.
 *
 * In UTC, met de Z erachter. Dat is de enige vorm die zonder tijdzonetabel eenduidig is —
 * een lokale tijd zou een VTIMEZONE-blok vragen, en dan hangt het van de lezer af of een
 * les in de winter een uur verschuift.
 */
export function icsMoment(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const two = (n: number): string => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}`
    + `T${two(d.getUTCHours())}${two(d.getUTCMinutes())}${two(d.getUTCSeconds())}Z`;
}

/**
 * Tekst zoals hij in een veld mag staan. Een komma of een puntkomma zou anders het veld in
 * tweeën knippen — een notitie als "meenemen: ballen, netje" zou de helft van de afspraak
 * kunnen wegvagen.
 */
export function icsTekst(waarde: string): string {
  return waarde
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Een regel opvouwen op 75 tekens, met een spatie aan het begin van elk vervolg. Lange
 * notities of terreinnamen maken een regel anders te lang, en strenge lezers slaan zo'n
 * afspraak in zijn geheel over.
 */
export function vouw(regel: string): string {
  if (regel.length <= 75) return regel;
  const delen: string[] = [regel.slice(0, 75)];
  for (let i = 75; i < regel.length; i += 74) {
    delen.push(` ${regel.slice(i, i + 74)}`);
  }
  return delen.join(CRLF);
}

/** Het volgnummer van deze export: hoger dan dat van elke vorige. Zie de uitleg bovenaan. */
export function icsSequence(now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - SEQUENCE_NULPUNT) / 60000));
}

/**
 * De titel van de afspraak. Je eigen naam hoef je niet te lezen: een trainer ziet de speler,
 * een speler de trainer — dezelfde regel als op de leskaarten en in het weekraster.
 */
function titel(b: Booking, ctx: IcsContext): string {
  const naamVan = (id: string): string =>
    ctx.users.find((u) => u.id === id)?.name ?? t('Onbekend');
  const ander = ctx.viewerIsCoach
    ? shortGroupLabel(naamVan(b.player_id), groupSize(b))
    : naamVan(b.coach_id);
  return t('Tennisles met {ander}', { ander });
}

/** Eén les als VEVENT-blok. */
function event(b: Booking, ctx: IcsContext, now: Date): string[] {
  const terrein = ctx.courts.find((c) => c.id === b.court_id)?.name ?? '';
  return [
    'BEGIN:VEVENT',
    // Dezelfde les geeft bij elke export dezelfde UID — dát houdt de agenda dubbelvrij.
    `UID:${b.id}@${UID_DOMEIN}`,
    `SEQUENCE:${icsSequence(now)}`,
    `DTSTAMP:${icsMoment(now)}`,
    `DTSTART:${icsMoment(b.start_time)}`,
    `DTEND:${icsMoment(b.end_time)}`,
    `SUMMARY:${icsTekst(titel(b, ctx))}`,
    ...(terrein ? [`LOCATION:${icsTekst(terrein)}`] : []),
    'END:VEVENT',
  ];
}

/**
 * De lessen als agendabestand. Geannuleerde lessen gaan niet mee: die komen niet meer, dus
 * ze horen niet in de agenda die je hierna opent.
 */
export function toIcs(bookings: Booking[], ctx: IcsContext, now: Date = new Date()): string {
  const meegaan = bookings.filter((b) => b.status !== 'cancelled');
  const regels = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${UID_DOMEIN}//NL`,
    'CALSCALE:GREGORIAN',
    // PUBLISH en geen REQUEST: dit is een lijst om te lezen, geen uitnodiging waarop iemand
    // moet antwoorden. Bij REQUEST stuurt Outlook een acceptatiemail naar de organisator.
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsTekst(t('Tennislessen'))}`,
    ...meegaan.flatMap((b) => event(b, ctx, now)),
    'END:VCALENDAR',
  ];
  // De afsluitende CRLF hoort erbij: een bestand dat op een halve regel eindigt wordt door
  // strenge lezers afgekeurd.
  return `${regels.map(vouw).join(CRLF)}${CRLF}`;
}

/**
 * De bestandsnaam. De dag van de export staat erin, want in een map met downloads is
 * "lessen.ics" naast "lessen (3).ics" niets waard — net als bij `periodFilename`.
 */
export function icsFilename(now: Date = new Date()): string {
  const two = (n: number): string => String(n).padStart(2, '0');
  return `tennislessen-${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}.ics`;
}
