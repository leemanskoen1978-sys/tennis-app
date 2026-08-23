// De weekagenda: hoeveel uur staat er deze week echt geboekt, en op welke dag.
//
// "Effectief" is hier het hele punt. Een maandtotaal zegt een trainer weinig over de week
// die voor hem ligt; het aantal lessen zegt niets over hoe vol een dag is, want een les van
// een half uur en een les van twee uur tellen daarin even zwaar. Dus telt dit bestand
// minuten, en telt het alleen wat doorgaat: een geannuleerde les kost geen uur op de baan,
// dus hij staat niet in de lijst en hij zit niet in het totaal. Dezelfde streep die
// `countedBookings` in lib/reports trekt.
//
// De week zelf is géén nieuw periodebegrip: hij is een `Period` van lib/period, gebouwd met
// `customPeriod`. Daardoor bladert `shiftPeriod(week, ±1)` er vanzelf precies zeven dagen
// mee op en schrijft `periodLabel` hem uit — anders stond er hier een tweede soort periode
// naast de eerste, met zijn eigen bladeren en zijn eigen opschrift.

import { customPeriod, isInPeriod, type Period } from './period';
import { bookingMinutes } from './payments';
import { t, currentLocale } from './i18n';
import type { Booking } from './types';

/** Hoeveel dagen een week telt. Staat hier als naam, niet als losse 7 tussen het rekenwerk. */
const DAGEN_PER_WEEK = 7;

/** Eén dag van de week, ook als er niets op staat. */
export interface WeekDag {
  /** Het begin van de dag, lokale tijd. */
  dag: Date;
  /** De lessen die op deze dag beginnen, geannuleerde niet meegerekend, op tijd oplopend. */
  bookings: Booking[];
  /** De opgetelde duur van die lessen, in minuten. */
  minuten: number;
}

/**
 * De week waarin `d` valt: maandag tot en met zondag.
 *
 * Maandag als eerste dag omdat een lesweek zo loopt; `getDay()` telt zondag als 0, vandaar
 * de omrekening. De grenzen komen van `customPeriod`, dus van middernacht tot een
 * milliseconde vóór de volgende middernacht — een les van 23:30 op zondag hoort er nog bij.
 */
export function weekPeriod(d: Date = new Date()): Period {
  const verschuiving = (d.getDay() + 6) % 7;
  const maandag = new Date(d.getFullYear(), d.getMonth(), d.getDate() - verschuiving);
  const zondag = new Date(
    maandag.getFullYear(), maandag.getMonth(), maandag.getDate() + DAGEN_PER_WEEK - 1,
  );
  return customPeriod(maandag, zondag);
}

/** Beslaat deze periode precies de week waarin `now` valt? Voor de knop "Deze week". */
export function isDezeWeek(p: Period, now: Date = new Date()): boolean {
  const deze = weekPeriod(now);
  return p.from.getTime() === deze.from.getTime() && p.to.getTime() === deze.to.getTime();
}

/**
 * De zeven dagen van de week, met de lessen en de minuten per dag.
 *
 * Lege dagen blijven staan. Ze wegfilteren zou de week korter maken dan hij is, en juist
 * het gat op donderdag is iets wat je wilt zien als je naar je week kijkt.
 */
export function weekAgenda(bookings: Booking[], week: Period): WeekDag[] {
  const telt = bookings.filter(
    (b) => b.status !== 'cancelled' && isInPeriod(b.start_time, week),
  );

  return Array.from({ length: DAGEN_PER_WEEK }, (_, i) => {
    const dag = new Date(
      week.from.getFullYear(), week.from.getMonth(), week.from.getDate() + i,
    );
    const vanDeDag = telt
      .filter((b) => {
        // Lokaal vergelijken, net als `bookingsOnDay` in lib/hub: een les hoort bij de dag
        // zoals je hem op de klok ziet.
        const s = new Date(b.start_time);
        return s.getFullYear() === dag.getFullYear()
          && s.getMonth() === dag.getMonth()
          && s.getDate() === dag.getDate();
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    return {
      dag,
      bookings: vanDeDag,
      minuten: vanDeDag.reduce((som, b) => som + bookingMinutes(b), 0),
    };
  });
}

/** De minuten van de hele week. */
export function weekMinuten(dagen: WeekDag[]): number {
  return dagen.reduce((som, d) => som + d.minuten, 0);
}

/** Het aantal lessen van de hele week. */
export function weekLessen(dagen: WeekDag[]): number {
  return dagen.reduce((som, d) => som + d.bookings.length, 0);
}

/**
 * Minuten als uren op het scherm: "3 u", "1,5 u", "12,5 u". Eén cijfer achter de komma —
 * een lesuur loopt in halven en kwarten, en "2,25 u" leest niemand als "twee uur en een
 * kwartier". De komma komt van de taal, dus in het Engels staat er "12.5 h".
 */
export function formatUren(minuten: number): string {
  const uren = minuten / 60;
  return t('{uren} u', {
    uren: uren.toLocaleString(currentLocale(), { maximumFractionDigits: 1 }),
  });
}
