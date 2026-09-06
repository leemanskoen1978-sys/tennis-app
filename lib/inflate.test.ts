import { inflate } from './inflate';

// ---------------------------------------------------------------------------
// De bytevectoren hieronder zijn buiten deze codebase om vastgesteld (python3 zlib) en
// staan er letterlijk in. Dat is met opzet: een uitpakker testen tegen zijn eigen aannames
// bewijst niets. Wat hier staat is wat een ander programma dat het formaat kent ervan maakt.
// Kort ze niet in en herbereken ze niet.
// ---------------------------------------------------------------------------

/** Hex naar bytes — leesbaarder in een test dan een lijst van 122 getallen. */
function bytesVan(hex: string): Uint8Array {
  const uit = new Uint8Array(hex.length / 2);
  for (let i = 0; i < uit.length; i++) {
    uit[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return uit;
}

/**
 * Bytes naar tekst, met de hand. Geen `TextDecoder`, om dezelfde reden als `utf8()` in
 * `lib/xlsx.ts`: "bestaat tegenwoordig overal" is precies de aanname die op een toestel van
 * iemand anders omvalt. Alle vectoren hier zijn ASCII, maar de meerbyte-tak staat erbij
 * zodat de test niet stilletjes iets anders meet dan het echte werk.
 */
function tekstVan(bytes: Uint8Array): string {
  let uit = '';
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    if (c < 0x80) {
      uit += String.fromCharCode(c);
    } else if ((c & 0xe0) === 0xc0) {
      uit += String.fromCharCode(((c & 0x1f) << 6) | (bytes[++i] & 0x3f));
    } else {
      uit += String.fromCharCode(((c & 0x0f) << 12) | ((bytes[++i] & 0x3f) << 6) | (bytes[++i] & 0x3f));
    }
  }
  return uit;
}

describe('inflate — opgeslagen blok (BTYPE 0)', () => {
  it('pakt een onverpakt blok byte-voor-byte uit', () => {
    const uit = inflate(bytesVan('010c00f3ff48616c6c6f2074656e6e6973'));
    expect(tekstVan(uit)).toBe('Hallo tennis');
    expect(uit.length).toBe(12);
  });

  it('plakt twee blokken achter elkaar aan elkaar; alleen de eindvlag stopt het uitpakken', () => {
    // Eerst een blok zónder eindvlag ("Hallo"), dan een blok mét (" tennis"). Wie na het
    // eerste blok stopt houdt hier de helft over.
    const uit = inflate(bytesVan('000500faff48616c6c6f010700f8ff2074656e6e6973'));
    expect(tekstVan(uit)).toBe('Hallo tennis');
  });

  it('weigert een opgeslagen blok waarvan NLEN niet het eencomplement van LEN is', () => {
    // Zelfde blok als hierboven, maar met een verminkte NLEN: dat is de enige controle die
    // het formaat zelf op een opgeslagen blok heeft.
    expect(() => inflate(bytesVan('010c0000ff48616c6c6f2074656e6e6973'))).toThrow();
  });
});

describe('inflate — vaste Huffman (BTYPE 1)', () => {
  it('kopieert een terugverwijzing met afstand 1 over zichzelf heen', () => {
    // Tien keer "a" komt uit een venster van één byte: de kopie leest bytes die ze zelf net
    // geschreven heeft. Wie met slice/set werkt in plaats van byte voor byte, faalt hier.
    const uit = inflate(bytesVan('4b4c848124380000'));
    expect(tekstVan(uit)).toBe('aaaaaaaaaabbbbbbbbbb');
  });

  it('kopieert een overlappende terugverwijzing met afstand 3', () => {
    const uit = inflate(bytesVan('4b4c4a4e444200'));
    expect(tekstVan(uit)).toBe('abcabcabcabcabc');
  });
});

describe('inflate — een stukgeslagen stroom', () => {
  it('geeft een fout op een lege invoer in plaats van een lege uitvoer', () => {
    // Een stroom zonder eindblok is stuk. Stil niets teruggeven zou verderop als een leeg
    // werkblad binnenkomen, en dat is een verkeerd antwoord op een kapot bestand.
    expect(() => inflate(new Uint8Array(0))).toThrow();
  });

  it('geeft een fout als de bits opraken vóór het eindblok', () => {
    // Een vast-Huffman-blok zonder eindvlag en zonder eindsymbool: de lezer loopt hier van
    // het einde van de invoer af.
    expect(() => inflate(bytesVan('4a4c4a'))).toThrow();
  });
});
