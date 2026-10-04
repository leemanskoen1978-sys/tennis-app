import {
  buildXlsx, buildWorkbook, buildVrijWorkbook, bladXml, vrijBladXml,
  refOntleden, bladnaam, crc32, datumNaarSerie, kolomLetter, zip,
  type XlsxCel, type XlsxVrijBlad,
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

describe('buildWorkbook', () => {
  const drieBladen = buildWorkbook([
    {
      naam: 'Lessen',
      koppen: ['Datum', 'Trainer'],
      rijen: [[{ soort: 'datum', waarde: new Date(2026, 7, 20) }, { soort: 'tekst', waarde: 'Koen' }]],
    },
    {
      naam: 'Uren per trainer',
      koppen: ['Trainer', 'Uren', 'Prijs les (EUR)'],
      rijen: [[
        { soort: 'tekst', waarde: 'Sanne' },
        { soort: 'getal', waarde: 12 },
        { soort: 'geld', waarde: 27.5 },
      ]],
    },
    {
      naam: 'Aanwezigheid',
      koppen: ['Lid'],
      rijen: [[{ soort: 'tekst', waarde: 'Emma' }]],
    },
  ]);

  it('zet elk blad als een eigen werkblad in de zip', () => {
    expect(leesZip(drieBladen).map((i) => i.naam)).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
      'xl/worksheets/sheet2.xml',
      'xl/worksheets/sheet3.xml',
    ]);
  });

  it('noemt elk blad in [Content_Types].xml', () => {
    const types = inhoudVan(drieBladen, '[Content_Types].xml');
    expect(types).toContain('/xl/worksheets/sheet1.xml');
    expect(types).toContain('/xl/worksheets/sheet2.xml');
    expect(types).toContain('/xl/worksheets/sheet3.xml');
    expect(types).toContain('/xl/styles.xml');
  });

  it('houdt de tabvolgorde aan die de aanroeper meegeeft', () => {
    const werkmap = inhoudVan(drieBladen, 'xl/workbook.xml');
    expect(werkmap.indexOf('name="Lessen"')).toBeLessThan(werkmap.indexOf('name="Uren per trainer"'));
    expect(werkmap.indexOf('name="Uren per trainer"')).toBeLessThan(werkmap.indexOf('name="Aanwezigheid"'));
    expect(werkmap).toContain('sheetId="3"');
    expect(werkmap).toContain('r:id="rId3"');
  });

  it('wijst elke rId naar zijn eigen blad, en de laatste naar de opmaak', () => {
    const rels = inhoudVan(drieBladen, 'xl/_rels/workbook.xml.rels');
    expect(rels).toContain('Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"');
    expect(rels).toContain('Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"');
    expect(rels).toContain('Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"');
    expect(rels).toContain('Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"');
  });

  it('zet de rijen op het blad waar ze horen', () => {
    expect(inhoudVan(drieBladen, 'xl/worksheets/sheet1.xml')).toContain('Koen');
    expect(inhoudVan(drieBladen, 'xl/worksheets/sheet2.xml')).toContain('Sanne');
    expect(inhoudVan(drieBladen, 'xl/worksheets/sheet3.xml')).toContain('Emma');
  });

  it('houdt een bedrag een bedrag, ook op het tweede blad', () => {
    const tweede = inhoudVan(drieBladen, 'xl/worksheets/sheet2.xml');
    expect(tweede).toContain('<v>27.5</v>');
    expect(tweede).not.toContain('27,5');
  });

  it('houdt een datum een datumserie, ook buiten het eerste blad', () => {
    const serie = datumNaarSerie(new Date(2026, 7, 20));
    const werkmap = buildWorkbook([
      { naam: 'Leeg', koppen: ['a'], rijen: [] },
      { naam: 'Lessen', koppen: ['Datum'], rijen: [[{ soort: 'datum', waarde: new Date(2026, 7, 20) }]] },
    ]);
    expect(inhoudVan(werkmap, 'xl/worksheets/sheet2.xml')).toContain(`<v>${serie}</v>`);
  });

  it('geeft twee bladen met dezelfde naam elk een eigen tabnaam', () => {
    const werkmap = buildWorkbook([
      { naam: 'Lessen', koppen: ['a'], rijen: [] },
      { naam: 'Lessen', koppen: ['a'], rijen: [] },
      { naam: 'Lessen', koppen: ['a'], rijen: [] },
    ]);
    const namen = [...inhoudVan(werkmap, 'xl/workbook.xml').matchAll(/name="([^"]*)"/g)].map((m) => m[1]);
    expect(namen[0]).toBe('Lessen');
    expect(new Set(namen).size).toBe(3);
    expect(namen.every((n) => n.length <= 31)).toBe(true);
  });

  it('maakt de bladnaam net zoals buildXlsx dat doet', () => {
    const werkmap = buildWorkbook([{ naam: 'Lessen/aug', koppen: ['a'], rijen: [] }]);
    expect(inhoudVan(werkmap, 'xl/workbook.xml')).toContain('name="Lessen aug"');
  });

  it('levert bij één blad hetzelfde bestand als buildXlsx', () => {
    const blad = {
      naam: 'Lessen',
      koppen: ['Datum', 'Prijs les (EUR)'],
      rijen: [[
        { soort: 'datum', waarde: new Date(2026, 7, 20) },
        { soort: 'geld', waarde: 30 },
      ]] as ReadonlyArray<readonly XlsxCel[]>,
      breedtes: [12, 14],
    };
    expect(Array.from(buildWorkbook([blad]))).toEqual(Array.from(buildXlsx(blad)));
  });

  it('levert twee keer achter elkaar hetzelfde bestand', () => {
    const bladen = [
      { naam: 'Lessen', koppen: ['a'], rijen: [] },
      { naam: 'Groepen', koppen: ['b'], rijen: [] },
    ];
    expect(Array.from(buildWorkbook(bladen))).toEqual(Array.from(buildWorkbook(bladen)));
  });
});

