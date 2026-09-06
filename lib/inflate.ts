// Een DEFLATE-stroom uitpakken, met de hand: RFC 1951, de uitpakhelft van het zip-formaat.
//
// Waarom er geen pakket bij komt: deze app draait op het web én op een telefoon, en
// `DecompressionStream` bestaat niet overal waar dat is. Een afhankelijkheid die op één van
// de twee stilvalt is erger dan vierhonderd regels die volledig te testen zijn. Dat is
// dezelfde afweging die `utf8()` in `lib/xlsx.ts` al maakte, om precies dezelfde reden.
//
// Waarom de schrijver in `lib/xlsx.ts` dit nooit nodig had: die slaat zijn eigen bestanden
// onverpakt op. Excel doet dat niet — elke ingang van een echt xlsx staat ingepakt. Dit
// bestand leest dus wat Excel schrijft, niet wat wij zelf net hebben weggeschreven.

// ---------------------------------------------------------------------------
// De bitlezer
// ---------------------------------------------------------------------------

/**
 * Een stroom bits, laagste bit van een byte eerst.
 *
 * Let op het verschil dat de klassieke fout is in een zelfgeschreven inflate: getallen met
 * een vaste breedte (vlaggen, lengtes, de extra bits) worden hier gelezen zoals `bits()` het
 * doet — laagste bit eerst. Een Huffman-code wordt júist andersom gelezen: bit voor bit van
 * hoog naar laag, waarbij elk gelezen bit onderaan de code wordt aangeschoven. Daarom leest
 * `leesSymbool()` hieronder met `eenBit()` en niet met `bits()`.
 */
function bitlezer(bytes: Uint8Array) {
  let pos = 0;
  let bit = 0;

  function eenBit(): number {
    // Voorbij het einde niet stilletjes nullen teruggeven: een stroom die opraakt vóór het
    // eindblok is stuk, en nullen lezen zou daar een eindeloze lus van maken.
    if (pos >= bytes.length) {
      throw new Error('De ingepakte stroom houdt op voor het einde: het bestand is onvolledig.');
    }
    const waarde = (bytes[pos] >> bit) & 1;
    bit++;
    if (bit === 8) {
      bit = 0;
      pos++;
    }
    return waarde;
  }

  function bits(n: number): number {
    let uit = 0;
    for (let i = 0; i < n; i++) {
      uit |= eenBit() << i;
    }
    return uit;
  }

  function uitlijnen(): void {
    if (bit !== 0) {
      bit = 0;
      pos++;
    }
  }

  function byte(): number {
    if (pos >= bytes.length) {
      throw new Error('De ingepakte stroom houdt op voor het einde: het bestand is onvolledig.');
    }
    return bytes[pos++];
  }

  return { eenBit, bits, uitlijnen, byte };
}

type Bitlezer = ReturnType<typeof bitlezer>;

// ---------------------------------------------------------------------------
// De tabellen uit de specificatie
// ---------------------------------------------------------------------------

// Deze getallen komen letterlijk uit RFC 1951 (tabellen bij paragraaf 3.2.5) en worden hier
// één keer neergezet in plaats van per aanroep uitgerekend — net als `CRC_TABEL` in
// `lib/xlsx.ts`. Ze zijn ook niet af te leiden: de reeks knikt op een paar plekken (code 284
// eindigt op 227-257, en code 285 is de losse waarde 258 zonder extra bits). Wie ze uitrekent
// met een formule zit er op precies die plekken naast.

/** Basislengte per code 257-285. */
const LENGTE_BASIS = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115,
  131, 163, 195, 227, 258,
];

/** Aantal extra bits per code 257-285. */
const LENGTE_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];

/** Basisafstand per code 0-29. */
const AFSTAND_BASIS = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537,
  2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
];

/** Aantal extra bits per afstandscode 0-29. */
const AFSTAND_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12,
  13, 13,
];

// ---------------------------------------------------------------------------
// Huffman
// ---------------------------------------------------------------------------

/**
 * Een canonieke Huffman-boom, opgeslagen als tellingen en symbolen in plaats van als knopen.
 *
 * `aantal[l]` is hoeveel codes er lengte `l` hebben; `symbolen` is de lijst symbolen op
 * volgorde van eerst lengte en dan symboolnummer. Dat is genoeg om te decoderen, want een
 * canonieke code ligt door die twee dingen volledig vast — er is geen boom nodig om in te
 * wandelen.
 */
