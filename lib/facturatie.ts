// Facturatie — het rekenwerk achter Beheer → Facturatie.
//
// Dit bestand kent geen databank en geen scherm. Het kent lessen, klanten en facturen, en
// het rekent. Daardoor is alles hier te testen zonder Supabase en zonder React.
//
// De veldnamen zijn snake_case en gelijk aan de kolomnamen in FACTURATIE.sql, net zoals
// `Booking` in lib/types dat is. Dat scheelt een vertaallaag tussen scherm en databank, en
// een vertaallaag is precies de plek waar een veld stilletjes verdwijnt.

import { lesgeverId } from './lesgever';

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
 * Waarmee de drie velden van een sleutel gescheiden worden: U+001F, "unit separator".
 *
 * Een gewoon leesteken zou botsen. Met een streepje krijgen ("A|B", "C", "D") en
 * ("A", "B|C", "D") dezelfde sleutel, en dan houdt de ontdubbeling twee verschillende
 * lessen voor één en verdwijnt er één van de factuur — precies het omgekeerde van waarvoor
 * de sleutel bestaat. U+001F komt in geplakte tekst niet voor.
 *
 * Niet U+0000, hoe verleidelijk ook: Postgres weigert dat teken in een tekstkolom, en deze
 * sleutel gaat de databank in.
 */
const VELDSCHEIDER = '\u001f';

/**
 * Wanneer zijn twee geplakte regels dezelfde les: club, groep en dag/uur gelijk.
 *
 * Dit is wat een tweede plakbeurt tegenhoudt. Zonder zo'n sleutel komt elke les die je in
 * oktober nog eens plakt er een tweede keer bij, en telt de factuur van september dubbel.
 */
export function sleutelVan(clubTekst: string, groep: string, dagUur: string): string {
  return [schoon(clubTekst), schoon(groep), schoon(dagUur)].join(VELDSCHEIDER);
}

/**
 * Twee decimalen. Elk bedrag en elk urental in dit bestand gaat hier doorheen.
 *
 * Niet `Math.round(n * 100) / 100`: 35,855 ligt als binair getal nét ónder 35,855, en dan
 * wordt het 35,85 terwijl iedereen 35,86 verwacht. Op een factuur is dat de cent waar de
 * optelling van wie het natelt op strandt. De speling van een miljardste vangt dat op; ze
 * is absoluut en niet relatief, en bij bedragen van deze grootte is dat ruim genoeg.
 *
 * Een half bedrag gaat van nul wég, ook met een minteken ervoor: -1,005 wordt -1,01 en
 * niet -1,00. Zo is afronden dezelfde bewerking aan beide kanten van nul.
 */
