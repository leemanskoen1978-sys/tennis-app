// Een xlsx-bestand schrijven, zonder pakket erbij.
//
// Waarom niet gewoon een bibliotheek: een xlsx-schrijver van de plank kost een megabyte in
// de webbundel, en van die megabyte gebruikt deze app één blad met twaalf kolommen. Wat
// hieronder staat is precies dat ene blad. Het is bovendien te testen zonder Excel — de
// tests lezen het bestand weer uit elkaar.
//
// Een xlsx is een zip met een handvol XML-bestanden erin. Beide helften staan hier: eerst
// de zip, dan de XML.
//
// Wat dit oplevert tegenover de CSV: een bedrag is een getal en niet de tekst "45,00", en
// een datum is een datum. Een trainer kan dus een kolom optellen en op datum sorteren
// zonder eerst te moeten uitleggen aan Excel wat er staat.

/** Eén cel. De soort bepaalt hoe Excel de waarde leest én toont. */
export type XlsxCel =
  | { soort: 'tekst'; waarde: string }
  | { soort: 'getal'; waarde: number }
  | { soort: 'geld'; waarde: number }
  | { soort: 'datum'; waarde: Date };

export interface XlsxBlad {
  /** De naam op het tabblad onderin Excel. */
  naam: string;
  koppen: readonly string[];
  rijen: ReadonlyArray<readonly XlsxCel[]>;
  /** Breedte per kolom, in tekens. Weglaten laat Excel zelf kiezen (en dat kiest smal). */
  breedtes?: readonly number[];
}

// ---------------------------------------------------------------------------
// Tekst naar bytes
// ---------------------------------------------------------------------------

/**
 * UTF-8, met de hand. `TextEncoder` bestaat tegenwoordig overal, maar "tegenwoordig overal"
 * is precies het soort aanname dat pas op een toestel van iemand anders omvalt. Dit is kort
 * genoeg om die vraag niet te hoeven stellen.
 */
function utf8(text: string): Uint8Array {
  const uit: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let punt = text.charCodeAt(i);
    // Een surrogaatpaar (emoji, en alles boven U+FFFF) staat als twee halve tekens in een
    // JS-string en hoort als één teken gecodeerd te worden.
    if (punt >= 0xd800 && punt <= 0xdbff && i + 1 < text.length) {
      const laag = text.charCodeAt(i + 1);
      if (laag >= 0xdc00 && laag <= 0xdfff) {
        punt = 0x10000 + ((punt - 0xd800) << 10) + (laag - 0xdc00);
        i++;
      }
    }
    if (punt < 0x80) {
      uit.push(punt);
    } else if (punt < 0x800) {
      uit.push(0xc0 | (punt >> 6), 0x80 | (punt & 0x3f));
    } else if (punt < 0x10000) {
      uit.push(0xe0 | (punt >> 12), 0x80 | ((punt >> 6) & 0x3f), 0x80 | (punt & 0x3f));
    } else {
      uit.push(
        0xf0 | (punt >> 18),
        0x80 | ((punt >> 12) & 0x3f),
        0x80 | ((punt >> 6) & 0x3f),
        0x80 | (punt & 0x3f),
      );
    }
  }
  return new Uint8Array(uit);
}

// ---------------------------------------------------------------------------
// De zip
// ---------------------------------------------------------------------------

/** De tabel die crc32 snel maakt; één keer opgebouwd, niet per aanroep. */
const CRC_TABEL: Uint32Array = (() => {
  const tabel = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    tabel[n] = c >>> 0;
  }
  return tabel;
})();

