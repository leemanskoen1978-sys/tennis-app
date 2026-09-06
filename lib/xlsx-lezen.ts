// Een xlsx-bestand lezen, zonder pakket erbij — het spiegelbeeld van `lib/xlsx.ts`.
//
// Die schrijft een werkmap en mag zijn eigen bestanden onverpakt in de zip zetten: elke
// lezer die het formaat kent leest een opgeslagen ingang net zo goed. Andersom gaat die
// vlieger niet op. Een bestand dat uit Excel komt is altijd ingepakt, en heeft bovendien een
// tabel met gedeelde teksten en een extra veld in zijn lokale koppen. Dit leest wat Excel
// schrijft, niet wat wij zelf net hebben weggeschreven.
//
// De zip-lezer in `lib/xlsx.test.ts` volgt bewust alleen de centrale map — "leesbaar voor
// een programma dat het formaat kent en niet dit bestand". Die redenering blijft hier
// onveranderd gelden: de centrale map is de inhoudsopgave, en die volgen we, in plaats van
// de bytes na te tellen die iemand net heeft neergezet. Wat erbij komt is de tak voor
// opslagmethode 8 en de controle op de controlesom die het bestand zelf meedraagt.

import { inflate } from './inflate';
import { crc32 } from './xlsx';

// ---------------------------------------------------------------------------
// De zip
// ---------------------------------------------------------------------------

/**
 * Elk getal in een zip komt uit het bestand zelf en is dus onvertrouwd. Een lengte of offset
 * die voorbij het einde wijst is geen reden om stilletjes nullen te lezen — dan wordt een
 * kapot bestand een lus of een leeg blad. Vandaar deze grens op elke uitlezing.
 */
function grens(b: Uint8Array, at: number, lengte: number): void {
  if (at < 0 || at + lengte > b.length) {
    throw new Error('Dit bestand is onvolledig: de zip wijst voorbij zijn eigen einde.');
  }
}

function u16(b: Uint8Array, at: number): number {
  grens(b, at, 2);
  return b[at] | (b[at + 1] << 8);
}

function u32(b: Uint8Array, at: number): number {
  grens(b, at, 4);
  return (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;
}

export interface GelezenIngang {
  naam: string;
  inhoud: Uint8Array;
}

/**
 * De ingangen van een zip, gevonden via de centrale map achteraan en uitgepakt.
 *
 * De offset van een ingang komt uit de centrale map; de naamlengte en de extra-lengte komen
 * uit de lokale kop. Dat verschil is geen kleinigheid: in `koen.xlsx` staat in de centrale
 * map bij élke ingang extra-lengte 0, terwijl de lokale kop van `[Content_Types].xml` er 520
 * heeft (en drie andere ingangen 264). Wie de centrale waarde gebruikt om de gegevens te
 * zoeken begint 520 bytes te vroeg en pakt rommel uit — en dat merk je nergens aan, behalve
 * aan een blad dat leeg blijft.
 */
export function leesZip(bytes: Uint8Array): GelezenIngang[] {
  // Het einde van de centrale map heeft geen vaste plek (er mag een opmerking achter staan);
  // zoek de handtekening van achteren naar voren.
  let eind = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (u32(bytes, i) === 0x06054b50) {
      eind = i;
      break;
    }
  }
  if (eind < 0) throw new Error('Dit is geen zip-bestand: het einde van de centrale map ontbreekt.');

  const aantal = u16(bytes, eind + 10);
  let pos = u32(bytes, eind + 16);
  const uit: GelezenIngang[] = [];

  for (let n = 0; n < aantal; n++) {
    if (u32(bytes, pos) !== 0x02014b50) {
      throw new Error('De inhoudsopgave van dit bestand is stuk: een rij in de centrale map klopt niet.');
    }
    const naamLengte = u16(bytes, pos + 28);
    const extraLengte = u16(bytes, pos + 30);
    const opmerkingLengte = u16(bytes, pos + 32);
    const lokaal = u32(bytes, pos + 42);
    grens(bytes, pos + 46, naamLengte);
    const naam = bytesNaarTekst(bytes.subarray(pos + 46, pos + 46 + naamLengte));

    if (u32(bytes, lokaal) !== 0x04034b50) {
      throw new Error(`De lokale kop van "${naam}" klopt niet met de inhoudsopgave.`);
    }
    const vlaggen = u16(bytes, lokaal + 6);
    if ((vlaggen & 0x0008) !== 0) {
      // Bit 3 betekent dat de lengtes pas ná de gegevens staan, in een data-descriptor. Excel
      // doet dat niet bij een xlsx, en raden waar de ingang ophoudt is erger dan weigeren.
      throw new Error(`"${naam}" bewaart zijn lengte achteraf; dat leest deze app niet.`);
    }
    const methode = u16(bytes, lokaal + 8);
    const som = u32(bytes, lokaal + 14);
    const ingepakteLengte = u32(bytes, lokaal + 18);
    const uitgepakteLengte = u32(bytes, lokaal + 22);
    const lokaalNaamLengte = u16(bytes, lokaal + 26);
    const lokaalExtraLengte = u16(bytes, lokaal + 28);

    // 30 vaste bytes, dan de naam en het extra veld, en pas dan de gegevens.
    const begin = lokaal + 30 + lokaalNaamLengte + lokaalExtraLengte;
    grens(bytes, begin, ingepakteLengte);
    const rauw = bytes.subarray(begin, begin + ingepakteLengte);

    let inhoud: Uint8Array;
    if (methode === 0) {
      inhoud = rauw;
    } else if (methode === 8) {
      inhoud = inflate(rauw, uitgepakteLengte);
    } else {
      throw new Error(`"${naam}" is ingepakt met methode ${methode}; die kent deze app niet.`);
    }

    // De controlesom is de enige manier om te weten dat de uitpakker klopt op een bestand dat
    // je nooit gezien hebt. Klopt hij niet, dan is er iets mis met het bestand óf met deze
    // code — in beide gevallen is doorlezen erger dan stoppen.
    if (crc32(inhoud) !== som) {
      throw new Error(`De inhoud van "${naam}" klopt niet met zijn eigen controlesom.`);
    }

    uit.push({ naam, inhoud });
    pos += 46 + naamLengte + extraLengte + opmerkingLengte;
  }
  return uit;
}

