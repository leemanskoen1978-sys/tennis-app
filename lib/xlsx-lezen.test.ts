import { readFileSync } from 'fs';
import { join } from 'path';

import { leesZip } from './xlsx-lezen';
import { buildXlsx, crc32, zip } from './xlsx';

// ---------------------------------------------------------------------------
// Het echte bestand van de club, en niet een nagebouwd voorbeeld.
//
// D-19: een lezer die alleen slaagt op werkmappen die deze app zelf schreef bewijst niets —
// die bevestigt hoogstens zijn eigen aannames. `koen.xlsx` komt uit Excel, met alles wat
// Excel eraan hangt: ingepakte ingangen, een extra veld in de lokale kop, een tabel met
// gedeelde teksten. Daarom leest elke test hieronder de echte bytes uit de projectmap.
// ---------------------------------------------------------------------------

function koenBytes(): Uint8Array {
  const rauw = readFileSync(join(__dirname, '..', 'koen.xlsx'));
  return new Uint8Array(rauw.buffer, rauw.byteOffset, rauw.byteLength);
}

/** De namen van de ingangen, in de volgorde waarin de centrale map ze noemt. */
function namen(bytes: Uint8Array): string[] {
  return leesZip(bytes).map((i) => i.naam);
}

function ingangVan(bytes: Uint8Array, naam: string) {
  const ingang = leesZip(bytes).find((i) => i.naam === naam);
  if (!ingang) throw new Error(`${naam} zit niet in het bestand`);
  return ingang;
}

const LEEG = { naam: 'Lessen', koppen: ['Naam'], rijen: [[{ soort: 'tekst', waarde: 'Koen' }]] } as const;

describe('leesZip', () => {
  it('leest een werkmap die deze app zelf schreef terug tot dezelfde bestanden', () => {
    const bytes = buildXlsx(LEEG);
    // `buildXlsx` slaat onverpakt op (methode 0); dit is de heenweg-terugweg.
    expect(namen(bytes)).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
    ]);
    for (const ingang of leesZip(bytes)) {
      expect(ingang.inhoud.length).toBeGreaterThan(0);
    }
  });

  it('geeft de tien ingangen van koen.xlsx in de volgorde van de centrale map', () => {
    expect(namen(koenBytes())).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/worksheets/sheet1.xml',
      'xl/theme/theme1.xml',
      'xl/styles.xml',
      'xl/sharedStrings.xml',
      'docProps/core.xml',
      'docProps/app.xml',
    ]);
  });

  it('pakt xl/worksheets/sheet1.xml uit tot 526954 bytes met de juiste controlesom', () => {
    const ingang = ingangVan(koenBytes(), 'xl/worksheets/sheet1.xml');
    expect(ingang.inhoud.length).toBe(526954);
    expect(crc32(ingang.inhoud)).toBe(0x35baed35);
  });

  it('leest [Content_Types].xml goed, ondanks de 520 bytes extra veld in de lokale kop', () => {
    // De centrale map noemt hier extra-lengte 0 en de lokale kop 520. Wie de centrale
    // waarde gebruikt begint 520 bytes te vroeg en pakt rommel uit; de controlesom vangt dat.
    const ingang = ingangVan(koenBytes(), '[Content_Types].xml');
    expect(ingang.inhoud.length).toBe(1168);
    expect(crc32(ingang.inhoud)).toBe(0x689dee62);
  });

  it('leest xl/sharedStrings.xml en xl/workbook.xml op hun eigen controlesom', () => {
    const bytes = koenBytes();
    const gedeeld = ingangVan(bytes, 'xl/sharedStrings.xml');
    expect(gedeeld.inhoud.length).toBe(2141);
    expect(crc32(gedeeld.inhoud)).toBe(0xb206a3be);
    const werkmap = ingangVan(bytes, 'xl/workbook.xml');
    expect(werkmap.inhoud.length).toBe(2429);
    expect(crc32(werkmap.inhoud)).toBe(0x11aee283);
  });

  it('weigert bytes die geen zip zijn, met een Nederlandse uitleg', () => {
    expect(() => leesZip(new Uint8Array([1, 2, 3, 4, 5]))).toThrow(/zip/i);
    expect(() => leesZip(new Uint8Array(0))).toThrow(/zip/i);
  });

  it('noemt het nummer van een opslagmethode die het niet kent', () => {
    const bytes = zip([{ naam: 'a.txt', inhoud: new Uint8Array([65, 66, 67]) }]);
    // De opslagmethode staat in de lokale kop op +8; 99 bestaat niet.
    bytes[8] = 99;
    expect(() => leesZip(bytes)).toThrow(/99/);
  });

  it('geeft twee keer achter elkaar exact dezelfde bytes', () => {
    const bytes = koenBytes();
    const eerst = ingangVan(bytes, 'xl/worksheets/sheet1.xml').inhoud;
    const nogmaals = ingangVan(bytes, 'xl/worksheets/sheet1.xml').inhoud;
    expect(Array.from(nogmaals.subarray(0, 4096))).toEqual(Array.from(eerst.subarray(0, 4096)));
    expect(crc32(nogmaals)).toBe(crc32(eerst));
  });
});