/** De controlesom die elke zip-ingang bij zich draagt. */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABEL[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipIngang {
  naam: string;
  inhoud: Uint8Array;
}

/**
 * Een vaste tijdstempel (1 januari 1980, het vroegste dat het zip-formaat kent).
 *
 * Niet `new Date()`: dan levert dezelfde export twee keer achter elkaar twee verschillende
 * bestanden op, en is er niets te testen. De datum van de export staat in de bestandsnaam
 * en in de gegevens zelf; die op de zip-ingang zegt niemand iets.
 */
const DOS_TIJD = 0;
const DOS_DATUM = (0 << 9) | (1 << 5) | 1;

/** Een klein hulpje om getallen in de juiste bytevolgorde weg te schrijven (zip is little-endian). */
function schrijver(lengte: number) {
  const bytes = new Uint8Array(lengte);
  let pos = 0;
  return {
    bytes,
    u16(n: number) {
      bytes[pos++] = n & 0xff;
      bytes[pos++] = (n >>> 8) & 0xff;
    },
    u32(n: number) {
      bytes[pos++] = n & 0xff;
      bytes[pos++] = (n >>> 8) & 0xff;
      bytes[pos++] = (n >>> 16) & 0xff;
      bytes[pos++] = (n >>> 24) & 0xff;
    },
    blok(deel: Uint8Array) {
      bytes.set(deel, pos);
      pos += deel.length;
    },
    get lengte() {
      return pos;
    },
  };
}

/**
 * De ingangen in één zip, ongecomprimeerd ("stored").
 *
 * Ongecomprimeerd omdat comprimeren een deflate-implementatie vraagt en dat is een veelvoud
 * van al deze code, voor een bestand dat bij een drukke maand een paar tientallen kilobytes
 * is. Elke lezer die zip kent — Excel, Numbers, LibreOffice, de Verkenner — leest een
 * opgeslagen ingang net zo goed als een gecomprimeerde.
 */
export function zip(ingangen: readonly ZipIngang[]): Uint8Array {
  const delen: Uint8Array[] = [];
  const centraal: Uint8Array[] = [];
  let offset = 0;

  for (const ingang of ingangen) {
    const naam = utf8(ingang.naam);
    const som = crc32(ingang.inhoud);

    const kop = schrijver(30 + naam.length);
    kop.u32(0x04034b50); // lokale kop
    kop.u16(20); // benodigde versie
    kop.u16(0x0800); // vlag: de bestandsnaam staat in UTF-8
    kop.u16(0); // opslagmethode: geen compressie
    kop.u16(DOS_TIJD);
    kop.u16(DOS_DATUM);
    kop.u32(som);
    kop.u32(ingang.inhoud.length);
    kop.u32(ingang.inhoud.length);
    kop.u16(naam.length);
    kop.u16(0); // geen extra veld
    kop.blok(naam);

    delen.push(kop.bytes, ingang.inhoud);

    const rij = schrijver(46 + naam.length);
    rij.u32(0x02014b50); // rij in de centrale map
    rij.u16(20); // gemaakt door
    rij.u16(20); // benodigde versie
    rij.u16(0x0800);
    rij.u16(0);
    rij.u16(DOS_TIJD);
    rij.u16(DOS_DATUM);
    rij.u32(som);
    rij.u32(ingang.inhoud.length);
    rij.u32(ingang.inhoud.length);
    rij.u16(naam.length);
    rij.u16(0); // extra veld
    rij.u16(0); // opmerking
    rij.u16(0); // schijfnummer
    rij.u16(0); // interne eigenschappen
    rij.u32(0); // externe eigenschappen
    rij.u32(offset);
    rij.blok(naam);
    centraal.push(rij.bytes);

    offset += kop.bytes.length + ingang.inhoud.length;
  }

  const centraalLengte = centraal.reduce((som, d) => som + d.length, 0);
  const staart = schrijver(22);
  staart.u32(0x06054b50); // einde van de centrale map
  staart.u16(0); // schijf
  staart.u16(0); // schijf waarop de centrale map begint
  staart.u16(ingangen.length);
  staart.u16(ingangen.length);
  staart.u32(centraalLengte);
  staart.u32(offset);
  staart.u16(0); // geen opmerking

  const alles = [...delen, ...centraal, staart.bytes];
  const totaal = alles.reduce((som, d) => som + d.length, 0);
  const uit = new Uint8Array(totaal);
  let pos = 0;
  for (const deel of alles) {
    uit.set(deel, pos);
    pos += deel.length;
  }
  return uit;
}

// ---------------------------------------------------------------------------
// De XML
// ---------------------------------------------------------------------------

/**
 * Tekst die veilig in XML staat.
 *
 * Behalve de vijf bekende tekens gaan ook stuurtekens eruit. Die kunnen in een notitie
 * belanden via plakken uit een ander programma, en één stuurteken maakt het hele bestand
 * onleesbaar voor Excel — dat is een harde weigering, geen scheve cel.
 */
function xml(text: string): string {
  return text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** 0 → "A", 25 → "Z", 26 → "AA". Excel telt zijn kolommen in letters. */
export function kolomLetter(index: number): string {
  let n = index;
  let uit = '';
  do {
    uit = String.fromCharCode(65 + (n % 26)) + uit;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return uit;
}

/**
 * Een datum als het getal dat Excel eronder verstaat: het aantal dagen sinds 30 december
 * 1899. Die dag en niet 1 januari 1900, omdat Excel gelooft dat 1900 een schrikkeljaar was;
 * één dag verschuiven maakt de rest van de tabel weer gelijk.
 *
 * Geteld op de kalenderdag zoals je hem op de klok ziet, niet op UTC — anders staat een les
 * van 's avonds laat in het bestand op de dag ervoor.
 */
export function datumNaarSerie(d: Date): number {
  const dagen = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
    - Date.UTC(1899, 11, 30);
  return Math.round(dagen / 86_400_000);
}

/** De stijlnummers uit `styles.xml` hieronder. 0 is gewoon, en die noemen we niet. */
const STIJL_VET = 1;
const STIJL_GELD = 2;
const STIJL_DATUM = 3;

function celXml(cel: XlsxCel, verwijzing: string): string {
  switch (cel.soort) {
    case 'tekst':
      // `inlineStr` en geen aparte tekstentabel: dat scheelt een heel XML-bestand en een
      // laag verwijzingen, en de winst van die tabel (herhaalde woorden één keer opslaan)
      // valt bij een lijst lessen in het niet.
      return `<c r="${verwijzing}" t="inlineStr"><is><t xml:space="preserve">${xml(cel.waarde)}</t></is></c>`;
    case 'getal':
      return `<c r="${verwijzing}"><v>${cel.waarde}</v></c>`;
    case 'geld':
      return `<c r="${verwijzing}" s="${STIJL_GELD}"><v>${cel.waarde}</v></c>`;
    case 'datum':
      return `<c r="${verwijzing}" s="${STIJL_DATUM}"><v>${datumNaarSerie(cel.waarde)}</v></c>`;
  }
}

const KOP = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const HOOFD_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export function bladXml(blad: XlsxBlad): string {
  const kolommen = blad.koppen.length;
  const laatsteKolom = kolomLetter(Math.max(0, kolommen - 1));
  const laatsteRij = blad.rijen.length + 1;

  const breedtes = blad.breedtes && blad.breedtes.length > 0
    ? `<cols>${blad.breedtes
      .map((b, i) => `<col min="${i + 1}" max="${i + 1}" width="${b}" customWidth="1"/>`)
      .join('')}</cols>`
    : '';

  const koprij = `<row r="1">${blad.koppen
    .map((kop, i) => `<c r="${kolomLetter(i)}1" t="inlineStr" s="${STIJL_VET}"><is><t xml:space="preserve">${xml(kop)}</t></is></c>`)
    .join('')}</row>`;

  const rijen = blad.rijen
    .map((rij, r) => {
      const nummer = r + 2;
      const cellen = rij.map((cel, c) => celXml(cel, `${kolomLetter(c)}${nummer}`)).join('');
      return `<row r="${nummer}">${cellen}</row>`;
    })
    .join('');

  // De volgorde van deze onderdelen ligt vast in het formaat; Excel weigert een blad waarin
  // ze door elkaar staan. Vandaar: afmeting, weergave, kolommen, gegevens, filter.
  return `${KOP}<worksheet xmlns="${HOOFD_NS}">`
    + `<dimension ref="A1:${laatsteKolom}${laatsteRij}"/>`
    // De koprij blijft staan bij het scrollen — bij honderd lessen weet je anders halverwege
    // niet meer welke kolom welke was.
    + '<sheetViews><sheetView workbookViewId="0">'
    + '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
    + '</sheetView></sheetViews>'
    + breedtes
    + `<sheetData>${koprij}${rijen}</sheetData>`
    + `<autoFilter ref="A1:${laatsteKolom}${laatsteRij}"/>`
    + '</worksheet>';
}

/**
 * De opmaak. Vier stijlen: gewoon, vet (de koprij), een bedrag met twee decimalen en een
 * datum. De lijsten fonts/fills/borders mogen niet leeg zijn en de tweede vulling moet
 * `gray125` heten — Excel rekent op die twee en klaagt anders dat het bestand stuk is.
 */
function stijlenXml(): string {
  return `${KOP}<styleSheet xmlns="${HOOFD_NS}">`
    + '<numFmts count="2">'
    + '<numFmt numFmtId="164" formatCode="#,##0.00"/>'
    + '<numFmt numFmtId="165" formatCode="dd/mm/yyyy"/>'
    + '</numFmts>'
    + '<fonts count="2">'
    + '<font><sz val="11"/><name val="Calibri"/></font>'
    + '<font><b/><sz val="11"/><name val="Calibri"/></font>'
    + '</fonts>'
    + '<fills count="2">'
    + '<fill><patternFill patternType="none"/></fill>'
    + '<fill><patternFill patternType="gray125"/></fill>'
    + '</fills>'
    + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="4">'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
    + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '</cellXfs>'
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    + '</styleSheet>';
}

/**
 * De naam van een tabblad mag geen `: \ / ? * [ ]` bevatten en niet langer zijn dan 31
 * tekens. Een naam die dat wel doet laat Excel het bestand weigeren, dus hij wordt hier
 * netgemaakt in plaats van doorgelaten.
 */
export function bladnaam(voorstel: string): string {
  const schoon = voorstel.replace(/[:\\/?*[\]]/g, ' ').trim();
  return (schoon === '' ? 'Blad1' : schoon).slice(0, 31);
}

/** Het hele bestand, klaar om weg te schrijven. */
export function buildXlsx(blad: XlsxBlad): Uint8Array {
  const naam = bladnaam(blad.naam);

  const contentTypes = `${KOP}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + '</Types>';

  const rels = `${KOP}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + `<Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/>`
    + '</Relationships>';

  const workbook = `${KOP}<workbook xmlns="${HOOFD_NS}" xmlns:r="${REL_NS}">`
    + `<sheets><sheet name="${xml(naam)}" sheetId="1" r:id="rId1"/></sheets>`
    + '</workbook>';

  const workbookRels = `${KOP}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + `<Relationship Id="rId1" Type="${REL_NS}/worksheet" Target="worksheets/sheet1.xml"/>`
    + `<Relationship Id="rId2" Type="${REL_NS}/styles" Target="styles.xml"/>`
    + '</Relationships>';

  return zip([
    { naam: '[Content_Types].xml', inhoud: utf8(contentTypes) },
    { naam: '_rels/.rels', inhoud: utf8(rels) },
    { naam: 'xl/workbook.xml', inhoud: utf8(workbook) },
    { naam: 'xl/_rels/workbook.xml.rels', inhoud: utf8(workbookRels) },
    { naam: 'xl/styles.xml', inhoud: utf8(stijlenXml()) },
    { naam: 'xl/worksheets/sheet1.xml', inhoud: utf8(bladXml({ ...blad, naam })) },
  ]);
}
