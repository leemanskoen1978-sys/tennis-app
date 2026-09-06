import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import {
  fractieNaarTijd, leesBlad, leesSharedStrings, leesWerkmap, leesZip, letterNaarKolom,
  ontsnapTerug, serieNaarDatum,
} from './xlsx-lezen';
import { buildXlsx, crc32, datumNaarSerie, kolomLetter, zip } from './xlsx';

// ---------------------------------------------------------------------------
// Het echte bestand van de club, en niet een nagebouwd voorbeeld.
//
// D-19: een lezer die alleen slaagt op werkmappen die deze app zelf schreef bewijst niets —
// die bevestigt hoogstens zijn eigen aannames. `koen.xlsx` komt uit Excel, met alles wat
// Excel eraan hangt: ingepakte ingangen, een extra veld in de lokale kop, een tabel met
// gedeelde teksten. Daarom leest elke test hieronder de echte bytes uit de projectmap.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Het echte bestand is er niet altijd.
//
// `koen.xlsx` staat bewust in .gitignore en zit dus niet in de repository: deze repo is
// publiek en het bestand bevat de echte namen van 42 kinderen van de club. Commit het niet
// en haal het niet uit .gitignore, hoe handig dat voor de build ook lijkt.
//
// Zonder dat bestand valt er niets te bewijzen. De tests die het lezen worden dan luid
// overgeslagen -- niet stil geslaagd, en ook niet de hele suite laten ontploffen (wat op CI
// gebeurde toen ze het bestand blind inlazen).
// ---------------------------------------------------------------------------
const KOEN_PAD = join(__dirname, '..', 'koen.xlsx');
const heeftKoen = existsSync(KOEN_PAD);
if (!heeftKoen) {
  console.warn(
    `LET OP: ${KOEN_PAD} ontbreekt -- het staat bewust in .gitignore omdat deze repository `
    + 'publiek is en het bestand de namen van echte leerlingen bevat. De tests van '
    + 'lib/xlsx-lezen die dat bestand lezen worden overgeslagen en bewijzen in deze '
    + 'draaibeurt dus niets.',
  );
}
const alsKoenErIs = heeftKoen ? it : it.skip;

