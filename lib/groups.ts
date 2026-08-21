// Groepslessen: één les, meerdere spelers, één betaler.
//
// Alles wat "wie doet er mee aan deze les" beantwoordt staat hier, en nergens anders. De
// verleiding is groot om op een scherm even `b.participant_ids?.length` te tellen, maar dan
// telt het ene scherm een dubbele naam wel mee en het andere niet — en gaat de prijs op de
// boekingskaart afwijken van de prijs in het rapport.
//
// De betaler (`Booking.player_id`) telt altijd mee als speler. Hij staat niet in
// `participant_ids`: daar staan de anderen. Zie de toelichting bij `Booking` in lib/types.

import { t } from './i18n';
import type { Booking } from './types';

/** De velden die een vraag over de groep nodig heeft; meer weet dit bestand niet van een les. */
export type GroupBooking = Pick<Booking, 'player_id' | 'participant_ids'>;

/**
 * De extra deelnemers, opgeschoond: lege ids weg, dubbels weg, en de betaler eruit als hij
 * er per ongeluk óók in staat. Zonder dat opschonen zou een speler die twee keer aangeklikt
 * werd de les een tariefstap duurder maken.
 *
 * De volgorde blijft zoals de trainer ze koos — dat is de volgorde die hij op het scherm
 * terugziet.
 */
export function participantIdsOf(b: GroupBooking): string[] {
  const seen = new Set<string>([b.player_id]);
  const out: string[] = [];
  for (const id of b.participant_ids ?? []) {
    if (typeof id !== 'string') continue;
    const trimmed = id.trim();
    if (trimmed === '' || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/**
 * Hoeveel spelers er op de baan staan: de betaler plus de extra deelnemers. Altijd minstens
 * 1 — een les zonder speler bestaat niet.
 *
 * Een deelnemer die niet meer in de ledenlijst staat telt gewoon mee. Hij stond er die dag
 * wél bij, en een verwijderd account hoort de prijs van een gegeven les niet met
 * terugwerkende kracht te veranderen. Op de schermen heet hij dan "Onbekend", net als een
 * verdwenen speler of trainer elders in de app.
 */
export function groupSize(b: GroupBooking): number {
  return 1 + participantIdsOf(b).length;
}

/** Een groepsles is een les met meer dan één speler op de baan. */
export function isGroupLesson(b: GroupBooking): boolean {
  return groupSize(b) > 1;
}

/** Alle spelers van de les, de betaler voorop. */
export function lessonPlayerIds(b: GroupBooking): string[] {
  return [b.player_id, ...participantIdsOf(b)];
}

/**
 * Doet deze speler mee aan deze les — als betaler of als deelnemer? Eén regel voor elk
 * scherm dat "mijn lessen" toont, zodat een deelnemer zijn les overal terugziet en niet
 * alleen op het scherm waar iemand eraan dacht.
 */
export function playsIn(b: GroupBooking, playerId: string): boolean {
  return b.player_id === playerId || participantIdsOf(b).includes(playerId);
}

/**
 * De korte vorm op een leskaart: "Mathis" bij één speler, "Mathis +2" bij een groep van drie.
 * De naam is die van de betaler — hij is de speler die de les op zijn naam heeft staan — en
 * het getal zegt hoeveel er nog bij staan. Wie dat precies zijn, staat in het detailblad.
 */
export function shortGroupLabel(payerName: string, size: number): string {
  return size > 1 ? `${payerName} +${size - 1}` : payerName;
}

/** "3 spelers" / "1 speler" — de telling in woorden, voor onder een titel of in een hint. */
export function groupSizeLabel(size: number): string {
  return size === 1 ? t('1 speler') : t('{n} spelers', { n: size });
}
