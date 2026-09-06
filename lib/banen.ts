// Wanneer is een nieuwe baan een bruikbare baan?
//
// Tot vandaag kon een baan alleen ontstaan door met de hand SQL te schrijven: het scherm
// Beheer → Banen kon een uurtarief en een staffel bijstellen, maar er stond nergens een
// knop om er een bij te maken. De club heeft haar elf banen zo aangemaakt. Deze regels zijn
// wat er sindsdien vóór die knop staat.
//
// Waarom een eigen bestand en niet erbij in lib/payments: payments beantwoordt één vraag —
// wat kost deze les — en rekent daarvoor met een baan die er al is. Dit bestand
// beantwoordt de vraag ervóór: bestaat deze baan straks zonder de rest van de app in de war
// te schoppen. Twee verschillende zorgen, en de huisregel is één regelmodule per zorg (zie
// CONVENTIONS.md); payments zou anders naast geldrekenwerk ook formuliercontrole gaan doen.
//
// Het bedrag wordt hier met `parseEuro` uit lib/money gelezen en niet met een eigen
// parser. Een tweede lezer van hetzelfde veld loopt onvermijdelijk uiteen met de eerste, en
// dan accepteert het formulier een bedrag dat het scherm daarna anders opslaat dan het
// toonde.

import { t } from './i18n';
import { parseEuro } from './money';
import type { Court } from './types';

/**
 * Een baan zoals hij in het formulier staat: alles nog als getypte tekst, behalve het
 * vinkje. Met opzet géén `Omit<Court, 'id'>`, want juist het lezen van dat getypte nummer
 * en dat getypte bedrag is wat hier bewaakt moet worden — een `number` binnenkrijgen zou
 * betekenen dat iemand anders die stap al ongecontroleerd gezet heeft.
 */
export interface NieuweBaan {
  naam: string;
  /** Het baannummer zoals het ingetypt is. */
  nummer: string;
  /** Het uurtarief zoals het ingetypt is; een komma mag, net als overal. */
  uurtarief: string;
  indoor: boolean;
}

/**
 * Het baannummer uit wat er getypt is, of `undefined`.
 *
 * Streng op een heel getal: "1,5" of "2b" is geen baannummer. Het scherm sorteert de banen
 * op dit getal en de club noemt ze zo ook tegen elkaar ("baan 3"), dus alles wat daar niet
 * in past levert een rij op die niemand terugvindt.
 */
export function baanNummer(tekst: string): number | undefined {
  const schoon = tekst.trim();
  if (!/^\d+$/.test(schoon)) return undefined;
  const nummer = Number(schoon);
  // Baan 0 bestaat niet: banen worden vanaf 1 geteld.
  if (nummer < 1) return undefined;
  return nummer;
}

/**
 * Waarom deze nieuwe baan niet klopt, of `null` als hij deugt. Wordt gelezen terwijl iemand
 * nog aan het invullen is, dus de melding is een zin die op het scherm past.
 *
 * Het nummer moet vrij zijn. Twee banen met hetzelfde nummer zijn voor de app twee rijen,
 * maar voor de club één baan: de trainer die "baan 3" boekt kan dan de verkeerde te pakken
 * hebben, en het tarief dat hij op de ene aanpaste geldt niet voor de les op de andere.
 *
 * Wat hier bewust NIET staat is een controle op de naam. Twee banen mogen "Gravel" heten —
 * het nummer is wat ze uit elkaar houdt.
 */
export function baanFout(concept: NieuweBaan, bestaande: Court[]): string | null {
  if (concept.naam.trim().length === 0) return t('Geef de baan een naam.');
  const nummer = baanNummer(concept.nummer);
  if (nummer === undefined) return t('Geef de baan een nummer: een heel getal vanaf 1.');
  if (bestaande.some((c) => c.number === nummer)) {
    return t('Baan {nr} bestaat al.', { nr: nummer });
  }
  if (parseEuro(concept.uurtarief) === undefined) {
    return t('Vul een uurtarief in, bijvoorbeeld 30 of 22,50.');
  }
  return null;
}

/**
 * De baan achter het formulier, of `null` als het nummer of het bedrag niet te lezen is.
 *
 * Zonder staffel: een verse baan rekent haar uurtarief voor elke groepsgrootte, precies
 * zoals de app zich altijd gedroeg. De staffel zet de trainer er daarna op het scherm van
 * die baan zelf bij — hem hier al half laten invullen zou een stap opleveren die meerekent
 * voordat iemand hem afmaakte.
 */
export function leesBaan(concept: NieuweBaan): Omit<Court, 'id'> | null {
  const nummer = baanNummer(concept.nummer);
  const tarief = parseEuro(concept.uurtarief);
  if (nummer === undefined || tarief === undefined) return null;
  return {
    name: concept.naam.trim(),
    number: nummer,
    indoor: concept.indoor,
    hourly_rate: tarief,
  };
}
