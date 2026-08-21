import {
  buildXlsx, bladXml, bladnaam, crc32, datumNaarSerie, kolomLetter, zip, type XlsxCel,
} from './xlsx';

// ---------------------------------------------------------------------------
// Een minimale zip-lezer, alleen voor deze tests.
//
// De schrijver testen tegen zijn eigen aannames zegt niets; hij moet leesbaar zijn voor een
// programma dat het formaat kent en niet dit bestand. Daarom wordt hier alleen de centrale
// map gevolgd — precies wat Excel ook doet — in plaats van de bytes na te tellen die de
// schrijver zelf net heeft neergezet.
// ---------------------------------------------------------------------------

function u16(b: Uint8Array, at: number): number {
  return b[at] | (b[at + 1] << 8);
}

function u32(b: Uint8Array, at: number): number {
  return (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;
}

function tekst(b: Uint8Array): string {
  // Alleen de tests lezen dit; de bestanden hierin zijn UTF-8.
  let uit = '';
  for (let i = 0; i < b.length; i++) {
    const c = b[i];
    if (c < 0x80) {
      uit += String.fromCharCode(c);
    } else if ((c & 0xe0) === 0xc0) {
      uit += String.fromCharCode(((c & 0x1f) << 6) | (b[++i] & 0x3f));
      /* c8 ignore next */
    } else if ((c & 0xf0) === 0xe0) {
      uit += String.fromCharCode(((c & 0x0f) << 12) | ((b[++i] & 0x3f) << 6) | (b[++i] & 0x3f));
    }
  }
  return uit;
}

interface GelezenIngang {
  naam: string;
  inhoud: Uint8Array;
  crc: number;
}

/** De ingangen van een zip, gevonden via de centrale map achteraan. */
function leesZip(bytes: Uint8Array): GelezenIngang[] {
  // Het einde van de centrale map heeft geen vaste plek; zoek de handtekening van achteren.
  let eind = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (u32(bytes, i) === 0x06054b50) {
      eind = i;
      break;
    }
  }
  if (eind < 0) throw new Error('geen zip: het einde van de centrale map ontbreekt');

  const aantal = u16(bytes, eind + 10);
  let pos = u32(bytes, eind + 16);
  const uit: GelezenIngang[] = [];

  for (let n = 0; n < aantal; n++) {
    if (u32(bytes, pos) !== 0x02014b50) throw new Error('kapotte rij in de centrale map');
    const crc = u32(bytes, pos + 16);
    const grootte = u32(bytes, pos + 24);
    const naamLengte = u16(bytes, pos + 28);
    const extraLengte = u16(bytes, pos + 30);
    const opmerkingLengte = u16(bytes, pos + 32);
    const lokaal = u32(bytes, pos + 42);
    const naam = tekst(bytes.subarray(pos + 46, pos + 46 + naamLengte));

    // Vanaf de lokale kop: 30 vaste bytes, dan de naam en het extra veld, dan de inhoud.
    if (u32(bytes, lokaal) !== 0x04034b50) throw new Error('kapotte lokale kop');
    const lokaalNaam = u16(bytes, lokaal + 26);
    const lokaalExtra = u16(bytes, lokaal + 28);
    const begin = lokaal + 30 + lokaalNaam + lokaalExtra;

    uit.push({ naam, crc, inhoud: bytes.subarray(begin, begin + grootte) });
    pos += 46 + naamLengte + extraLengte + opmerkingLengte;
  }
  return uit;
}

function inhoudVan(bytes: Uint8Array, naam: string): string {
  const ingang = leesZip(bytes).find((i) => i.naam === naam);
  if (!ingang) throw new Error(`${naam} zit niet in het bestand`);
  return tekst(ingang.inhoud);
}

function bytesVan(text: string): Uint8Array {
  return new Uint8Array([...text].map((c) => c.charCodeAt(0)));
}

// ---------------------------------------------------------------------------