function koenBytes(): Uint8Array {
  const rauw = readFileSync(KOEN_PAD);
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

  alsKoenErIs('geeft de tien ingangen van koen.xlsx in de volgorde van de centrale map', () => {
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

  alsKoenErIs('pakt xl/worksheets/sheet1.xml uit tot 526954 bytes met de juiste controlesom', () => {
    const ingang = ingangVan(koenBytes(), 'xl/worksheets/sheet1.xml');
    expect(ingang.inhoud.length).toBe(526954);
    expect(crc32(ingang.inhoud)).toBe(0x35baed35);
  });

  alsKoenErIs('leest [Content_Types].xml goed, ondanks de 520 bytes extra veld in de lokale kop', () => {
    // De centrale map noemt hier extra-lengte 0 en de lokale kop 520. Wie de centrale
    // waarde gebruikt begint 520 bytes te vroeg en pakt rommel uit; de controlesom vangt dat.
    const ingang = ingangVan(koenBytes(), '[Content_Types].xml');
    expect(ingang.inhoud.length).toBe(1168);
    expect(crc32(ingang.inhoud)).toBe(0x689dee62);
  });

  alsKoenErIs('leest xl/sharedStrings.xml en xl/workbook.xml op hun eigen controlesom', () => {
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

  alsKoenErIs('geeft twee keer achter elkaar exact dezelfde bytes', () => {
    const bytes = koenBytes();
    const eerst = ingangVan(bytes, 'xl/worksheets/sheet1.xml').inhoud;
    const nogmaals = ingangVan(bytes, 'xl/worksheets/sheet1.xml').inhoud;
    expect(Array.from(nogmaals.subarray(0, 4096))).toEqual(Array.from(eerst.subarray(0, 4096)));
    expect(crc32(nogmaals)).toBe(crc32(eerst));
  });
});

describe('ontsnapTerug', () => {
  it('zet de vijf entiteiten van de schrijver weer om naar tekens', () => {
    expect(ontsnapTerug('&lt;a&gt; &quot;b&quot; &apos;c&apos; &amp; d')).toBe('<a> "b" \'c\' & d');
  });

  it('houdt een naam met een letterlijke ampersand heel', () => {
    // `&amp;lt;` is de tekst "&lt;" en niet het teken "<": daarom gaat `&amp;` als laatste.
    expect(ontsnapTerug('Dupont &amp; Zoon')).toBe('Dupont & Zoon');
    expect(ontsnapTerug('&amp;lt;')).toBe('&lt;');
  });
});

describe('leesSharedStrings', () => {
  it('geeft de teksten op de volgorde waarin ze in de tabel staan', () => {
    const xml = '<sst><si><t>Datum</t></si><si><t>Weekdag</t></si></sst>';
    expect(leesSharedStrings(xml)).toEqual(['Datum', 'Weekdag']);
  });

  it('plakt een tekst die Excel in stukken met opmaak knipte weer aaneen', () => {
    const xml = '<sst><si><r><t>Leemans</t></r><r><t xml:space="preserve"> Koen</t></r></si></sst>';
    expect(leesSharedStrings(xml)).toEqual(['Leemans Koen']);
  });

  it('haalt de entiteiten uit de gedeelde teksten', () => {
    expect(leesSharedStrings('<sst><si><t>Dupont &amp; Zoon</t></si></sst>')).toEqual(['Dupont & Zoon']);
  });
});

describe('letterNaarKolom', () => {
  it('is de omgekeerde van kolomLetter', () => {
    expect(letterNaarKolom('A')).toBe(0);
    expect(letterNaarKolom('J')).toBe(9);
    expect(letterNaarKolom('Z')).toBe(25);
    expect(letterNaarKolom('AA')).toBe(26);
    for (let i = 0; i < 200; i++) {
      expect(letterNaarKolom(kolomLetter(i))).toBe(i);
    }
  });
});

describe('leesBlad', () => {
  const gedeeld = ['Datum', 'Weekdag'];

  it('leest een verwijzing 0 als de eerste gedeelde tekst en niet als een lege cel', () => {
    const xml = '<sheetData><row r="1"><c r="A1" s="1" t="s"><v>0</v></c></row></sheetData>';
    expect(leesBlad(xml, gedeeld)).toEqual([['Datum']]);
  });

  it('leest een cel die deze app zelf schreef (inlineStr)', () => {
    const xml = '<sheetData><row r="1">'
      + '<c r="A1" t="inlineStr"><is><t xml:space="preserve">Koen</t></is></c>'
      + '</row></sheetData>';
    expect(leesBlad(xml, [])).toEqual([['Koen']]);
  });

  it('geeft een cel zonder t de tekst van <v> letterlijk terug', () => {
    // Niet door `Number` heen en weer: dan wordt 0.58333333333333337 een ander getal en
    // is de bron van een fout niet meer terug te vinden.
    const xml = '<sheetData><row r="1"><c r="A1"><v>0.58333333333333337</v></c></row></sheetData>';
    expect(leesBlad(xml, [])).toEqual([['0.58333333333333337']]);
  });

  it('leest een cel met t="str" als de tekst van <v>', () => {
    const xml = '<sheetData><row r="1"><c r="A1" t="str"><v>Koen</v></c></row></sheetData>';
    expect(leesBlad(xml, [])).toEqual([['Koen']]);
  });

  it('zet een cel op de plek die zijn kolomletter zegt, ook als kolom B ontbreekt', () => {
    const xml = '<sheetData><row r="3"><c r="C3" t="s"><v>1</v></c><c r="A3" t="s"><v>0</v></c></row></sheetData>';
    expect(leesBlad(xml, gedeeld)).toEqual([[], [], ['Datum', '', 'Weekdag']]);
  });

  it('laat een overgeslagen rijnummer als een lege rij staan', () => {
    const xml = '<sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row>'
      + '<row r="3"><c r="A3" t="s"><v>1</v></c></row></sheetData>';
    expect(leesBlad(xml, gedeeld)).toEqual([['Datum'], [], ['Weekdag']]);
  });
});

describe('leesWerkmap', () => {
  it('leest een werkmap die deze app zelf schreef, met zijn bladnaam', () => {
    const bytes = buildXlsx({
      naam: 'Lessen',
      koppen: ['Naam', 'Bedrag'],
      rijen: [[{ soort: 'tekst', waarde: 'Dupont & Zoon' }, { soort: 'geld', waarde: 45 }]],
    });
    const bladen = leesWerkmap(bytes);
    expect(bladen).toHaveLength(1);
    expect(bladen[0].naam).toBe('Lessen');
    expect(bladen[0].rijen[0]).toEqual(['Naam', 'Bedrag']);
    expect(bladen[0].rijen[1]).toEqual(['Dupont & Zoon', '45']);
  });

  alsKoenErIs('volgt de r:id naar het juiste bestand en raadt de volgorde niet', () => {
    const bladen = leesWerkmap(koenBytes());
    expect(bladen.map((b) => b.naam)).toEqual(['Sheet1']);
  });
});

describe('serieNaarDatum', () => {
  it('leest 46274 als 9 september 2026', () => {
    expect(serieNaarDatum(46274)).toEqual({ jaar: 2026, maand: 9, dag: 9 });
  });

  it('is heen en terug gelijk aan datumNaarSerie', () => {
    expect(serieNaarDatum(datumNaarSerie(new Date(2027, 5, 25)))).toEqual({ jaar: 2027, maand: 6, dag: 25 });
    expect(serieNaarDatum(datumNaarSerie(new Date(2026, 8, 9)))).toEqual({ jaar: 2026, maand: 9, dag: 9 });
  });
});

describe('fractieNaarTijd', () => {
  it('leest 0.58333333333333337 als 14:00 en niet als 13:59', () => {
    expect(fractieNaarTijd(0.58333333333333337)).toEqual({ uur: 14, minuut: 0 });
  });

  it('geeft voor alle zeven breuken uit koen.xlsx een heel uur', () => {
    const breuken: Array<[number, number]> = [
      [0.58333333333333337, 14],
      [0.625, 15],
      [0.66666666666666663, 16],
      [0.70833333333333337, 17],
      [0.75, 18],
      [0.79166666666666663, 19],
      [0.83333333333333337, 20],
    ];
    for (const [breuk, uur] of breuken) {
      expect(fractieNaarTijd(breuk)).toEqual({ uur, minuut: 0 });
    }
  });

  it('telt ook een kwartier mee', () => {
    expect(fractieNaarTijd(0.5104166666666666)).toEqual({ uur: 12, minuut: 15 });
  });
});

// ---------------------------------------------------------------------------
// De poort van D-19.
//
// Alles wat verder in deze fase gebouwd wordt — het herkennen van groepen, het koppelen van
// leerlingen, het inplannen van een seizoen — leunt op deze lezer. Is hij ergens subtiel
// fout, dan is die fout onzichtbaar tot er een seizoen scheef in de agenda staat en een ouder
// belt. Daarom worden hier bekende waarden uit het échte bestand van de club vastgepind, en
// geen eigenschappen van een voorbeeld dat we zelf in elkaar hebben gezet.
//
// Het bestand wordt één keer gelezen voor deze hele groep tests: 527 kB uitpakken per test
// maakt de suite traag zonder iets extra's te bewijzen.
// ---------------------------------------------------------------------------

describe('koen.xlsx — het echte bestand van de club', () => {
  const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

  let rijen: string[][];
  let gegevens: string[][];

  beforeAll(() => {
    const bladen = leesWerkmap(koenBytes());
    rijen = bladen[0].rijen;
    gegevens = rijen.slice(1);
  });

  /** De weekdag van een rij, uit de datumkolom en met lokale datumvelden (D-15). */
  function weekdagVan(rij: string[]): string {
    const { jaar, maand, dag } = serieNaarDatum(Number(rij[0]));
    return DAGEN[new Date(jaar, maand - 1, dag).getDay()];
  }

  alsKoenErIs('bevat precies één blad, met de naam Sheet1', () => {
    const bladen = leesWerkmap(koenBytes());
    expect(bladen).toHaveLength(1);
    expect(bladen[0].naam).toBe('Sheet1');
  });

  alsKoenErIs('heeft 1399 rijen: één koprij en 1398 gegevensrijen', () => {
    expect(rijen).toHaveLength(1399);
    expect(gegevens).toHaveLength(1398);
  });

  alsKoenErIs('heeft de koprij die de club gewend is', () => {
    expect(rijen[0]).toEqual([
      'Datum', 'Weekdag', 'Weeknr', 'Uur', 'Type les', 'Groep', 'Coach', 'Leerling', 'Locatie',
      'Indoor/Outdoor',
    ]);
  });

  alsKoenErIs('leest de eerste gegevensrij letterlijk terug', () => {
    expect(rijen[1]).toEqual([
      '46274', 'woensdag', '37', '0.58333333333333337', 'Duoles', 'Groep 4', 'Leemans Koen',
      'de Clippele Antoine', 'GANTOISE', 'Indoor',
    ]);
  });

  alsKoenErIs('heeft in elke gegevensrij tien gevulde cellen — er zit geen gat in dit bestand', () => {
    for (const rij of gegevens) {
      expect(rij).toHaveLength(10);
      expect(rij.filter((c) => c === '')).toEqual([]);
    }
  });

  alsKoenErIs('loopt van 9 september 2026 tot en met 25 juni 2027', () => {
    const dagen = gegevens.map((rij) => serieNaarDatum(Number(rij[0])));
    const eerste = Math.min(...gegevens.map((rij) => Number(rij[0])));
    const laatste = Math.max(...gegevens.map((rij) => Number(rij[0])));
    expect(serieNaarDatum(eerste)).toEqual({ jaar: 2026, maand: 9, dag: 9 });
    expect(serieNaarDatum(laatste)).toEqual({ jaar: 2027, maand: 6, dag: 25 });
    for (const d of dagen) {
      expect(d.jaar === 2026 || d.jaar === 2027).toBe(true);
    }
  });

  alsKoenErIs('kent zeven verschillende groepen', () => {
    const groepen = new Set(gegevens.map((rij) => rij[5]));
    expect(groepen.size).toBe(7);
    expect(groepen.has('Groep 8')).toBe(true);
  });

  alsKoenErIs('zet Groep 8 op drie momenten in de week — daarom is de naam alleen geen sleutel', () => {
    // D-02: "Groep 8" bestaat drie keer, op drie verschillende dag/uur-combinaties. Wie de
    // groep op naam alleen samenneemt, gooit drie lesgroepen op één hoop.
    const momenten = new Set(
      gegevens
        .filter((rij) => rij[5] === 'Groep 8')
        .map((rij) => {
          const { uur, minuut } = fractieNaarTijd(Number(rij[3]));
          return `${weekdagVan(rij)}|${uur}:${String(minuut).padStart(2, '0')}`;
        }),
    );
    expect([...momenten].sort()).toEqual(['vrijdag|17:00', 'vrijdag|19:00', 'woensdag|17:00']);
  });

  alsKoenErIs('heeft maar één coach: Leemans Koen', () => {
    expect([...new Set(gegevens.map((rij) => rij[6]))]).toEqual(['Leemans Koen']);
  });

  alsKoenErIs('noemt 42 verschillende leerlingen', () => {
    expect(new Set(gegevens.map((rij) => rij[7])).size).toBe(42);
  });

  alsKoenErIs('geeft twee keer achter elkaar hetzelfde resultaat', () => {
    expect(leesWerkmap(koenBytes())).toEqual(leesWerkmap(koenBytes()));
  });
});