// ---------------------------------------------------------------------------
// Een blad met cellen op hun plaats, in plaats van een tabel. Voor de factuur.
// ---------------------------------------------------------------------------

function vrij(velden: Partial<XlsxVrijBlad> = {}): XlsxVrijBlad {
  return {
    naam: 'Factuur',
    cellen: [{ ref: 'A1', cel: { soort: 'tekst', waarde: 'hallo' } }],
    ...velden,
  };
}

describe('refOntleden', () => {
  it('leest een gewone verwijzing', () => {
    expect(refOntleden('A1')).toEqual({ rij: 1, kolom: 0 });
    expect(refOntleden('H7')).toEqual({ rij: 7, kolom: 7 });
    expect(refOntleden('I43')).toEqual({ rij: 43, kolom: 8 });
  });

  it('leest een verwijzing met twee letters', () => {
    expect(refOntleden('AA3')).toEqual({ rij: 3, kolom: 26 });
  });

  it('weigert iets wat geen verwijzing is', () => {
    expect(() => refOntleden('zomaar')).toThrow();
    expect(() => refOntleden('A0')).toThrow();
  });

  it('leest een verwijzing met kleine letters en spaties eromheen', () => {
    expect(refOntleden(' h7 ')).toEqual({ rij: 7, kolom: 7 });
  });

  it('is het omgekeerde van kolomLetter, ook voorbij Z', () => {
    // A, Z, AA, AZ, BA, ZZ — de plekken waar een kolomteller het laat afweten.
    for (const kolom of [0, 25, 26, 51, 52, 701]) {
      expect(refOntleden(`${kolomLetter(kolom)}3`)).toEqual({ rij: 3, kolom });
    }
  });
});