describe('crc32', () => {
  // De bekende waarden uit de specificatie; hiermee staat vast dat de tabel klopt.
  it('geeft 0 voor niets', () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it('komt uit op de bekende waarde voor "123456789"', () => {
    expect(crc32(bytesVan('123456789'))).toBe(0xcbf43926);
  });

  it('komt uit op de bekende waarde voor "The quick brown fox jumps over the lazy dog"', () => {
    expect(crc32(bytesVan('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339);
  });
});

describe('kolomLetter', () => {
  it('telt de eerste zesentwintig als één letter', () => {
    expect(kolomLetter(0)).toBe('A');
    expect(kolomLetter(11)).toBe('L');
    expect(kolomLetter(25)).toBe('Z');
  });

  it('gaat daarna door met twee letters', () => {
    expect(kolomLetter(26)).toBe('AA');
    expect(kolomLetter(27)).toBe('AB');
    expect(kolomLetter(51)).toBe('AZ');
    expect(kolomLetter(52)).toBe('BA');
  });
});

describe('datumNaarSerie', () => {
  // Excel telt een 29 februari 1900 mee die nooit bestaan heeft. Daardoor toont het voor
  // 1 januari 1900 het getal 1, terwijl doortellen vanaf de vaste epoch 2 geeft. Die ene dag
  // verschil geldt alleen vóór 1 maart 1900; vanaf die datum lopen beide tellingen gelijk.
  // Deze test legt vast wat de code doet en niet wat Excel toont: een club exporteert geen
  // lessen uit 1900, en de uitzondering inbouwen zou de functie ingewikkelder maken voor een
  // geval dat nooit voorkomt.
  it('telt door vanaf de vaste epoch, ook waar Excel zijn eigen schrikkeldag heeft', () => {
    expect(datumNaarSerie(new Date(1900, 0, 1))).toBe(2);
  });

  it('geeft vanaf 1 maart 1900 hetzelfde getal als Excel', () => {
    expect(datumNaarSerie(new Date(1900, 2, 1))).toBe(61);
  });

  it('zet een dag uit deze tijd op het getal dat Excel toont', () => {
    expect(datumNaarSerie(new Date(2026, 7, 20))).toBe(46254);
  });

  it('telt op de kalenderdag en niet op het uur', () => {
    const ochtend = datumNaarSerie(new Date(2026, 7, 20, 8, 0));
    const nacht = datumNaarSerie(new Date(2026, 7, 20, 23, 30));
    expect(nacht).toBe(ochtend);
  });
});

describe('bladnaam', () => {
  it('laat een gewone naam met rust', () => {
    expect(bladnaam('Lessen')).toBe('Lessen');
  });

  it('haalt de tekens eruit die Excel niet toestaat', () => {
    expect(bladnaam('Lessen/2026:aug')).toBe('Lessen 2026 aug');
  });

  it('kort af op eenendertig tekens', () => {
    expect(bladnaam('x'.repeat(50))).toHaveLength(31);
  });

  it('valt terug op een naam als er niets overblijft', () => {
    expect(bladnaam('   ')).toBe('Blad1');
  });
});

describe('zip', () => {
  const ingangen = [
    { naam: 'een.txt', inhoud: bytesVan('hallo') },
    { naam: 'map/twee.txt', inhoud: bytesVan('daar') },
  ];

  it('bewaart de namen en de inhoud', () => {
    const gelezen = leesZip(zip(ingangen));
    expect(gelezen.map((i) => i.naam)).toEqual(['een.txt', 'map/twee.txt']);
    expect(tekst(gelezen[0].inhoud)).toBe('hallo');
    expect(tekst(gelezen[1].inhoud)).toBe('daar');
  });

  it('zet bij elke ingang de controlesom van zijn eigen inhoud', () => {
    for (const gelezen of leesZip(zip(ingangen))) {
      expect(gelezen.crc).toBe(crc32(gelezen.inhoud));
    }
  });

  it('levert twee keer achter elkaar hetzelfde bestand', () => {
    expect(Array.from(zip(ingangen))).toEqual(Array.from(zip(ingangen)));
  });

  it('kan ook helemaal leeg', () => {
    expect(leesZip(zip([]))).toEqual([]);
  });
});

describe('bladXml', () => {
  const blad = {
    naam: 'Lessen',
    koppen: ['Datum', 'Bedrag'],
    rijen: [[
      { soort: 'datum', waarde: new Date(2026, 7, 20) },
      { soort: 'geld', waarde: 30 },
    ] as XlsxCel[]],
  };

  it('zet de koppen op rij 1 en de gegevens daaronder', () => {
    const xml = bladXml(blad);
    expect(xml).toContain('<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">Datum</t></is></c>');
    expect(xml).toContain('<row r="2">');
  });

  it('schrijft een bedrag als getal en niet als tekst', () => {
    expect(bladXml(blad)).toContain('<c r="B2" s="2"><v>30</v></c>');
  });

  it('schrijft een datum als het dagnummer van Excel', () => {
    expect(bladXml(blad)).toContain('<c r="A2" s="3"><v>46254</v></c>');
  });

  it('noemt het bereik van het blad', () => {
    expect(bladXml(blad)).toContain('<dimension ref="A1:B2"/>');
  });

  it('zet een filter op de koprij en bevriest hem', () => {
    const xml = bladXml(blad);
    expect(xml).toContain('<autoFilter ref="A1:B2"/>');
    expect(xml).toContain('state="frozen"');
  });

  it('ontsnapt tekens die XML anders stukmaken', () => {
    const xml = bladXml({
      naam: 'x',
      koppen: ['a'],
      rijen: [[{ soort: 'tekst', waarde: 'Jan & Piet <"lang">' }]],
    });
    expect(xml).toContain('Jan &amp; Piet &lt;&quot;lang&quot;&gt;');
    expect(xml).not.toContain('<"lang">');
  });

  it('gooit stuurtekens weg, want daar weigert Excel het hele bestand op', () => {
    const xml = bladXml({
      naam: 'x',
      koppen: ['a'],
      rijen: [[{ soort: 'tekst', waarde: 'voorna' }]],
    });
    expect(xml).toContain('voorna');
  });

  it('zet de kolombreedtes erin als ze meegegeven zijn', () => {
    expect(bladXml({ ...blad, breedtes: [12, 15] }))
      .toContain('<col min="1" max="1" width="12" customWidth="1"/>');
  });

  it('laat de breedtes weg als ze er niet zijn', () => {
    expect(bladXml(blad)).not.toContain('<cols>');
  });
});

describe('buildXlsx', () => {
  const bestand = buildXlsx({
    naam: 'Lessen',
    koppen: ['Datum', 'Trainer', 'Prijs les (EUR)'],
    rijen: [
      [
        { soort: 'datum', waarde: new Date(2026, 7, 20) },
        { soort: 'tekst', waarde: 'Koen' },
        { soort: 'geld', waarde: 30 },
      ],
      [
        { soort: 'datum', waarde: new Date(2026, 7, 21) },
        { soort: 'tekst', waarde: 'Sanne' },
        { soort: 'geld', waarde: 27.5 },
      ],
    ],
  });

  it('is een leesbare zip', () => {
    expect(leesZip(bestand).length).toBeGreaterThan(0);
  });

  it('begint met de handtekening waaraan elk programma een zip herkent', () => {
    expect(Array.from(bestand.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('bevat precies de onderdelen die een werkmap nodig heeft', () => {
    expect(leesZip(bestand).map((i) => i.naam)).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
    ]);
  });

  it('noemt elk onderdeel in [Content_Types].xml', () => {
    const types = inhoudVan(bestand, '[Content_Types].xml');
    expect(types).toContain('/xl/workbook.xml');
    expect(types).toContain('/xl/worksheets/sheet1.xml');
    expect(types).toContain('/xl/styles.xml');
  });

  it('wijst vanuit de werkmap naar het blad en de opmaak', () => {
    const rels = inhoudVan(bestand, 'xl/_rels/workbook.xml.rels');
    expect(rels).toContain('Target="worksheets/sheet1.xml"');
    expect(rels).toContain('Target="styles.xml"');
  });

  it('zet de naam op het tabblad', () => {
    expect(inhoudVan(bestand, 'xl/workbook.xml')).toContain('name="Lessen"');
  });

  it('heeft de vier stijlen waar het blad naar verwijst', () => {
    const stijlen = inhoudVan(bestand, 'xl/styles.xml');
    expect(stijlen).toContain('<cellXfs count="4">');
    expect(stijlen).toContain('formatCode="#,##0.00"');
    expect(stijlen).toContain('formatCode="dd/mm/yyyy"');
  });

  it('zet alle rijen in het blad', () => {
    const blad = inhoudVan(bestand, 'xl/worksheets/sheet1.xml');
    expect(blad).toContain('Koen');
    expect(blad).toContain('Sanne');
    expect(blad).toContain('<v>27.5</v>');
  });

  it('levert twee keer achter elkaar hetzelfde bestand', () => {
    const nogmaals = buildXlsx({ naam: 'Lessen', koppen: ['a'], rijen: [] });
    const enNogmaals = buildXlsx({ naam: 'Lessen', koppen: ['a'], rijen: [] });
    expect(Array.from(nogmaals)).toEqual(Array.from(enNogmaals));
  });

  it('maakt de bladnaam net voor hij hem wegschrijft', () => {
    const raar = buildXlsx({ naam: 'Lessen/aug', koppen: ['a'], rijen: [] });
    expect(inhoudVan(raar, 'xl/workbook.xml')).toContain('name="Lessen aug"');
  });
});
