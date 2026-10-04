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
import {
  buildVrijWorkbook, type XlsxRand, type XlsxStijl, type XlsxVrijBlad, type XlsxVrijeCel,
} from './xlsx';

/**
 * De kolombreedtes van het blad in `facturen.xlsx`. Eén uitzondering: daar was I 7 breed, en
 * dat paste voor een formule die "1155" toonde. Hier staat er een bedrag met twee decimalen
 * en een punt voor de duizendtallen, en bij 7 toont Excel dan `####`.
 */
const BREEDTES = [33.2, 7.7, 12.7, 2.3, 2.7, 6.2, 10.8, 10.7, 10];

/** De kleuren van het oude blad: de oranje balken, het lichtoranje van de bedragen, het goud. */
const ORANJE = 'FF3300';
const LICHT = 'F4B183';
const GOUD = 'FFC000';
const WIT = 'FFFFFF';

/** Tot hier loopt het blok met de lijnen minstens, zoals in het oude blad. */
const LIJNEN_TOT = 28;

/** De rijhoogtes van het oude blad, voor de rijen die altijd op dezelfde plek staan. */
const RIJHOOGTES: Record<number, number> = {
  5: 16, 7: 22, 9: 16, 10: 16, 15: 16, 20: 16, 22: 16,
};

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

  // Het blok met de lijnen loopt minstens tot rij 28, zoals in het oude blad: een factuur met
  // één urenlijn krijgt zo dezelfde ruimte eronder, en de totalen staan altijd op dezelfde
  // hoogte. Meer lijnen dan dat duwen de rest gewoon naar beneden.
  const blokEinde = Math.max(rij, LIJNEN_TOT);
  const netto = blokEinde + 1;
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

  const laatste = netto + 7;
  opmaken(cellen, samengevoegd, blokEinde, netto);

  return {
    naam: 'Factuur',
    cellen,
    breedtes: BREEDTES,
    samengevoegd,
    rijhoogtes: RIJHOOGTES,
    afdrukbereik: `A1:I${laatste}`,
  };
}

/**
 * De opmaak van `facturen.xlsx` over de cellen heen: oranje balken, kaders, het lichtoranje
 * van de bedragen, en 9 punt voor alles behalve de klant en de beschrijving (11 punt).
 *
 * Apart van het plaatsen van de waarden, zodat `factuurBlad` leesbaar blijft als lijst van
 * wat waar staat. Een cel die hier opmaak krijgt maar geen waarde heeft, wordt een lege cel
 * met opmaak: een kader loopt ook langs cellen waar niets in staat.
 *
 * `laatsteLijn` is de onderste rij van het blok met de lijnen (minstens `LIJNEN_TOT`),
 * `netto` die van de nettoregel.
 */
