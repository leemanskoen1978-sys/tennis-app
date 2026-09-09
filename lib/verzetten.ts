// Een les verzetten: dezelfde les, een ander moment.
//
// WAAROM DIT GEEN "ANNULEREN EN OPNIEUW BOEKEN" IS. Bij regen schoof een trainer zijn les naar
// de binnenbaan door hem af te zeggen en een nieuwe te maken. Dat is drie keer verkeerd. De
// afgezegde les blijft als geannuleerd in de historiek staan alsof er die dag niets gebeurde,
// de nieuwe les begint op 'Open' — de betaalwijze, de beurt en de aanwezigheid zijn weg — en
// de speler krijgt een annulering te zien voor een les die gewoon doorgaat.
//
// Verzetten raakt daarom exact één veld-paar op de bestaande rij: de begin- en eindtijd, en
// desgewenst de baan. Alles wat eraan hangt blijft eraan hangen, want het is dezelfde les:
// dezelfde betaler, dezelfde deelnemers, dezelfde betaalwijze, dezelfde beurtenkaart, dezelfde
// lesgroep, dezelfde reeks, dezelfde aanwezigheid. Dat is het hele punt.
//
// WIE. Alleen de trainer van de les en de beheerder (besloten op 10 september 2026). Een
// speler ziet de nieuwe tijd verschijnen; hij kan aan een bestaande les sowieso niets
// wijzigen, en zijn agenda door iemand anders laten omgooien is precies wat een trainer niet
// wil. De rechtenvraag zelf staat in lib/rechten (`magVerzetten`).
//
// ÉÉN LES, OOK IN EEN REEKS. Regen op dinsdag is één dinsdag. Hoort de les bij een reeks of
// een lesgroep, dan blijft die staan zoals ze was — dezelfde grens als bij het schrappen van
// één les. Verandert een groep structureel van uur, dan is dat een wijziging aan de lesgroep
// (Beheer → Lesgroepen) en niet een verzetting van dertig losse lessen.
//
// DEZE MODULE VERGELIJKT GEEN TIJDVAKKEN. Of het nieuwe moment botst, beantwoordt `botstMet`
// in lib/recurrence — de enige plek in deze codebase die twee tijdvakken tegen elkaar legt.
// Hier wordt dat antwoord alleen doorgegeven. Zie de kop van lib/botsingen voor waarom dat zo
// streng gescheiden blijft.

import { t } from './i18n';
import { botstMet, type BezetBoeking } from './recurrence';
import { vakantieOpMoment } from './vakanties';
import type { Booking, Vakantie } from './types';

/** De velden van de les die verzet wordt. Meer weet deze module er niet van. */
export type TeVerzettenLes = Pick<
  Booking, 'id' | 'coach_id' | 'court_id' | 'start_time' | 'end_time'
>;

/** Waar de les naartoe moet. */
export interface VerzetVraag {
  /** De nieuwe dag, als 'jjjj-mm-dd' — dezelfde vorm als `Vakantie.van`. */
  dag: string;
  /** Het nieuwe beginuur, als 'HH:MM' — precies wat `keuzeUren()` aanlevert. */
  beginuur: string;
  /** De nieuwe baan. Leeg betekent: dezelfde baan als nu. */
  courtId?: string;
}

/** Wat er nodig is om te beoordelen of het nieuwe moment kan. */
export interface VerzetContext {
  /** Alle lessen, om de botsing te vinden. De les zelf botst nooit met zichzelf. */
  bookings: BezetBoeking[];
  /** De clubkalender: op een gesloten dag geeft niemand les. */
  vakanties: Vakantie[];
}

/** Het antwoord: het kan niet, of het kan — al dan niet met een waarschuwing erbij. */
export type VerzetUitkomst =
  | { ok: false; reden: string }
  | {
    ok: true;
    /** Precies wat er op de rij verandert. Bewust een patch en geen hele boeking. */
    patch: { start_time: string; end_time: string; court_id?: string };
    /**
     * De les waarmee het nieuwe moment overlapt, of `null`. Dit blokkeert niet: sinds
     * 6 september 2026 waarschuwt een overlap altijd en houdt ze nooit tegen — op Terrein 7
     * draait dezelfde trainer blauw en rood naast elkaar. Het scherm verwoordt dit met
     * lib/botsingen en laat de trainer beslissen.
     */
    botsing: BezetBoeking | null;
    /** Staat de les al precies daar? Dan valt er niets te verzetten. */
    ongewijzigd: boolean;
  };