interface Huffman {
  aantal: Int32Array;
  symbolen: Int32Array;
}

/** De maximale codelengte die het formaat toestaat. */
const MAX_BITS = 15;

/** Bouwt de boom uit een lijst codelengtes, volgens de canonieke methode van RFC 1951. */
function bouwHuffman(lengtes: readonly number[]): Huffman {
  const aantal = new Int32Array(MAX_BITS + 1);
  for (const lengte of lengtes) {
    aantal[lengte]++;
  }
  // Lengte 0 betekent "dit symbool komt niet voor" en telt dus niet mee als code.
  aantal[0] = 0;

  const start = new Int32Array(MAX_BITS + 2);
  for (let l = 1; l <= MAX_BITS; l++) {
    start[l + 1] = start[l] + aantal[l];
  }

  const symbolen = new Int32Array(lengtes.length);
  for (let symbool = 0; symbool < lengtes.length; symbool++) {
    const lengte = lengtes[symbool];
    if (lengte !== 0) {
      symbolen[start[lengte]++] = symbool;
    }
  }

  return { aantal, symbolen };
}

/**
 * Leest één symbool.
 *
 * Bit voor bit van hoog naar laag: elk gelezen bit schuift onderaan de code aan. Per lengte
 * wordt gekeken of de code binnen het bereik van die lengte valt; zo ja, dan wijst hij een
 * symbool aan. Zo hoeft er geen tabel van 32768 ingangen opgebouwd te worden voor een
 * bestand van een paar honderd kilobyte.
 */
function leesSymbool(lezer: Bitlezer, boom: Huffman): number {
  let code = 0;
  let eerste = 0;
  let index = 0;
  for (let lengte = 1; lengte <= MAX_BITS; lengte++) {
    code |= lezer.eenBit();
    const hier = boom.aantal[lengte];
    if (code - eerste < hier) {
      return boom.symbolen[index + (code - eerste)];
    }
    index += hier;
    eerste = (eerste + hier) << 1;
    code <<= 1;
  }
  throw new Error('Een Huffman-code in het bestand hoort bij geen enkel symbool.');
}

// De vaste bomen uit de specificatie, één keer opgebouwd. De literal/lengte-boom heeft de
// vaste verdeling 8-8-9-7 (0-143 op 8 bits, 144-255 op 9, 256-279 op 7, 280-287 op 8); de
// afstandsboom is dertig codes van elk 5 bits.
const VASTE_LITERALEN: Huffman = (() => {
  const lengtes: number[] = [];
  for (let s = 0; s <= 287; s++) {
    lengtes.push(s <= 143 ? 8 : s <= 255 ? 9 : s <= 279 ? 7 : 8);
  }
  return bouwHuffman(lengtes);
})();

const VASTE_AFSTANDEN: Huffman = bouwHuffman(new Array<number>(30).fill(5));

// ---------------------------------------------------------------------------
// De uitvoer
// ---------------------------------------------------------------------------

/**
 * Een buffer die meegroeit. Verdubbelen in plaats van per byte herallocieren; met een
 * verwachte lengte erbij begint hij meteen op maat en groeit hij nooit.
 */
function uitvoer(beginmaat: number) {
  let bytes = new Uint8Array(Math.max(beginmaat, 64));
  let lengte = 0;

  function ruimte(extra: number): void {
    if (lengte + extra <= bytes.length) return;
    let nieuw = bytes.length;
    while (nieuw < lengte + extra) {
      nieuw *= 2;
    }
    const groter = new Uint8Array(nieuw);
    groter.set(bytes.subarray(0, lengte));
    bytes = groter;
  }

  return {
    schrijf(byte: number): void {
      ruimte(1);
      bytes[lengte++] = byte;
    },
    /**
     * Kopieert `aantal` bytes van `afstand` terug, byte voor byte.
     *
     * Met opzet geen `set`/`subarray`: een kopie mag over zichzelf heen lopen (afstand 1,
     * lengte 10 is tien keer dezelfde byte) en dat is geen randgeval maar de gewone gang van
     * zaken in een DEFLATE-stroom. Wie eerst een stuk uitsnijdt en dat dan aanplakt, leest
     * bytes die op dat moment nog niet geschreven zijn.
     */
    kopieer(afstand: number, aantal: number): void {
      if (afstand > lengte) {
        throw new Error('Het bestand verwijst naar gegevens van voor het begin van de stroom.');
      }
      ruimte(aantal);
      let van = lengte - afstand;
      for (let i = 0; i < aantal; i++) {
        bytes[lengte++] = bytes[van++];
      }
    },
    get lengte() {
      return lengte;
    },
    klaar(): Uint8Array {
      return bytes.slice(0, lengte);
    },
  };
}