describe('vrijBladXml', () => {
  it('zet een cel op de plaats die de verwijzing noemt', () => {
    const xml = vrijBladXml(vrij({
      cellen: [{ ref: 'H7', cel: { soort: 'tekst', waarde: 'Datum' } }],
    }));
    expect(xml).toContain('<row r="7">');
    expect(xml).toContain('<c r="H7" t="inlineStr"><is><t xml:space="preserve">Datum</t></is></c>');
  });

  it('zet de rijen oplopend, ook als de cellen door elkaar binnenkomen', () => {
    const xml = vrijBladXml(vrij({
      cellen: [
        { ref: 'A9', cel: { soort: 'tekst', waarde: 'negen' } },
        { ref: 'A2', cel: { soort: 'tekst', waarde: 'twee' } },
      ],
    }));
    expect(xml.indexOf('<row r="2">')).toBeLessThan(xml.indexOf('<row r="9">'));
  });

  it('zet de cellen binnen een rij op kolomvolgorde', () => {
    const xml = vrijBladXml(vrij({
      cellen: [
        { ref: 'I3', cel: { soort: 'tekst', waarde: 'negen' } },
        { ref: 'B3', cel: { soort: 'tekst', waarde: 'twee' } },
      ],
    }));
    expect(xml.indexOf('r="B3"')).toBeLessThan(xml.indexOf('r="I3"'));
  });

  it('maakt een tekstcel vet als dat gevraagd wordt', () => {
    const xml = vrijBladXml(vrij({
      cellen: [{ ref: 'A5', cel: { soort: 'tekst', waarde: 'Mijn gegevens' }, vet: true }],
    }));
    expect(xml).toContain('<c r="A5" t="inlineStr" s="1">');
  });

  it('houdt de stijl van een bedrag en van een datum aan', () => {
    const xml = vrijBladXml(vrij({
      cellen: [
        { ref: 'I24', cel: { soort: 'geld', waarde: 248 } },
        { ref: 'H7', cel: { soort: 'datum', waarde: new Date(2026, 9, 1) } },
      ],
    }));
    expect(xml).toContain('<c r="I24" s="2"><v>248</v></c>');
    expect(xml).toContain(`<c r="H7" s="3"><v>${datumNaarSerie(new Date(2026, 9, 1))}</v></c>`);
  });

  it('schrijft de samengevoegde bereiken weg, ná de gegevens', () => {
    const xml = vrijBladXml(vrij({ samengevoegd: ['A23:E23', 'A30:F30'] }));
    expect(xml).toContain('<mergeCells count="2"><mergeCell ref="A23:E23"/><mergeCell ref="A30:F30"/></mergeCells>');
    expect(xml.indexOf('</sheetData>')).toBeLessThan(xml.indexOf('<mergeCells'));
  });

  it('laat mergeCells weg als er niets samengevoegd is', () => {
    expect(vrijBladXml(vrij())).not.toContain('mergeCells');
  });

  it('laat de afmeting tot aan de verste cel lopen', () => {
    const xml = vrijBladXml(vrij({
      cellen: [
        { ref: 'A1', cel: { soort: 'tekst', waarde: 'x' } },
        { ref: 'I43', cel: { soort: 'tekst', waarde: 'y' } },
      ],
    }));
    expect(xml).toContain('<dimension ref="A1:I43"/>');
  });

  it('bevriest niets en filtert niets — een factuur is geen lijst', () => {
    const xml = vrijBladXml(vrij());
    expect(xml).not.toContain('autoFilter');
    expect(xml).not.toContain('frozen');
  });

  it('schrijft de kolombreedtes weg', () => {
    const xml = vrijBladXml(vrij({ breedtes: [38, 10] }));
    expect(xml).toContain('<col min="1" max="1" width="38" customWidth="1"/>');
  });

  it('weigert twee cellen op dezelfde plaats', () => {
    // Excel zou zo'n blad alleen openen na een "herstel"-melding. Een factuur met zo'n
    // melding ervoor is erger dan geen factuur, dus dit valt hier om.
    expect(() => vrijBladXml(vrij({
      cellen: [
        { ref: 'A1', cel: { soort: 'tekst', waarde: 'eerste' } },
        { ref: 'a1', cel: { soort: 'tekst', waarde: 'tweede' } },
      ],
    }))).toThrow(/A1/);
  });

  it('ontsnapt tekens die XML anders stukmaken', () => {
    const xml = vrijBladXml(vrij({
      cellen: [{ ref: 'A1', cel: { soort: 'tekst', waarde: 'Jan & Piet <"lang">' } }],
    }));
    expect(xml).toContain('Jan &amp; Piet &lt;&quot;lang&quot;&gt;');
  });
});

