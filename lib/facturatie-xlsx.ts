// Een factuur als Excel-blad.
//
// De indeling volgt het blad uit `facturen.xlsx` rij voor rij, zodat het bestand dat de app
// aflevert er hetzelfde uitziet als het bestand dat de club al jaren krijgt. Alleen het
// urenblok groeit mee met het aantal vrije lijnen; de rest schuift dan op.
//
// Het bestand heeft twee tabbladen: de factuur, en het overzicht van de extra lessen dat
// Racso elke maand vraagt. Dat tweede blad is er altijd, ook leeg — een tabblad dat er soms
// wel en soms niet is, is een tabblad waarvan iemand denkt dat het vergeten werd.
//
// WAT HIER NIET IN STAAT: formules. Het blad uit Excel rekent zichzelf uit, en dat is handig
// zolang je ermee bezig bent. Een bewaarde factuur hoort juist niet meer te kunnen
// veranderen omdat iemand per ongeluk een cel aanraakt. Wat hier staat is uitgerekend.

import { MAANDNAMEN, rond2, type Factuur, type Leverancier } from './facturatie';
import { buildVrijWorkbook, type XlsxVrijBlad, type XlsxVrijeCel } from './xlsx';

/** Kolom A draagt de omschrijvingen en is daarom breed; G tot I dragen de bedragen. */
const BREEDTES = [38, 10, 10, 10, 10, 10, 14, 16, 14];

/** `2026-10-01` als dag op de kalender. Niet via `new Date(tekst)`: dat leest UTC. */
function alsDatum(iso: string): Date {
  const [j, m, d] = iso.split('-').map(Number);
  return new Date(j, m - 1, d);
}

export function factuurBlad(factuur: Factuur, leverancier: Leverancier): XlsxVrijBlad {
  const cellen: XlsxVrijeCel[] = [];
  const samengevoegd: string[] = [];

  const tekst = (ref: string, waarde: string, vet = false) =>
    cellen.push({ ref, cel: { soort: 'tekst', waarde }, vet });
  const getal = (ref: string, waarde: number) =>
    cellen.push({ ref, cel: { soort: 'getal', waarde } });
  const geld = (ref: string, waarde: number) =>
    cellen.push({ ref, cel: { soort: 'geld', waarde } });
  const datum = (ref: string, iso: string) =>
    cellen.push({ ref, cel: { soort: 'datum', waarde: alsDatum(iso) } });

  // Mijn gegevens, linksboven.
  tekst('A5', 'Mijn gegevens', true);
  tekst('A6', 'Naam'); tekst('B6', leverancier.naam);
  tekst('A7', 'Adres'); tekst('B7', leverancier.adres);
  tekst('A8', 'BTW:'); tekst('B8', leverancier.btw);
  tekst('A9', 'IBAN:'); tekst('B9', leverancier.iban);
  tekst('A10', 'BIC:'); tekst('B10', leverancier.bic);

  // Het nummer en de datums, rechtsboven.
  tekst('G6', 'Factuur', true);
  tekst('G7', 'Datum'); datum('H7', factuur.factuurdatum);
  tekst('G8', 'Factuurnr'); tekst('H8', factuur.factuurnr);
  tekst('G9', 'Vervaldatum'); datum('H9', factuur.vervaldatum);

  // De klant. Uitgeschreven zoals hij bij het maken van de factuur was — zie `Factuur`.
  tekst('A16', 'Factuur voor:', true);
  tekst('A17', factuur.klant_naam);
  tekst('A18', factuur.klant_adres);
  tekst('A19', factuur.klant_postcode_gemeente);
  tekst('A20', factuur.klant_btw === '' ? '' : `BTW nummer: ${factuur.klant_btw}`);

  tekst('H21', 'valuta:'); tekst('I21', 'euro');

  tekst('A22', 'BESCHRIJVING:', true);
  tekst('F22', 'Aantal', true);
  tekst('G22', 'Eenheid', true);
  tekst('H22', 'Tarief', true);
  tekst('I22', 'Bedrag', true);

  tekst('A23', factuur.omschrijving);
  samengevoegd.push('A23:E23');

  getal('F24', factuur.aantal_uren);
  tekst('G24', 'uren');
  geld('H24', factuur.uurtarief);
  geld('I24', rond2(factuur.aantal_uren * factuur.uurtarief));

  let rij = 24;
  for (const lijn of factuur.vrije_lijnen) {
    rij++;
    tekst(`A${rij}`, lijn.omschrijving);
    getal(`F${rij}`, lijn.aantal);
    tekst(`G${rij}`, lijn.eenheid);
    geld(`H${rij}`, lijn.tarief);
    geld(`I${rij}`, rond2(lijn.aantal * lijn.tarief));
    samengevoegd.push(`A${rij}:E${rij}`);
  }

  const netto = rij + 1;
  tekst(`G${netto}`, 'netto:'); geld(`I${netto}`, factuur.netto);
  tekst(`G${netto + 1}`, 'BTW %'); getal(`I${netto + 1}`, factuur.btw_percentage);
  tekst(`G${netto + 2}`, 'BTW-Bedrag'); geld(`I${netto + 2}`, factuur.btw_bedrag);

  // De twee voetnoten die de nul-BTW verklaren. Ze staan links, naast de bedragen.
  tekst(`A${netto + 1}`, 'Artikel 44.2.3 vrijstelling btw exploitatie lichamelijke ontwikkeling');
  tekst(`A${netto + 2}`, 'kleine onderneming');
  samengevoegd.push(`A${netto + 1}:E${netto + 1}`, `A${netto + 2}:E${netto + 2}`);

  tekst(`A${netto + 4}`, 'AANVULLENDE OPMERKINGEN', true);
  tekst(
    `A${netto + 5}`,
    `1. Gelieve het verschuldigde bedrag binnen de 15 dagen te storten op rekening: ${leverancier.iban}`,
  );
  tekst(`H${netto + 5}`, 'Te Betalen:', true);
  geld(`I${netto + 5}`, factuur.totaal);
  tekst(`A${netto + 7}`, '2. Gelieve het factuur# te vermelden als mededeling');
  samengevoegd.push(`A${netto + 5}:F${netto + 5}`, `A${netto + 7}:F${netto + 7}`);

  return { naam: 'Factuur', cellen, breedtes: BREEDTES, samengevoegd };
}

