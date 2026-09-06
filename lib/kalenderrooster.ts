// Het maandrooster van een datumkiezer: welke dagen staan er in welk vakje.
//
// WAAROM DIT IN lib/ STAAT EN NIET IN HET COMPONENT. Een maandrooster is rekenwerk dat er
// eenvoudig uitziet en het niet is: de eerste van de maand valt op een willekeurige weekdag,
// februari heeft soms 29 dagen, en een maand kan over vijf of zes weken lopen. Dat soort fouten
// zie je niet aan het scherm — je ziet een rooster dat er goed uitziet en waarin één dag op de
// verkeerde plek staat. Hier valt het te testen zonder één druk op een knop.
//
// De week begint op maandag. Dat is de leesvolgorde van de club, dezelfde als `DISPLAY_DAY_ORDER`
// in lib/slots; `Date#getDay` telt zondag als 0 en dat blijft de opslagvolgorde.
//
// Alle datums worden opgebouwd uit lokale jaar-, maand- en dagvelden. Nooit uit een ISO-tekst:
// die is in UTC gerenderd, en dan schuift een dag in een westelijke tijdzone een vakje op.

import { parseDayInput } from './period';

/** Een maand om te tonen. `maand` is 0-11, net als `Date#getMonth`. */
export interface Maand {
  jaar: number;
  maand: number;
}

/**
 * De vakjes van één maand, rij per rij, met maandag vooraan.
 *
 * De lege vakjes vóór de eerste en ná de laatste zijn `null` en geen dag uit de buurmaand. Een
 * grijze 30 april naast 1 mei nodigt uit om erop te klikken, en dan kiest iemand een dag in een
 * maand die hij niet aan het bekijken is.
 *
 * Elke rij is altijd zeven vakjes lang; het rooster is vijf of zes rijen, afhankelijk van de
 * maand. Er worden geen rijen bijgevuld om er altijd zes te maken: een lege rij onderaan is
 * ruimte die niets zegt.
 */
export function maandRooster({ jaar, maand }: Maand): Array<Array<Date | null>> {
  const eerste = new Date(jaar, maand, 1);
  // `getDay` geeft zondag = 0; met maandag vooraan schuift alles één op en wordt zondag 6.
  const voorloop = (eerste.getDay() + 6) % 7;
  const dagenInMaand = new Date(jaar, maand + 1, 0).getDate();

  const vakjes: Array<Date | null> = [];
  for (let i = 0; i < voorloop; i++) vakjes.push(null);
  for (let d = 1; d <= dagenInMaand; d++) vakjes.push(new Date(jaar, maand, d));
  while (vakjes.length % 7 !== 0) vakjes.push(null);

  const rijen: Array<Array<Date | null>> = [];
  for (let i = 0; i < vakjes.length; i += 7) rijen.push(vakjes.slice(i, i + 7));
  return rijen;
}

/**
 * Een maand vooruit of achteruit, zonder ooit een dag 31 in een maand van 30 te laten belanden.
 *
 * `new Date(2026, 0, 31)` een maand vooruit zetten met `setMonth` geeft 3 maart: de 31e februari
 * bestaat niet en JavaScript telt gewoon door. Hier wordt alleen met jaar en maand gerekend, dus
 * dat kan niet gebeuren.
 */
export function verschuifMaand({ jaar, maand }: Maand, stappen: number): Maand {
  const totaal = jaar * 12 + maand + stappen;
  return { jaar: Math.floor(totaal / 12), maand: ((totaal % 12) + 12) % 12 };
}

/**
 * Welke maand de kiezer opent: die van wat er al staat, en anders die van vandaag.
 *
 * Dit is de reden dat de gebruiker erom vroeg — "starten met de datum van vandaag". Wie het veld
 * al ingevuld heeft en de kalender opent om te corrigeren, wil de maand zien die hij koos en niet
 * terugvallen op vandaag; wie begint met een leeg veld heeft aan vandaag het meeste.
 *
 * Een half getypte datum telt als leeg. Iemand die "09/" heeft staan is nog bezig, en hem naar
 * januari van het jaar 9 sturen is erger dan hem bij vandaag te laten beginnen.
 */
export function beginmaand(waarde: string, vandaag: Date): Maand {
  const gekozen = parseDayInput(waarde);
  const dag = gekozen ?? vandaag;
  return { jaar: dag.getFullYear(), maand: dag.getMonth() };
}

/** Zijn dit dezelfde kalenderdag? Op jaar, maand en dag — nooit op de klok. */
export function zelfdeDag(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

/** De Nederlandse maandnamen, 0-11 zoals `Date#getMonth` ze telt. */
export const MAANDNAMEN = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
] as const;

/**
 * De kop boven het rooster: "september 2026".
 *
 * Gaat niet door `t()`, om dezelfde reden als de groepsnamen van de import: dit hoort bij de
 * datum die de club invult en niet bij de schermtaal. Wie de app op Engels zet, ziet zijn eigen
 * kalender niet ineens van naam veranderen terwijl het veld eronder nog dd/mm/jjjj verwacht.
 */
export function maandLabel({ jaar, maand }: Maand): string {
  return `${MAANDNAMEN[maand]} ${jaar}`;
}