describe('buildVrijWorkbook', () => {
  it('draagt twee vrije tabbladen, elk met hun eigen naam en inhoud', () => {
    const bytes = buildVrijWorkbook([
      vrij({ naam: 'Factuur', cellen: [{ ref: 'H8', cel: { soort: 'tekst', waarde: 'NG-0007' } }] }),
      vrij({ naam: 'Extra lessen', cellen: [{ ref: 'A1', cel: { soort: 'tekst', waarde: 'EXTRA LESSEN' } }] }),
    ]);
    const ingangen = leesZip(bytes);

    const werkmap = tekst(ingangen.find((i) => i.naam === 'xl/workbook.xml')!.inhoud);
    expect(werkmap).toContain('name="Factuur"');
    expect(werkmap).toContain('name="Extra lessen"');

    expect(tekst(ingangen.find((i) => i.naam === 'xl/worksheets/sheet1.xml')!.inhoud))
      .toContain('NG-0007');
    expect(tekst(ingangen.find((i) => i.naam === 'xl/worksheets/sheet2.xml')!.inhoud))
      .toContain('EXTRA LESSEN');
  });

  it('houdt de volgorde aan waarin de bladen binnenkomen', () => {
    const werkmap = tekst(leesZip(buildVrijWorkbook([
      vrij({ naam: 'Eerste' }), vrij({ naam: 'Tweede' }),
    ])).find((i) => i.naam === 'xl/workbook.xml')!.inhoud);
    expect(werkmap.indexOf('name="Eerste"')).toBeLessThan(werkmap.indexOf('name="Tweede"'));
  });

  it('geeft twee bladen met dezelfde naam een eigen naam — Excel weigert dubbels', () => {
    const werkmap = tekst(leesZip(buildVrijWorkbook([
      vrij({ naam: 'Factuur' }), vrij({ naam: 'Factuur' }),
    ])).find((i) => i.naam === 'xl/workbook.xml')!.inhoud);
    expect(werkmap).toContain('name="Factuur"');
    expect(werkmap).toContain('name="Factuur (2)"');
  });

  it('deelt één opmaaktabel, zodat een bedrag ook op blad twee een getal blijft', () => {
    const ingangen = leesZip(buildVrijWorkbook([vrij({ naam: 'A' }), vrij({ naam: 'B' })]));
    expect(ingangen.filter((i) => i.naam === 'xl/styles.xml')).toHaveLength(1);
  });

  it('weigert een werkmap zonder bladen — Excel kan die niet openen', () => {
    expect(() => buildVrijWorkbook([])).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Opmaak op een vrij blad (de layout van de factuur, 4 oktober 2026)
// ---------------------------------------------------------------------------

describe('opmaak op een vrij blad', () => {
  const pakket = (bladen: XlsxVrijBlad[]) => {
    const ingangen = leesZip(buildVrijWorkbook(bladen));
    const lees = (naam: string) => tekst(ingangen.find((i) => i.naam === naam)!.inhoud);
    return {
      blad: lees('xl/worksheets/sheet1.xml'),
      stijlen: lees('xl/styles.xml'),
      werkmap: lees('xl/workbook.xml'),
    };
  };
  /** Het stijlnummer van een cel, uit `<c r="A22" ... s="7">`. */
  const stijlVan = (blad: string, ref: string): number => {
    const m = new RegExp(`<c r="${ref}"[^>]* s="(\\d+)"`).exec(blad);
    if (!m) throw new Error(`geen stijl op ${ref}`);
    return Number(m[1]);
  };
  /** De `<xf>` met dat nummer uit `cellXfs`. */
  const xfVan = (stijlen: string, nummer: number): string =>
    /<cellXfs[^>]*>(.*)<\/cellXfs>/.exec(stijlen)![1].match(/<xf [^>]*?(?:\/>|>.*?<\/xf>)/g)![nummer];

  it('geeft een cel met een vulling, een kader en een lettergrootte een eigen stijl', () => {
    const { blad, stijlen } = pakket([vrij({
      cellen: [{
        ref: 'A22', cel: { soort: 'tekst', waarde: 'BESCHRIJVING:' },
        stijl: { grootte: 11, vulling: 'FF3300', rand: { boven: true, onder: true } },
      }],
    })]);
    const xf = xfVan(stijlen, stijlVan(blad, 'A22'));
    expect(xf).toContain('applyFill="1"');
    expect(xf).toContain('applyBorder="1"');
    expect(stijlen).toContain('<fgColor rgb="FFFF3300"/>');
    expect(stijlen).toContain('<top style="thin"><color auto="1"/></top>');
  });

  it('deelt één stijl tussen cellen die er hetzelfde uitzien', () => {
    const zelfde = { grootte: 9, vulling: 'F4B183' };
    const { blad } = pakket([vrij({
      cellen: [
        { ref: 'I24', cel: { soort: 'geld', waarde: 10 }, stijl: zelfde },
        { ref: 'I25', cel: { soort: 'geld', waarde: 20 }, stijl: { ...zelfde } },
      ],
    })]);
    expect(stijlVan(blad, 'I24')).toBe(stijlVan(blad, 'I25'));
  });

  it('houdt een bedrag een bedrag en een datum een datum, ook met opmaak', () => {
    const { blad, stijlen } = pakket([vrij({
      cellen: [
        { ref: 'I24', cel: { soort: 'geld', waarde: 10 }, stijl: { grootte: 9 } },
        { ref: 'H7', cel: { soort: 'datum', waarde: new Date(2026, 9, 1) }, stijl: { grootte: 9 } },
      ],
    })]);
    expect(xfVan(stijlen, stijlVan(blad, 'I24'))).toContain('numFmtId="164"');
    expect(xfVan(stijlen, stijlVan(blad, 'H7'))).toContain('numFmtId="165"');
  });

  it('schrijft een lege cel met opmaak, voor een kader zonder tekst', () => {
    const { blad } = pakket([vrij({
      cellen: [{ ref: 'D20', stijl: { rand: { onder: true, rechts: true } } }],
    })]);
    expect(blad).toMatch(/<c r="D20" s="\d+"\/>/);
  });

  it('zet een rijhoogte, ook op een rij zonder cellen', () => {
    const { blad } = pakket([vrij({ rijhoogtes: { 38: 33 } })]);
    expect(blad).toContain('<row r="38" ht="33" customHeight="1"');
  });

  it('legt het afdrukbereik vast, staand op A4 en op één pagina breed', () => {
    const { blad, werkmap } = pakket([vrij({ naam: 'Factuur', afdrukbereik: 'A1:I45' })]);
    expect(werkmap).toContain(
      '<definedName name="_xlnm.Print_Area" localSheetId="0">\'Factuur\'!$A$1:$I$45</definedName>',
    );
    expect(blad).toContain('<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>');
  });

  it('laat de oude stijlnummers staan: een tabel en een vette tekst blijven zoals ze waren', () => {
    const { stijlen } = pakket([vrij({
      cellen: [{ ref: 'A1', cel: { soort: 'tekst', waarde: 'x' }, stijl: { vulling: 'FF3300' } }],
    })]);
    expect(xfVan(stijlen, 1)).toContain('fontId="1"');
    expect(xfVan(stijlen, 2)).toContain('numFmtId="164"');
    expect(xfVan(stijlen, 3)).toContain('numFmtId="165"');
  });
});
