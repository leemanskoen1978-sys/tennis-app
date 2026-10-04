// Facturatie — het rekenwerk achter Beheer → Facturatie.
//
// Dit bestand kent geen databank en geen scherm. Het kent lessen, klanten en facturen, en
// het rekent. Daardoor is alles hier te testen zonder Supabase en zonder React.
//
// De veldnamen zijn snake_case en gelijk aan de kolomnamen in FACTURATIE.sql, net zoals
// `Booking` in lib/types dat is. Dat scheelt een vertaallaag tussen scherm en databank, en
// een vertaallaag is precies de plek waar een veld stilletjes verdwijnt.

/**
 * Wie deze schermen mag zien.
 *
 * Eén adres, want dit is de boekhouding van één persoon en geen voorziening van de club.
 * De app is hier niet de bewaker — dat is de RLS in FACTURATIE.sql, die op `auth.uid()`
 * kijkt. Dit zorgt alleen dat het scherm niet aangeboden wordt aan wie er niets te zoeken
 * heeft.
 */
const FACTURATIE_ADRES = 'leemanskoen@telenet.be';

export function magFactureren(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase() === FACTURATIE_ADRES;
}

/**
 * Een naam zoals hij vergeleken wordt: zonder spaties aan de randen, zonder dubbele spaties
 * binnenin, en zonder verschil tussen hoofd- en kleine letters.
 *
 * Verder niets. Geen "begint met", geen gedeeltelijke match: anders zou de clubnaam `RACSO`
 * ook `T.C. RACSO II` vangen, en dan telt een factuur uren van een club die er niet bij
 * hoort.
 */
export function schoon(tekst: string): string {
  return tekst.trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Wanneer zijn twee geplakte regels dezelfde les: club, groep en dag/uur gelijk.
 *
 * Dit is wat een tweede plakbeurt tegenhoudt. Zonder zo'n sleutel komt elke les die je in
 * oktober nog eens plakt er een tweede keer bij, en telt de factuur van september dubbel.
 */
export function sleutelVan(clubTekst: string, groep: string, dagUur: string): string {
  return [schoon(clubTekst), schoon(groep), schoon(dagUur)].join('|');
}

/** Twee decimalen. Elk bedrag en elk urental in dit bestand gaat hier doorheen. */
export function rond2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Een dag verderop, op een datum van de vorm `2026-10-01`.
 *
 * Met `Date.UTC` en niet met een gewone `new Date(tekst)`: een factuurdatum is een dag op de
 * kalender en geen tijdstip, en bij een zomertijdsprong schuift een tijdstip een uur op —
 * genoeg om er een dag naast te zitten.
 */
export function plusDagen(iso: string, dagen: number): string {
  const [j, m, d] = iso.split('-').map(Number);
  const ms = Date.UTC(j, m - 1, d) + dagen * 86_400_000;
  const uit = new Date(ms);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${uit.getUTCFullYear()}-${two(uit.getUTCMonth() + 1)}-${two(uit.getUTCDate())}`;
}

/** De maandnamen zoals ze op de factuur komen; index 0 is januari. */
export const MAANDNAMEN = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December',
] as const;

// ---------------------------------------------------------------------------
// Wat er in de databank staat
// ---------------------------------------------------------------------------

/** Mijn eigen gegevens, zoals ze bovenaan de factuur komen. Er is er precies één van. */
export interface Leverancier {
  id: string;
  naam: string;
  adres: string;
  btw: string;
  iban: string;
  bic: string;
}

/** Waar de uren van een klant vandaan komen. Zie "Twee bronnen" in de spec. */
export type Bron = 'geplakt' | 'app';

/** Een club waaraan gefactureerd wordt. */
export interface Klant {
  id: string;
  klantnaam: string;
  adres: string;
  postcode_gemeente: string;
  btw_nummer: string;
  uurtarief: number;
  korte_naam: string;
  /** Onder welke naam deze club in de geplakte tekst staat — "T.C. RACSO", niet "RACSO". */
  naam_in_lijst: string;
  btw_percentage: number;
  bron_voorkeur: Bron;
  volgorde: number;
}

/** Een geplakte les, of een privéles die met de hand is bijgetikt. */
export type Lesbron = 'geplakt' | 'prive';

export interface Factuurles {
  id: string;
  bron: Lesbron;
  /** De clubnaam zoals hij in de plaktekst stond. Bij een privéles: de korte naam. */
  club_tekst: string;
  aanbod: string;
  doelgroep: string;
  groep: string;
  dag_uur: string;
  trainer: string;
  status: string;
  /** `2026-09-09`. Een dag op de kalender, geen tijdstip. */
  datum: string;
  uren: number;
  /** Met de hand gezet; gaat voor op `uren`. `null` betekent "niets aangepast". */
  uren_handmatig: number | null;
  /** Geschrapt is `false`. De rij blijft bestaan, anders komt ze bij de volgende plakbeurt terug. */
  actief: boolean;
  naam_prive: string;
  type_prive: string;
  sleutel: string;
}

/** Een extra lijn op de factuur, los van het uurtarief. */
export interface VrijeLijn {
  omschrijving: string;
  aantal: number;
  eenheid: string;
  tarief: number;
}

/**
 * Een gemaakte factuur.
 *
 * De klantgegevens staan hier uitgeschreven en niet als verwijzing naar `Klant`: verhuist een
 * club volgend jaar, dan mag een factuur van vorig jaar niet van adres veranderen.
 */
export interface Factuur {
  id: string;
  factuurnr: string;
  klant_naam: string;
  klant_adres: string;
  klant_postcode_gemeente: string;
  klant_btw: string;
  factuurdatum: string;
  vervaldatum: string;
  omschrijving: string;
  dienstmaand: number;
  dienstjaar: number;
  aantal_uren: number;
  uurtarief: number;
  netto: number;
  btw_percentage: number;
  btw_bedrag: number;
  totaal: number;
  vrije_lijnen: VrijeLijn[];
  betaald: boolean;
  betaald_op: string | null;
  opmerking: string;
  aangemaakt: string;
}

/** Alles wat het scherm nodig heeft, in één keer opgehaald. */
export interface FacturatieData {
  leverancier: Leverancier;
  klanten: Klant[];
  lessen: Factuurles[];
  facturen: Factuur[];
}

/** De uren van één les: wat met de hand gezet is, anders wat gerekend is. */
export function urenVan(les: Factuurles): number {
  return les.uren_handmatig ?? les.uren;
}