/**
 * Blad 2: het overzicht van de extra lessen.
 *
 * Racso vraagt dit elke maand. Het leest uit `factuur.extra_lessen` en niet uit de
 * lessenlijst: wat op een verstuurde factuur stond, mag niet veranderen omdat er later een
 * les geschrapt wordt.
 */
export function extraLessenBlad(factuur: Factuur): XlsxVrijBlad {
  const cellen: XlsxVrijeCel[] = [];
  const tekst = (ref: string, waarde: string, vet = false) =>
    cellen.push({ ref, cel: { soort: 'tekst', waarde }, vet });

  tekst('A1', 'EXTRA LESSEN', true);
  tekst(
    'A2',
    `${factuur.klant_naam} · ${MAANDNAMEN[factuur.dienstmaand - 1]} ${factuur.dienstjaar}`
    + ` · factuur ${factuur.factuurnr}`,
  );

  if (factuur.extra_lessen.length === 0) {
    tekst('A4', 'Geen extra lessen in deze maand.');
    return { naam: 'Extra lessen', cellen, breedtes: [14, 22, 18, 10] };
  }

  tekst('A4', 'Datum', true);
  tekst('B4', 'Naam', true);
  tekst('C4', 'Type', true);
  tekst('D4', 'Uren', true);

  // Op datum en niet in de volgorde waarin ze ingetikt zijn: wie het overzicht naast zijn
  // eigen agenda legt, leest van boven naar beneden door de maand.
  const opDatum = [...factuur.extra_lessen].sort((a, b) => a.datum.localeCompare(b.datum));

  let rij = 4;
  for (const les of opDatum) {
    rij++;
    cellen.push({ ref: `A${rij}`, cel: { soort: 'datum', waarde: alsDatum(les.datum) } });
    tekst(`B${rij}`, les.naam);
    tekst(`C${rij}`, les.type);
    cellen.push({ ref: `D${rij}`, cel: { soort: 'getal', waarde: les.uren } });
  }

  const totaal = rond2(opDatum.reduce((som, les) => som + les.uren, 0));
  tekst(`C${rij + 1}`, 'Totaal', true);
  cellen.push({ ref: `D${rij + 1}`, cel: { soort: 'getal', waarde: totaal } });

  return { naam: 'Extra lessen', cellen, breedtes: [14, 22, 18, 10] };
}

/** Het bestand zoals het gedownload wordt: de factuur, en het overzicht erachter. */
export function factuurWerkmap(factuur: Factuur, leverancier: Leverancier): Uint8Array {
  return buildVrijWorkbook([factuurBlad(factuur, leverancier), extraLessenBlad(factuur)]);
}

/**
 * De naam van het bestand dat gedownload wordt.
 *
 * Alles wat geen letter, cijfer, streepje of liggend streepje is, wordt een streepje: een
 * factuurnummer mag een schuine streep bevatten en een bestandsnaam niet, en dan mislukt de
 * download zonder uitleg.
 */
export function factuurBestandsnaam(factuurnr: string): string {
  const net = factuurnr.trim()
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    // Een bestandsnaam langer dan ongeveer 255 tekens weigeren sommige schijven en
    // browsers zonder uitleg. Honderd is ruim voor een factuurnummer.
    .slice(0, 100);
  return net === '' ? 'factuur.xlsx' : `factuur-${net}.xlsx`;
}