type Uitvoer = ReturnType<typeof uitvoer>;

// ---------------------------------------------------------------------------
// De blokken
// ---------------------------------------------------------------------------

/** Een onverpakt blok: uitlijnen, LEN en NLEN lezen, dan LEN bytes overnemen. */
function opgeslagenBlok(lezer: Bitlezer, uit: Uitvoer): void {
  lezer.uitlijnen();
  const len = lezer.byte() | (lezer.byte() << 8);
  const nlen = lezer.byte() | (lezer.byte() << 8);
  // De enige controle die het formaat op een opgeslagen blok heeft: NLEN is het
  // eencomplement van LEN. Klopt dat niet, dan is de stroom niet wat hij zegt te zijn en
  // zouden we hier een willekeurig aantal bytes gaan overnemen.
  if ((len ^ 0xffff) !== nlen) {
    throw new Error('Een onverpakt blok heeft een lengte die zichzelf tegenspreekt.');
  }
  for (let i = 0; i < len; i++) {
    uit.schrijf(lezer.byte());
  }
}

/** Een blok met Huffman-codes, vast of dynamisch — de lus is voor allebei dezelfde. */
function huffmanBlok(lezer: Bitlezer, uit: Uitvoer, literalen: Huffman, afstanden: Huffman): void {
  for (;;) {
    const symbool = leesSymbool(lezer, literalen);
    if (symbool < 256) {
      uit.schrijf(symbool);
      continue;
    }
    if (symbool === 256) {
      return;
    }
    const lengtecode = symbool - 257;
    if (lengtecode >= LENGTE_BASIS.length) {
      throw new Error('Het bestand gebruikt een lengtecode die niet bestaat.');
    }
    const lengte = LENGTE_BASIS[lengtecode] + lezer.bits(LENGTE_EXTRA[lengtecode]);

    const afstandscode = leesSymbool(lezer, afstanden);
    if (afstandscode >= AFSTAND_BASIS.length) {
      throw new Error('Het bestand gebruikt een afstandscode die niet bestaat.');
    }
    const afstand = AFSTAND_BASIS[afstandscode] + lezer.bits(AFSTAND_EXTRA[afstandscode]);

    uit.kopieer(afstand, lengte);
  }
}

/**
 * Pakt een rauwe DEFLATE-stroom uit (RFC 1951, geen zlib-kop, geen gzip-kop).
 *
 * `verwachteLengte` is de uitgepakte maat zoals de zip-kop hem opgeeft: hij spaart het
 * meegroeien uit. Gaat er iets mis met de bytes zelf, dan is dat een stukgeslagen bestand en
 * geen bedrijfsregel — vandaar `throw` en geen uitkomsttype. Het scherm vangt hem verderop
 * op als één fout over het hele bestand.
 */
export function inflate(bytes: Uint8Array, verwachteLengte?: number): Uint8Array {
  const lezer = bitlezer(bytes);
  const uit = uitvoer(verwachteLengte ?? 1024);

  for (;;) {
    const laatste = lezer.eenBit();
    const bloksoort = lezer.bits(2);
    if (bloksoort === 0) {
      opgeslagenBlok(lezer, uit);
    } else if (bloksoort === 1) {
      huffmanBlok(lezer, uit, VASTE_LITERALEN, VASTE_AFSTANDEN);
    } else if (bloksoort === 2) {
      throw new Error('Dit bestand gebruikt een bloksoort die nog niet gelezen kan worden.');
    } else {
      // Bloksoort 3 bestaat niet in RFC 1951 en is dus altijd een teken dat de bytes niet
      // zijn wat ze beweren.
      throw new Error('Het bestand bevat een bloksoort die niet bestaat.');
    }
    if (laatste === 1) {
      return uit.klaar();
    }
  }
}