export function rond2(n: number): number {
  const teken = n < 0 ? -1 : 1;
  return (teken * Math.round(Math.abs(n) * 100 + 1e-9)) / 100;
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

/**
 * De maandnamen zoals ze op de factuur komen; index 0 is januari.
 *
 * Een eigen lijst naast die in lib/kalenderrooster en `monthName` in lib/period, om
 * dezelfde reden als daar: een factuur is een Belgisch document en blijft Nederlands, ook
 * als iemand de app op Engels zet. Zou hij door `t()` gaan, dan stond er "Invoice for
 * September" op een factuur aan een Gentse vzw.
 */
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

// ---------------------------------------------------------------------------
// Uren tellen
// ---------------------------------------------------------------------------

/** Valt deze datum (`2026-09-09`) in deze maand? */
function inMaand(datum: string, maand: number, jaar: number): boolean {
  const two = String(maand).padStart(2, '0');
  return datum.startsWith(`${jaar}-${two}-`);
}

export interface ClubUren {
  klant: Klant;
  /** Wat de geplakte lijst voor deze club zegt. */
  urenGeplakt: number;
  /** De privélessen die met de hand bijgetikt zijn. Tellen altijd mee, bij beide bronnen. */
  urenPrive: number;
}

/**
 * Per klant de uren van één maand, uit de geplakte lijst en uit de privélessen.
 *
 * De volgorde van het antwoord is die van `volgorde` op de klant, niet die van de lijst die
 * binnenkwam: het scherm zet de kaarten eronder en die horen altijd in dezelfde volgorde te
 * staan. Bij gelijke `volgorde` blijft de binnengekomen volgorde staan, want `sort` is
 * stabiel.
 *
 * Aangenomen wordt dat `naam_in_lijst` en `korte_naam` uniek zijn over alle klanten. Staan
 * er twee klanten met dezelfde naam, dan krijgen ze allebei dezelfde uren en wordt er
 * dubbel gefactureerd. Dat wordt hier niet tegengehouden maar in het instellingenscherm
 * gemeld: hier weten we niet of het een vergissing is of niet, en een telling hoort geen
 * rijen te laten verdwijnen die iemand bewust zo heeft gezet.
 */
export function urenPerClub(
  lessen: readonly Factuurles[],
  klanten: readonly Klant[],
  maand: number,
  jaar: number,
): ClubUren[] {
  const opVolgorde = [...klanten].sort((a, b) => a.volgorde - b.volgorde);

  return opVolgorde.map((klant) => {
    const geplakteNaam = schoon(klant.naam_in_lijst);
    const korteNaam = schoon(klant.korte_naam);
    let urenGeplakt = 0;
    let urenPrive = 0;

    for (const les of lessen) {
      if (!les.actief) continue;
      if (!inMaand(les.datum, maand, jaar)) continue;
      const club = schoon(les.club_tekst);
      // Een privéles hangt aan de korte naam ("Racso"), een geplakte les aan de naam zoals
      // die in de lijst staat ("T.C. RACSO"). Dat zijn twee verschillende namen voor
      // dezelfde club, en ze allebei aan één veld hangen zou er één van de twee breken.
      //
      // Een lege ingestelde naam matcht niets. Zonder die regel zou een club die net
      // toegevoegd is en nog niet ingevuld — het instellingenscherm maakt hem met lege
      // velden aan — elke regel claimen waarvan de clubkolom leeg is.
      if (les.bron === 'prive') {
        if (korteNaam !== '' && club === korteNaam) urenPrive += urenVan(les);
      } else if (geplakteNaam !== '' && club === geplakteNaam) {
        urenGeplakt += urenVan(les);
      }
    }

    return { klant, urenGeplakt: rond2(urenGeplakt), urenPrive: rond2(urenPrive) };
  });
}

/**
 * De clubs in de geplakte lijst die bij geen enkele klant uitkomen.
 *
 * Zonder deze functie verdwijnen die uren geruisloos: ze staan in de databank, ze staan op
 * geen enkele factuur, en niemand merkt het. Zo ging het in `facturen.xlsx` met `T.C. RACSO`
 * tegen `RACSO`. Het scherm toont dit, met een knop om de club bij te maken.
 */
export function onbekendeClubs(
  lessen: readonly Factuurles[],
  klanten: readonly Klant[],
  maand: number,
  jaar: number,
): Array<{ naam: string; aantal: number }> {
  // Een klant zonder ingevulde naam telt niet als "gekend": anders zou een lege clubkolom
  // in de plaktekst op hem uitkomen en nooit gemeld worden.
  const gekend = new Set(
    klanten.map((k) => schoon(k.naam_in_lijst)).filter((naam) => naam !== ''),
  );
  const geteld = new Map<string, { naam: string; aantal: number }>();

  for (const les of lessen) {
    if (les.bron !== 'geplakt' || !les.actief) continue;
    if (!inMaand(les.datum, maand, jaar)) continue;
    const sleutel = schoon(les.club_tekst);
    if (gekend.has(sleutel)) continue;
    // De naam zoals hij in de lijst stond, niet de opgeschoonde: dat is wat de gebruiker
    // straks in het veld "naam in de lijst" moet overnemen. Een lege naam krijgt een
    // woord, want "0 lessen bij een club die ik niet ken: " leest als een bug.
    const al = geteld.get(sleutel);
    if (al) al.aantal++;
    else geteld.set(sleutel, { naam: les.club_tekst.trim() || '(leeg)', aantal: 1 });
  }

  return [...geteld.values()];
}

/**
 * De velden van een boeking die deze telling nodig heeft.
 *
 * Met opzet geen `import type { Booking }`: dit bestand hoort niets te weten van spelers,
 * banen of betalingen. `Booking` past hier structureel in, dus het scherm geeft hem gewoon
 * door.
 */
export interface AppBoeking {
  coach_id: string;
  taught_by_id?: string;
  start_time: string;
  end_time: string;
  status: string;
}

/**
 * De maand waarin een boeking telt, is die van de begintijd.
 *
 * Een les van 23:30 op 30 september tot 00:30 op 1 oktober hoort bij september: zo staat
 * hij in de agenda en zo praat men erover. Het alternatief — de uren splitsen over twee
 * maanden — zou twee facturen een half uur geven dat op geen van beide klopt.
 */

/**
 * De uren die al in de app staan: de lessen waarvan deze trainer de lesgever was.
 *
 * Dezelfde definitie als het bedrag op zijn profiel (`coachPayoutThisMonth` in lib/reports):
 * wie de les werkelijk gaf telt, niet van wie de les was. Die vraag wordt beantwoord door
 * `lesgeverId` in lib/lesgever en door niets anders — dat bestand zegt in zijn kop waarom,
 * en een tweede `taught_by_id ?? coach_id` hier zou precies het gat terugzetten waar het
 * voor waarschuwt.
 *
 * Dit getal kent geen clubs: de app weet niet bij welke club een boeking hoort. Het heeft
 * dus alleen betekenis bij de ene klant waarvoor `bron_voorkeur` op `'app'` staat.
 */
export function urenUitApp(
  boekingen: readonly AppBoeking[],
  trainerId: string,
  maand: number,
  jaar: number,
): number {
  let uren = 0;

  for (const b of boekingen) {
    if (b.status === 'cancelled') continue;
    if (lesgeverId(b) !== trainerId) continue;

    const start = new Date(b.start_time);
    const eind = new Date(b.end_time);
    const ms = eind.getTime() - start.getTime();
    // Een onleesbaar tijdstip geeft NaN, en NaN zou het hele totaal wegvagen zonder dat er
    // iets op het scherm verandert. Zo'n boeking telt niet mee.
    if (!Number.isFinite(ms) || ms <= 0) continue;
    // De maand van de kalender, niet van UTC: een les van 's avonds laat hoort bij de dag
    // die je op de klok ziet.
    if (start.getFullYear() !== jaar || start.getMonth() + 1 !== maand) continue;

    uren += ms / 3_600_000;
  }

  return rond2(uren);
}
