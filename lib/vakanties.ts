// Wanneer de club dicht is. De clubkalender van het seizoen, als regel in plaats van als
// papier aan de muur.
//
// Zonder dit rekent de app door alsof er elke week les is: een herhalende reeks van
// september tot mei zet gewoon lessen in de herfstvakantie en op 11 november, en Reserveren
// biedt op die dagen vrije uren aan. Iemand moet die lessen dan één voor één terugvinden en
// schrappen — precies het werk dat een reeks moest besparen.
//
// Een vakantie is een dag op de kalender en geen moment op de klok. Daarom staan de grenzen
// als `jjjj-mm-dd`: die vorm is tijdzoneloos, sorteert vanzelf goed en laat zich met een
// gewone tekstvergelijking aftoetsen. Zie `Vakantie` in lib/types.

import { t } from './i18n';
import { shortMonthName } from './period';
import type { Vakantie } from './types';

/** De dag van een `Date`, als `jjjj-mm-dd` in lokale tijd. */
export function dagSleutel(d: Date): string {
  const two = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

/**
 * Een dag uit een `jjjj-mm-dd`-tekst. Streng: de dag moet echt bestaan, zodat een
 * "2026-11-31" niet stilletjes naar december doorrolt en de vakantie een dag verschuift.
 */
export function parseDag(tekst: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tekst.trim());
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const datum = new Date(y, mo - 1, d);
  if (datum.getFullYear() !== y || datum.getMonth() !== mo - 1 || datum.getDate() !== d) {
    return null;
  }
  return datum;
}

/** De vakanties op volgorde van begindag; wat kapot is valt weg. */
export function sorteerVakanties(vakanties: Vakantie[]): Vakantie[] {
  return vakanties
    .filter((v) => parseDag(v.van) !== null && parseDag(v.tot) !== null)
    .sort((a, b) => a.van.localeCompare(b.van) || a.tot.localeCompare(b.tot));
}

/**
 * De vakantie waarin deze dag valt, of `null`. Beide grenzen tellen mee: een vakantie van
 * 2 tot en met 8 november bevat 2 én 8.
 */
export function vakantieOpDag(vakanties: Vakantie[], dag: string): Vakantie | null {
  return vakanties.find((v) => {
    if (parseDag(v.van) === null || parseDag(v.tot) === null) return false;
    // Omgekeerd ingevuld (tot vóór van) wordt hier gewoon gelezen als het tijdvak ertussen,
    // net als bij een eigen periode in lib/period: iemand die de twee omdraait bedoelt de
    // dagen ertussen, en een vakantie die niets tegenhoudt zou pas echt verwarrend zijn.
    const [van, tot] = v.van <= v.tot ? [v.van, v.tot] : [v.tot, v.van];
    return dag >= van && dag <= tot;
  }) ?? null;
}

/** Idem, voor een `Date`. */
export function vakantieOp(vakanties: Vakantie[], d: Date): Vakantie | null {
  return vakantieOpDag(vakanties, dagSleutel(d));
}

/** Idem, voor het begin van een les (een ISO-tijdstip). De dag telt lokaal, zoals overal. */
export function vakantieOpMoment(vakanties: Vakantie[], iso: string): Vakantie | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return vakantieOp(vakanties, d);
}

/** Valt er op deze dag les te geven? */
export function isLesdag(vakanties: Vakantie[], d: Date): boolean {
  return vakantieOp(vakanties, d) === null;
}

/**
 * Waarom deze vakantie niet klopt, of `null` als hij deugt. Wordt gelezen terwijl iemand
 * nog aan het typen is, dus een half ingevulde datum is geen fout maar "nog niet af".
 */
export function vakantieFout(naam: string, van: string, tot: string): string | null {
  if (naam.trim().length === 0) return t('Geef de vakantie een naam.');
  if (parseDag(van) === null || parseDag(tot) === null) {
    return t('Vul beide dagen in als dd/mm/jjjj.');
  }
  return null;
}

/** Eén dag kort: "2 nov 2026". */
function korteDag(dag: string): string {
  const d = parseDag(dag);
  if (!d) return dag;
  return `${d.getDate()} ${shortMonthName(d.getMonth())} ${d.getFullYear()}`;
}

/**
 * Het tijdvak zoals het op het scherm staat: "2 – 8 nov 2026", of één dag: "11 nov 2026".
 *
 * Los van `Vakantie`, want een trainer heeft dezelfde soort tijdvakken voor zijn afwijkende
 * boekingstijden (zie lib/boekingstijd) en die horen er niet anders uit te zien.
 */
export function periodeTekst(vanDag: string, totDag: string): string {
  const van = parseDag(vanDag);
  const tot = parseDag(totDag);
  if (!van || !tot) return `${vanDag} – ${totDag}`;
  if (vanDag === totDag) return korteDag(vanDag);
  // Binnen dezelfde maand hoeft de maand er maar één keer te staan: "2 – 8 nov 2026".
  const zelfdeMaand = van.getFullYear() === tot.getFullYear() && van.getMonth() === tot.getMonth();
  if (zelfdeMaand) return `${van.getDate()} – ${korteDag(totDag)}`;
  const zelfdeJaar = van.getFullYear() === tot.getFullYear();
  const linker = zelfdeJaar
    ? `${van.getDate()} ${shortMonthName(van.getMonth())}`
    : korteDag(vanDag);
  return `${linker} – ${korteDag(totDag)}`;
}

/** Idem, voor een vakantie. */
export function vakantiePeriode(v: Vakantie): string {
  return periodeTekst(v.van, v.tot);
}

/** Hoeveel dagen deze vakantie beslaat, beide grenzen meegerekend. */
export function vakantieDagen(v: Vakantie): number {
  const van = parseDag(v.van);
  const tot = parseDag(v.tot);
  if (!van || !tot) return 0;
  const [a, b] = van.getTime() <= tot.getTime() ? [van, tot] : [tot, van];
  // Afronden vangt het uur op dat bij een zomertijdwissel in of uit het tijdvak schuift.
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}