function opmaken(
  cellen: XlsxVrijeCel[],
  samengevoegd: string[],
  laatsteLijn: number,
  netto: number,
): void {
  const zet = (ref: string, stijl: XlsxStijl): void => {
    const bestaand = cellen.find((c) => c.ref === ref);
    const rand: XlsxRand = { ...bestaand?.stijl?.rand, ...stijl.rand };
    const nieuw: XlsxStijl = { grootte: 9, ...bestaand?.stijl, ...stijl, rand };
    if (bestaand) bestaand.stijl = nieuw;
    else cellen.push({ ref, stijl: nieuw });
  };
  const kolommen = (van: string, tot: string): string[] => {
    const uit: string[] = [];
    for (let k = van.charCodeAt(0); k <= tot.charCodeAt(0); k++) uit.push(String.fromCharCode(k));
    return uit;
  };

  // Alles eerst op 9 punt, met vet waar `factuurBlad` dat al zei.
  for (const c of [...cellen]) zet(c.ref, { vet: c.vet });

  // Mijn gegevens: de oranje balk over de hele breedte, en een kader rond A6:C10.
  zet('A5', { grootte: 11, vulling: ORANJE, kleur: WIT, uitlijning: 'center', vet: false });
  samengevoegd.push('A5:I5');
  for (let r = 6; r <= 10; r++) {
    zet(`A${r}`, { rand: { links: true } });
    zet(`B${r}`, { vet: true });
    zet(`C${r}`, { rand: { rechts: true } });
  }
  zet('C6', { rand: { boven: true } });
  zet('A6', { rand: { boven: true } });
  zet('B6', { rand: { boven: true } });
  for (const k of ['A', 'B', 'C']) zet(`${k}10`, { rand: { onder: true } });

  // Het factuurblok rechtsboven: "Factuur" in goud, en een kader rond G6:I9.
  zet('G6', { vet: true, kleur: GOUD, uitlijning: 'center', rand: { boven: true, links: true } });
  zet('H6', { rand: { boven: true } });
  zet('I6', { rand: { boven: true, rechts: true } });
  samengevoegd.push('G6:I6');
  for (let r = 7; r <= 9; r++) {
    zet(`G${r}`, { rand: { links: true } });
    zet(`I${r}`, { rand: { rechts: true } });
  }
  for (const k of ['G', 'H', 'I']) zet(`${k}9`, { rand: { onder: true } });
  zet('H7', { vulling: LICHT, uitlijning: 'left' });
  zet('H9', { uitlijning: 'left' });

  // De klant, in 11 punt en in een kader A16:D20.
  for (let r = 16; r <= 20; r++) {
    zet(`A${r}`, { grootte: 11, rand: { links: true } });
    zet(`D${r}`, { rand: { rechts: true } });
  }
  for (const k of ['A', 'B', 'C', 'D']) {
    zet(`${k}16`, { rand: { boven: true } });
    zet(`${k}20`, { rand: { onder: true } });
  }
  zet('H21', { vet: true });
  zet('I21', { vet: true });

  // De balk boven de lijnen.
  zet('A22', { grootte: 11, vulling: ORANJE, kleur: WIT, vet: false });
  samengevoegd.push('A22:E22');
  for (const k of ['F', 'G', 'H', 'I']) zet(`${k}22`, { vulling: ORANJE, kleur: WIT, vet: false });

  // De lijnen: links een kader rond de omschrijving, rechts een kolom per getal, en de
  // bedragen lichtoranje. De onderste lijn sluit het blok af.
  for (let r = 23; r <= laatsteLijn; r++) {
    zet(`A${r}`, { grootte: 11, rand: { links: true } });
    zet(`E${r}`, { rand: { rechts: true } });
    for (const k of ['F', 'G', 'H']) zet(`${k}${r}`, { rand: { links: true, rechts: true } });
    zet(`I${r}`, { vulling: LICHT, rand: { links: true, rechts: true } });
  }
  for (const k of kolommen('A', 'I')) {
    zet(`${k}23`, { rand: { boven: true } });
    zet(`${k}${laatsteLijn}`, { rand: { onder: true } });
  }

  // De totalen: elk een kader, het bedrag lichtoranje.
  for (let r = netto; r <= netto + 2; r++) {
    zet(`G${r}`, { rand: { links: true, onder: true } });
    zet(`H${r}`, { rand: { onder: true } });
    zet(`I${r}`, { vulling: LICHT, rand: { links: true, rechts: true, onder: true } });
  }

  // De voetnoten bij de BTW, gecentreerd in 11 punt, en de opmerkingen in 9.
  zet(`A${netto + 1}`, { grootte: 11, uitlijning: 'center' });
  zet(`A${netto + 2}`, { grootte: 11, uitlijning: 'center' });
  zet(`A${netto + 4}`, { vet: false });

  // Te betalen: vet, met een kader rondom.
  zet(`H${netto + 5}`, { vet: false, rand: { boven: true, onder: true, links: true } });
  zet(`I${netto + 5}`, {
    vet: true, vulling: LICHT, rand: { boven: true, onder: true, links: true, rechts: true },
  });
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