// ---------------------------------------------------------------------------
// Tekst
// ---------------------------------------------------------------------------

/**
 * UTF-8 terug naar tekst, met de hand — het spiegelbeeld van `utf8()` in `lib/xlsx.ts`, en om
 * dezelfde reden. `TextDecoder` bestaat tegenwoordig overal, maar "tegenwoordig overal" is
 * precies de aanname die pas op het toestel van iemand anders omvalt. Dit is kort genoeg om
 * die vraag niet te hoeven stellen.
 */
export function bytesNaarTekst(bytes: Uint8Array): string {
  let uit = '';
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    if (c < 0x80) {
      uit += String.fromCharCode(c);
    } else if ((c & 0xe0) === 0xc0) {
      uit += String.fromCharCode(((c & 0x1f) << 6) | (bytes[++i] & 0x3f));
    } else if ((c & 0xf0) === 0xe0) {
      uit += String.fromCharCode(
        ((c & 0x0f) << 12) | ((bytes[++i] & 0x3f) << 6) | (bytes[++i] & 0x3f),
      );
    } else {
      // Boven U+FFFF: terug naar een surrogaatpaar, want zo staat het in een JS-string.
      const punt = ((c & 0x07) << 18)
        | ((bytes[++i] & 0x3f) << 12)
        | ((bytes[++i] & 0x3f) << 6)
        | (bytes[++i] & 0x3f);
      const rest = punt - 0x10000;
      uit += String.fromCharCode(0xd800 + (rest >> 10), 0xdc00 + (rest & 0x3ff));
    }
  }
  return uit;
}

// ---------------------------------------------------------------------------
// De XML
// ---------------------------------------------------------------------------

/**
 * De vijf entiteiten die `xml()` in `lib/xlsx.ts` erin zet, er weer uit.
 *
 * De volgorde is niet vrij: `&amp;` gaat als láátste. Andersom wordt `&amp;lt;` — de tekst
 * "&lt;" die een coach letterlijk in een naam kan hebben staan — eerst "&lt;" en daarna het
 * teken "<". Dat is precies het soort fout dat pas opvalt bij één naam met een ampersand
 * erin, een jaar later.
 */
