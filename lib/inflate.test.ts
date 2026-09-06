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

// De vierde vector, dynamische Huffman. Dit is de bloksoort die er echt toe doet: elke
// ingang van een xlsx dat Excel zelf schrijft staat er zo in. Hij bevat ook de herhaalcodes
// 16, 17 en 18 in de codelengtelijst — geen apart geval, maar wat Excel altijd schrijft.
const VECTOR_DYNAMISCH =
  '0dcac911c3200c00c0562880514f5ce60828b224c0b8fa64df5b8453579a12d419aa5cf226364c63422a33c13d1eb74eb88ef8769c814afad8b15f1ccf2bdf647bf489725d782634bccd90ce8252ec6739a8baf6b5e1c35624ee99a791da62209814fa1bd026d7f02044af7afcd8f29ff52ebeb910957dc6a63f';

const VECTOR_DYNAMISCH_UIT =
  'hsreltpuscta pirhgwpr rpmu.ehue.qmxavycfysbjya .iptx,mwznmxzsoe,ldbepgivnyu.jnq mslrsnsh,kva.itvwfw.kr,ssdwugu sijdcp.upclzcn,eajnyn.dbttybmwskr,iqhbjacdtrbgnjt';

describe('inflate — dynamische Huffman (BTYPE 2)', () => {
  it('pakt een blok met eigen Huffman-bomen byte-exact uit', () => {
    const uit = inflate(bytesVan(VECTOR_DYNAMISCH));
    expect(tekstVan(uit)).toBe(VECTOR_DYNAMISCH_UIT);
    expect(uit.length).toBe(160);
  });

  it('vouwt de herhaalcodes 16, 17 en 18 in de codelengtelijst correct uit', () => {
    // Dezelfde vector, nu met de verwachte lengte erbij zoals de zip-kop hem later opgeeft:
    // dat pad mag geen ander antwoord geven dan het meegroeiende pad.
    const uit = inflate(bytesVan(VECTOR_DYNAMISCH), 160);
    expect(tekstVan(uit)).toBe(VECTOR_DYNAMISCH_UIT);
  });

  it('geeft twee keer op dezelfde invoer exact dezelfde bytes', () => {
    const eerste = inflate(bytesVan(VECTOR_DYNAMISCH));
    const tweede = inflate(bytesVan(VECTOR_DYNAMISCH));
    expect(Array.from(tweede)).toEqual(Array.from(eerste));
  });
});

describe('inflate — grenzen tegen een stukgeslagen bestand', () => {
  it('geeft een fout als een dynamisch blok halverwege afgekapt is', () => {
    // Een xlsx dat halverwege het downloaden afbrak. Het scherm mag daarvan niet vastlopen
    // en er mag geen halve uitvoer uit komen die verderop als geldige gegevens doorgaat.
    const afgekapt = VECTOR_DYNAMISCH.slice(0, VECTOR_DYNAMISCH.length - 40);
    expect(() => inflate(bytesVan(afgekapt))).toThrow();
  });

  it('geeft een fout zodra er meer uitgepakt wordt dan de opgegeven bovengrens', () => {
    // De zip-kop zegt hoe groot deze ingang uitgepakt hoort te zijn. Is dat niet waar, dan
    // is het bestand stuk of opzettelijk misvormd — een zip-bom is precies dat.
    expect(() => inflate(bytesVan('010c00f3ff48616c6c6f2074656e6e6973'), 5)).toThrow();
  });

  it('geeft een fout op een bloksoort die niet bestaat', () => {
    // Eén byte: eindvlag aan, bloksoort 3. Die bestaat niet in RFC 1951.
    expect(() => inflate(bytesVan('07'))).toThrow();
  });
});
