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

// ── Het raster ───────────────────────────────────────────────────────────────────────────
//
// Een lijst per dag zegt wél hoeveel uur er staat, maar niet hoe die uren liggen: drie
// lessen op een rij en drie lessen met twee gaten ertussen zien er identiek uit. Daarom
// tekent het weekscherm een raster met een uren-as, en dat vraagt om twee dingen die geen
// opmaak zijn en dus hier horen: waar een les op de as begint en eindigt, en wat er moet
// gebeuren als er twee tegelijk lopen.

/** De uren die altijd op de as staan, ook in een lege week: een lesdag van 8 tot 22 uur. */
const AS_BEGIN_UUR = 8;
const AS_EIND_UUR = 22;
const MINUTEN_PER_DAG = 24 * 60;

/** Eén les als blok in het raster. */
export interface Blok {
  booking: Booking;
  /** Minuten sinds middernacht op de dag zelf. */
  van: number;
  /** Idem; een les die over middernacht heen loopt stopt hier op 24:00. */
  tot: number;
  /** De kolom binnen de dag: 0 is links. Alleen anders dan 0 bij lessen die overlappen. */
  baan: number;
  /** Hoeveel banen er in zijn groep naast elkaar staan; samen vullen ze de dagkolom. */
  banen: number;
}

/** Eén dagkolom van het raster. */
export interface RoosterDag extends WeekDag {
  blokken: Blok[];
}

/** De week als raster: zeven kolommen en de uren-as waarop ze getekend worden. */
export interface Rooster {
  dagen: RoosterDag[];
  /** Het eerste uur op de as (0–23). */
  vanUur: number;
  /** Het uur waar de as stopt; het laatste hokje loopt tot hier. */
  totUur: number;
}

function minutenOpDag(iso: string, dag: Date): number {
  const d = new Date(iso);
  // Een les die de vorige dag begon of de volgende dag eindigt, wordt afgeknipt op de rand
  // van deze dag: het blok hoort in deze kolom te blijven staan.
  const verschil = (d.getTime() - dag.getTime()) / 60000;
  if (!Number.isFinite(verschil)) return 0;
  return Math.max(0, Math.min(MINUTEN_PER_DAG, Math.round(verschil)));
}

/**
 * Twee lessen tegelijk op twee banen zijn geen fout — een club heeft meer dan één terrein.
 * Ze mogen dus niet over elkaar heen komen te staan. Elke groep lessen die elkaar raakt
 * wordt verdeeld over banen: de eerste vrije baan wint, en iedereen in de groep krijgt
 * hetzelfde aantal banen mee zodat de blokken even breed zijn en de kolom precies vullen.
 */
function legBanen(blokken: Blok[]): void {
  let groep: Blok[] = [];
  let groepEind = -1;
  // Per baan: waar de laatste les erop eindigde.
  let banenEind: number[] = [];

  const sluit = (): void => {
    for (const b of groep) b.banen = banenEind.length;
    groep = [];
    banenEind = [];
    groepEind = -1;
  };

  for (const blok of blokken) {
    // Raakt dit blok niets meer van de vorige groep, dan staat die groep vast.
    if (blok.van >= groepEind) sluit();

    let baan = banenEind.findIndex((eind) => eind <= blok.van);
    if (baan === -1) {
      banenEind.push(blok.tot);
      baan = banenEind.length - 1;
    } else {
      banenEind[baan] = blok.tot;
    }
    blok.baan = baan;
    groep.push(blok);
    groepEind = Math.max(groepEind, blok.tot);
  }
  sluit();
}

/**
 * De week als raster. De as loopt standaard van 8 tot 22 uur — een lesdag — en rekt alleen
 * op als er die week echt vroeger of later les is. Vast van middernacht tot middernacht zou
 * de helft van het scherm aan lege nacht kwijt zijn; alleen de bezette uren tonen laat het
 * raster juist per week van vorm veranderen, en dan zegt de hoogte van een blok niets meer.
 */
export function weekRooster(dagen: WeekDag[]): Rooster {
  const kolommen: RoosterDag[] = dagen.map((d) => {
    const blokken: Blok[] = d.bookings.map((booking) => ({
      booking,
      van: minutenOpDag(booking.start_time, d.dag),
      tot: minutenOpDag(booking.end_time, d.dag),
      baan: 0,
      banen: 1,
    }))
      // Een les zonder duur (of met een kapotte eindtijd) zou een blok van nul hoog worden
      // en dus onzichtbaar zijn; hij krijgt de minimale hoogte van een kwartier.
      .map((b) => ({ ...b, tot: Math.max(b.tot, Math.min(b.van + 15, MINUTEN_PER_DAG)) }))
      .sort((a, b) => (a.van - b.van) || (a.tot - b.tot));
    legBanen(blokken);
    return { ...d, blokken };
  });

  const alle = kolommen.flatMap((k) => k.blokken);
  const vanUur = alle.reduce(
    (vroegst, b) => Math.min(vroegst, Math.floor(b.van / 60)), AS_BEGIN_UUR,
  );
  const totUur = alle.reduce(
    (laatst, b) => Math.max(laatst, Math.ceil(b.tot / 60)), AS_EIND_UUR,
  );

  return { dagen: kolommen, vanUur, totUur };
}