export function ontsnapTerug(tekst: string): string {
  return tekst
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** De inhoud van alle `<t>`-stukken in een blok, aaneengeplakt en ontsnapt. */
function tekstStukken(blok: string): string {
  const stukken = blok.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? [];
  return stukken
    .map((s) => ontsnapTerug(s.replace(/^<t[^>]*>/, '').replace(/<\/t>$/, '')))
    .join('');
}

/**
 * De tabel met gedeelde teksten van Excel, op volgorde.
 *
 * De volgorde is de betekenis: een cel met `t="s"` bewaart een índex in deze lijst, geen
 * tekst. Een `<v>0</v>` is dus de eerste tekst en niet een lege cel — in `koen.xlsx` is dat
 * de kop "Datum", die bij een lezer die op waarheid test spoorloos verdwijnt.
 *
 * Eén `<si>` kan uit meerdere `<r><t>`-stukken bestaan: dat is één tekst waarvan Excel een
 * deel apart heeft opgemaakt. Aaneenplakken, anders valt een naam middenin uit elkaar.
 */
export function leesSharedStrings(xml: string): string[] {
  const blokken = xml.match(/<si>[\s\S]*?<\/si>/g) ?? [];
  return blokken.map(tekstStukken);
}

/** "A" → 0, "J" → 9, "AA" → 26. De omgekeerde van `kolomLetter` in `lib/xlsx.ts`. */
export function letterNaarKolom(letters: string): number {
  let n = 0;
  for (let i = 0; i < letters.length; i++) {
    n = n * 26 + (letters.charCodeAt(i) - 64);
  }
  return n - 1;
}

/**
 * Eén blad als een rooster van rauwe teksten.
 *
 * Rauw, met opzet: hier wordt niets omgezet naar een getal, een datum of een uur. Wat een
 * kolom betékent is de zaak van de import — die weet welke kolom een datum is en deze lezer
 * niet. Zou de lezer alvast gaan omzetten, dan zit de kennis over het bestandsformaat op twee
 * plekken en verschilt ze na de eerste wijziging.
 *
 * De plek van een cel komt uit zijn eigen `r` ("C3"), niet uit de volgorde waarin de cellen
 * staan: een blad van Excel laat lege cellen gewoon weg.
 */
export function leesBlad(xml: string, gedeeld: readonly string[]): string[][] {
  const rijen: string[][] = [];

  const rijPatroon = /<row([^>]*?)\/>|<row([^>]*?)>([\s\S]*?)<\/row>/g;
  let rijTreffer: RegExpExecArray | null;
  while ((rijTreffer = rijPatroon.exec(xml)) !== null) {
    const kenmerken = rijTreffer[1] ?? rijTreffer[2] ?? '';
    const inhoud = rijTreffer[3] ?? '';
    const nummer = Number(/\br="(\d+)"/.exec(kenmerken)?.[1] ?? rijen.length + 1);
    const cellen: string[] = [];

    const celPatroon = /<c([^>]*?)\/>|<c([^>]*?)>([\s\S]*?)<\/c>/g;
    let celTreffer: RegExpExecArray | null;
    while ((celTreffer = celPatroon.exec(inhoud)) !== null) {
      const celKenmerken = celTreffer[1] ?? celTreffer[2] ?? '';
      const celInhoud = celTreffer[3] ?? '';
      const verwijzing = /\br="([A-Z]+)\d*"/.exec(celKenmerken)?.[1];
      const plek = verwijzing !== undefined ? letterNaarKolom(verwijzing) : cellen.length;
      const soort = /\bt="([a-zA-Z]+)"/.exec(celKenmerken)?.[1];
      const waarde = /<v>([\s\S]*?)<\/v>/.exec(celInhoud)?.[1];

      let tekst: string;
      if (soort === 's') {
        // Een index, geen tekst. `Number('0')` is 0 en dat is een geldige plek in de tabel;
        // vandaar een expliciete controle en nergens een `|| ''`.
        const index = Number(waarde);
        tekst = Number.isInteger(index) && index >= 0 && index < gedeeld.length ? gedeeld[index] : '';
      } else if (soort === 'inlineStr') {
        // De schrijfwijze van deze app zelf: `<is><t>` met de tekst erin.
        tekst = tekstStukken(celInhoud);
      } else {
        tekst = waarde !== undefined ? ontsnapTerug(waarde) : '';
      }

      while (cellen.length < plek) cellen.push('');
      cellen[plek] = tekst;
    }

    while (rijen.length < nummer - 1) rijen.push([]);
    rijen[nummer - 1] = cellen;
  }
  return rijen;
}

export interface GelezenBlad {
  naam: string;
  rijen: string[][];
}

/** De naam van een kenmerk uit een XML-tag, of undefined als hij er niet staat. */
function kenmerk(tag: string, naam: string): string | undefined {
  const treffer = new RegExp(`\\b${naam}="([^"]*)"`).exec(tag);
  return treffer ? ontsnapTerug(treffer[1]) : undefined;
}

/**
 * De bladen van een werkmap, met hun naam zoals hij op het tabblad staat.
 *
 * De koppeling naam → bestand loopt via `r:id` en `xl/_rels/workbook.xml.rels`, en nooit via
 * de volgorde. In `koen.xlsx` heet het enige blad "Sheet1" terwijl het bestand
 * `worksheets/sheet1.xml` heet; dat die twee hier toevallig op elkaar lijken is geen regel om
 * op te bouwen — Excel mag een blad "Lessen" naar `sheet7.xml` schrijven.
 */
export function leesWerkmap(bytes: Uint8Array): GelezenBlad[] {
  const ingangen = leesZip(bytes);
  const inhoudVan = (naam: string): string | undefined => {
    const ingang = ingangen.find((i) => i.naam === naam);
    return ingang ? bytesNaarTekst(ingang.inhoud) : undefined;
  };

  const werkmap = inhoudVan('xl/workbook.xml');
  if (werkmap === undefined) throw new Error('Dit is geen Excel-werkmap: xl/workbook.xml ontbreekt.');
  const relaties = inhoudVan('xl/_rels/workbook.xml.rels') ?? '';

  const doelen = new Map<string, string>();
  for (const tag of relaties.match(/<Relationship\b[^>]*>/g) ?? []) {
    const id = kenmerk(tag, 'Id');
    const doel = kenmerk(tag, 'Target');
    if (id !== undefined && doel !== undefined) doelen.set(id, doel);
  }

  // Een sharedStrings.xml hoeft er niet te zijn: deze app schrijft er zelf geen, want ze zet
  // haar tekst met `inlineStr` in het blad zelf.
  const gedeeld = leesSharedStrings(inhoudVan('xl/sharedStrings.xml') ?? '');

  const bladen: GelezenBlad[] = [];
  const sheets = /<sheets>([\s\S]*?)<\/sheets>/.exec(werkmap)?.[1] ?? '';
  for (const tag of sheets.match(/<sheet\b[^>]*\/?>/g) ?? []) {
    const naam = kenmerk(tag, 'name') ?? '';
    const id = kenmerk(tag, 'r:id');
    const doel = id !== undefined ? doelen.get(id) : undefined;
    if (doel === undefined) continue;
    // Het pad in een relatie staat relatief aan de map van het bestand waar de relatie bij
    // hoort — hier `xl/`. Vandaar dat "worksheets/sheet1.xml" er "xl/" voor krijgt in plaats
    // van dat we gokken waar het blad wel zal staan.
    const pad = doel.startsWith('/') ? doel.slice(1) : `xl/${doel}`;
    const blad = inhoudVan(pad);
    if (blad === undefined) continue;
    bladen.push({ naam, rijen: leesBlad(blad, gedeeld) });
  }
  return bladen;
}

// ---------------------------------------------------------------------------
// Datum en tijd
// ---------------------------------------------------------------------------

/**
 * Het getal in een datumcel terug naar een kalenderdag: het aantal dagen sinds 30 december
 * 1899. Die dag en niet 1 januari 1900, omdat Excel 1900 voor een schrikkeljaar houdt en dus
 * een 29 februari 1900 kent die nooit bestaan heeft. Het beginpunt één dag terugleggen maakt
 * alles vanaf maart 1900 weer gelijk — en dat is het enige stuk van de kalender waar deze app
 * mee te maken heeft. Dit is de spiegel van `datumNaarSerie` in `lib/xlsx.ts`.
 *
 * Er komen kale getallen uit en geen `Date`: een `Date` sleept een tijdzone mee, en een les
 * van 's avonds is dan zomaar de dag ervoor.
 */
export function serieNaarDatum(serie: number): { jaar: number; maand: number; dag: number } {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(serie) * 86_400_000);
  return { jaar: d.getUTCFullYear(), maand: d.getUTCMonth() + 1, dag: d.getUTCDate() };
}

/**
 * Het getal in een uurcel terug naar klokuur en minuut. Excel bewaart een tijdstip als het
 * deel van de dag dat verstreken is: 0.5 is het middaguur.
 *
 * Eerst de tótale minuten afronden, en pas dán splitsen. Reden (D-20):
 * `0.58333333333333337 * 24 = 13.999999999999998`, en `Math.floor` daarvan geeft 13. Dat is
 * een heel seizoen aan lessen een uur te vroeg in de agenda, en dat valt pas op als de eerste
 * ouder belt omdat ze voor een dichte deur stond.
 */
export function fractieNaarTijd(fractie: number): { uur: number; minuut: number } {
  const totaalMinuten = Math.round(fractie * 24 * 60);
  return { uur: Math.floor(totaalMinuten / 60), minuut: totaalMinuten % 60 };
}
