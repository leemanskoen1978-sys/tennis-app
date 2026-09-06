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