/** 'jjjj-mm-dd' plus 'HH:MM' als moment op de klok van hier. Streng: geen doorrollende datums. */
function momentVan(dag: string, beginuur: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dag.trim());
  const u = /^(\d{2}):(\d{2})$/.exec(beginuur.trim());
  if (!d || !u) return null;

  const jaar = Number(d[1]);
  const maand = Number(d[2]);
  const dagnr = Number(d[3]);
  const uur = Number(u[1]);
  const minuut = Number(u[2]);
  if (uur > 23 || minuut > 59) return null;

  const moment = new Date(jaar, maand - 1, dagnr, uur, minuut, 0, 0);
  // "2026-02-30" mag niet stilletjes naar maart doorrollen — zelfde strengheid als
  // `parseUntil` in lib/recurrence, en om dezelfde reden: dan staat de les op een dag die
  // niemand bedoelde.
  if (moment.getFullYear() !== jaar || moment.getMonth() !== maand - 1
    || moment.getDate() !== dagnr) return null;
  return moment;
}

/**
 * Wat er gebeurt als je deze les naar dit moment verzet.
 *
 * Rekent niets weg en schrijft niets: het geeft de patch terug die de provider zou moeten
 * doorvoeren, plus de waarschuwing die de trainer eerst hoort te lezen. Zo kan het
 * bevestigingsscherm precies tonen wat er staat te gebeuren voordat er iets gebeurt.
 *
 * De lesduur gaat mee en wordt niet opnieuw uitgerekend. Een les van negentig minuten blijft
 * negentig minuten, ook als de club op zestig staat: die duur is ooit bewust zo gezet en het
 * verzetten van een uur is niet het moment om daar stilletjes van af te wijken.
 */
export function verzetPlan(
  les: TeVerzettenLes,
  vraag: VerzetVraag,
  context: VerzetContext,
): VerzetUitkomst {
  const start = momentVan(vraag.dag, vraag.beginuur);
  if (!start) return { ok: false, reden: t('Kies een geldige dag en een geldig uur.') };

  const oudeStart = new Date(les.start_time).getTime();
  const oudeEind = new Date(les.end_time).getTime();
  if (!Number.isFinite(oudeStart) || !Number.isFinite(oudeEind) || oudeEind <= oudeStart) {
    // Zonder leesbare tijden is de duur niet te bewaren, en een les met een verzonnen duur
    // is erger dan een les die blijft staan waar hij stond.
    return { ok: false, reden: t('De tijden van deze les zijn onleesbaar.') };
  }
  const duurMs = oudeEind - oudeStart;
  const eind = new Date(start.getTime() + duurMs);

  const start_time = start.toISOString();
  const end_time = eind.toISOString();
  const court_id = vraag.courtId ?? les.court_id;

  // De vakantie eerst: is de club dicht, dan doet het er niet toe of de trainer dan vrij was.
  // Dit weigert wél, anders dan een botsing: de club is dicht is geen afweging.
  const vakantie = vakantieOpMoment(context.vakanties, start_time);
  if (vakantie) {
    return {
      ok: false,
      reden: t('{vakantie}: de club geeft die dag geen les.', { vakantie: vakantie.naam }),
    };
  }

  const ongewijzigd = start.getTime() === oudeStart && court_id === les.court_id;

  return {
    ok: true,
    patch: court_id === les.court_id
      ? { start_time, end_time }
      : { start_time, end_time, court_id },
    // De les zelf telt niet mee: hij staat nog op zijn oude moment in de lijst, en met
    // zichzelf botsen zou elke verzetting een waarschuwing geven.
    botsing: botstMet(
      { start_time, end_time },
      context.bookings,
      { coachId: les.coach_id, courtId: court_id, negeer: new Set([les.id]) },
    ),
    ongewijzigd,
  };
}
