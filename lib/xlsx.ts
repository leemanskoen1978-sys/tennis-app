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

/**
 * Eén cel van een vrij blad, op de plaats die `ref` noemt ("H7").
 *
 * `vet` geldt alleen voor tekst. Een bedrag en een datum dragen hun eigen stijl — die bepaalt
 * hoe Excel het getal toont, en dat is belangrijker dan of het dik staat. Een vierde stijl
 * "vet bedrag" erbij zetten zou de stijlentabel verdubbelen voor iets wat een factuur niet
 * nodig heeft.
 */
export interface XlsxVrijeCel {
  ref: string;
  /** Leeg mag, als er een `stijl` bij staat: een kader of een gekleurd vlak zonder tekst. */
  cel?: XlsxCel;
  vet?: boolean;
  /** De opmaak van deze ene cel. Weglaten: de gewone stijl van haar soort, zoals voorheen. */
  stijl?: XlsxStijl;
}

/** Welke zijden van een cel een dunne lijn krijgen. */
export interface XlsxRand {
  boven?: boolean;
  onder?: boolean;
  links?: boolean;
  rechts?: boolean;
}

/**
 * Hoe een cel eruitziet: letter, kleur, vulling, kader en uitlijning. Kleuren als `RRGGBB`.
 *
 * Alleen wat de factuur nodig heeft, en dat is met opzet: elke eigenschap hier is er een die
 * `Opmaak` hieronder in `styles.xml` moet kunnen schrijven, en wat niemand gebruikt hoeft
 * niemand te onderhouden.
 */
export interface XlsxStijl {
  /** Lettergrootte in punten; weglaten is 11, de standaard van Excel. */
  grootte?: number;
  vet?: boolean;
  /** De kleur van de letters. */
  kleur?: string;
  /** De achtergrond van de cel. */
  vulling?: string;
  rand?: XlsxRand;
  uitlijning?: 'left' | 'center' | 'right';
}

/**
 * Een blad zonder koprij, waarin elke cel zelf zegt waar hij staat.
 *
 * Waarom dit naast `XlsxBlad` bestaat en niet in de plaats ervan: een lijst lessen ís een
 * tabel, met een koprij die blijft staan en een filter erop, en die moet dat blijven. Een
 * factuur is geen tabel — de opschriften staan links, de bedragen rechts, en er zit lucht
 * tussen de blokken.
 */
export interface XlsxVrijBlad {
  naam: string;
  cellen: readonly XlsxVrijeCel[];
  breedtes?: readonly number[];
  /** Bereiken als "A23:E23". Nodig voor de lange regels, die anders achter de bedragen lopen. */
  samengevoegd?: readonly string[];
  /** Rijhoogte in punten, per rijnummer. */
  rijhoogtes?: Readonly<Record<number, number>>;
  /**
   * Wat er afgedrukt wordt, als "A1:I45". Erbij komt: staand, A4, één pagina breed — zoals het
   * blad in `facturen.xlsx`, dat zo als pdf verstuurd werd.
   */
  afdrukbereik?: string;
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

/** "H7" → rij 7, kolom 7 (A is 0). Het omgekeerde van `kolomLetter`. */
export function refOntleden(ref: string): { rij: number; kolom: number } {
  const m = /^([A-Z]+)([1-9]\d*)$/.exec(ref.trim().toUpperCase());
  if (!m) throw new Error(`Geen geldige celverwijzing: ${ref}`);
  let kolom = 0;
  for (const letter of m[1]) kolom = kolom * 26 + (letter.charCodeAt(0) - 64);
  return { rij: Number(m[2]), kolom: kolom - 1 };
}

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
 * De opmaak van één werkmap: de vier vaste stijlen hieronder, plus elke combinatie die een
 * vrij blad met `stijl` vraagt. Dezelfde combinatie krijgt hetzelfde nummer, zodat honderd
 * bedragcellen in dezelfde kleur één regel in `styles.xml` zijn en niet honderd.
 *
 * De vaste stijlen houden hun nummer (0 tot 3): een tabel en een vette tekst zien er dus
 * precies uit zoals voorheen, ook in een werkmap waar er stijlen bij komen.
 */
class Opmaak {
  readonly fonts: string[] = [
    '<font><sz val="11"/><name val="Calibri"/></font>',
    '<font><b/><sz val="11"/><name val="Calibri"/></font>',
  ];
  readonly fills: string[] = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
  ];
  readonly borders: string[] = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
  readonly xfs: string[] = [
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>',
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>',
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>',
  ];

  private nummer(lijst: string[], item: string): number {
    const i = lijst.indexOf(item);
    if (i >= 0) return i;
    lijst.push(item);
    return lijst.length - 1;
  }

  /** Het stijlnummer voor deze opmaak op een cel met dit getalformaat. */
  xf(numFmtId: number, stijl: XlsxStijl): number {
    const kleur = (rgb: string) => `FF${rgb.replace('#', '').toUpperCase()}`;
    const font = this.nummer(this.fonts, '<font>'
      + (stijl.vet ? '<b/>' : '')
      + `<sz val="${stijl.grootte ?? 11}"/>`
      + (stijl.kleur ? `<color rgb="${kleur(stijl.kleur)}"/>` : '')
      + '<name val="Calibri"/></font>');
    const fill = stijl.vulling
      ? this.nummer(this.fills, '<fill><patternFill patternType="solid">'
        + `<fgColor rgb="${kleur(stijl.vulling)}"/><bgColor indexed="64"/></patternFill></fill>`)
      : 0;
    const r = stijl.rand ?? {};
    const lijn = (naam: string, aan?: boolean) =>
      (aan ? `<${naam} style="thin"><color auto="1"/></${naam}>` : `<${naam}/>`);
    const border = this.nummer(this.borders, '<border>'
      + lijn('left', r.links) + lijn('right', r.rechts) + lijn('top', r.boven) + lijn('bottom', r.onder)
      + '<diagonal/></border>');
    const uitlijning = stijl.uitlijning ? `<alignment horizontal="${stijl.uitlijning}"/>` : '';
    return this.nummer(this.xfs, `<xf numFmtId="${numFmtId}" fontId="${font}" fillId="${fill}"`
      + ` borderId="${border}" xfId="0" applyFont="1"`
      + (fill ? ' applyFill="1"' : '')
      + (border ? ' applyBorder="1"' : '')
      + (numFmtId ? ' applyNumberFormat="1"' : '')
      + (uitlijning ? ` applyAlignment="1">${uitlijning}</xf>` : '/>'));
  }
}

/** Het getalformaat dat bij de soort van een cel hoort; 0 is "algemeen". */
function getalformaat(cel: XlsxCel | undefined): number {
  if (cel?.soort === 'geld') return 164;
  if (cel?.soort === 'datum') return 165;
  return 0;
}

/**
 * Dezelfde cel-XML als een tabel schrijft, met twee verschillen: tekst mag vet, en een cel
 * met `stijl` krijgt haar eigen opmaak (als er een `Opmaak` is om ze in te schrijven).
 */
function vrijeCelXml(vrij: XlsxVrijeCel, opmaak?: Opmaak): string {
  if (vrij.stijl && opmaak) {
    const s = opmaak.xf(getalformaat(vrij.cel), { vet: vrij.vet, ...vrij.stijl });
    if (!vrij.cel) return `<c r="${vrij.ref}" s="${s}"/>`;
    return celXml(vrij.cel, vrij.ref).replace(/^<c r="([^"]+)"(?: s="\d+")?/, `<c r="$1" s="${s}"`);
  }
  if (!vrij.cel) return '';
  if (vrij.vet && vrij.cel.soort === 'tekst') {
    return `<c r="${vrij.ref}" t="inlineStr" s="${STIJL_VET}">`
      + `<is><t xml:space="preserve">${xml(vrij.cel.waarde)}</t></is></c>`;
  }
  return celXml(vrij.cel, vrij.ref);
}

/** "A1:I45" → "$A$1:$I$45", zoals een gedefinieerde naam het wil. */
function absoluut(bereik: string): string {
  return bereik.split(':').map((ref) => {
    const { rij, kolom } = refOntleden(ref);
    return `$${kolomLetter(kolom)}$${rij}`;
  }).join(':');
}

export function vrijBladXml(blad: XlsxVrijBlad, opmaak?: Opmaak): string {
  const gelegd = blad.cellen.map((c) => ({ ...c, ...refOntleden(c.ref) }));

  // Twee cellen op dezelfde plaats levert een blad op dat Excel weigert te openen zonder
  // eerst te "herstellen" — en dan opent de ontvanger een factuur met een foutmelding
  // ervoor. Het is precies de vergissing die je maakt bij het uitrekenen van een rijnummer,
  // dus hij wordt hier gevonden en niet daar.
  const gezien = new Set<string>();
  for (const cel of gelegd) {
    const plaats = `${kolomLetter(cel.kolom)}${cel.rij}`;
    if (gezien.has(plaats)) {
      throw new Error(`Twee cellen op ${plaats} in blad "${blad.naam}"`);
    }
    gezien.add(plaats);
  }

  const hoogtes = blad.rijhoogtes ?? {};
  const laatsteRij = Math.max(
    gelegd.reduce((max, c) => Math.max(max, c.rij), 1),
    ...Object.keys(hoogtes).map(Number),
  );
  const laatsteKolom = kolomLetter(gelegd.reduce((max, c) => Math.max(max, c.kolom), 0));

  const perRij = new Map<number, typeof gelegd>();
  for (const cel of gelegd) {
    const rij = perRij.get(cel.rij);
    if (rij) rij.push(cel);
    else perRij.set(cel.rij, [cel]);
  }

  // Oplopend, en binnen een rij op kolom: Excel leest een blad waarin de rijen door elkaar
  // staan wel, maar sommige lezers niet — en een bestand dat alleen in Excel opengaat is
  // precies wat deze schrijver niet wil zijn.
  const nummers = new Set([...perRij.keys(), ...Object.keys(hoogtes).map(Number)]);
  const rijen = [...nummers].sort((a, b) => a - b)
    .map((nummer) => {
      const cellen = (perRij.get(nummer) ?? [])
        .sort((a, b) => a.kolom - b.kolom)
        .map((c) => vrijeCelXml(c, opmaak))
        .join('');
      const hoogte = hoogtes[nummer] ? ` ht="${hoogtes[nummer]}" customHeight="1"` : '';
      return `<row r="${nummer}"${hoogte}>${cellen}</row>`;
    })
    .join('');

  const breedtes = blad.breedtes && blad.breedtes.length > 0
    ? `<cols>${blad.breedtes
      .map((b, i) => `<col min="${i + 1}" max="${i + 1}" width="${b}" customWidth="1"/>`)
      .join('')}</cols>`
    : '';

  const samengevoegd = blad.samengevoegd && blad.samengevoegd.length > 0
    ? `<mergeCells count="${blad.samengevoegd.length}">`
      + blad.samengevoegd.map((r) => `<mergeCell ref="${xml(r)}"/>`).join('')
      + '</mergeCells>'
    : '';

  // Geen bevroren koprij en geen filter, anders dan bij een tabel: een factuur heeft geen
  // koprij om te bevriezen en geen kolommen om op te filteren. De volgorde van de
  // onderdelen ligt vast in het formaat — afmeting, kolommen, gegevens, samengevoegd.
  //
  // Het afdrukken komt er achteraan bij, en `sheetPr` vooraan: ook dat is de vaste volgorde.
  const afdruk = blad.afdrukbereik
    ? '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>'
      + '<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>'
    : '';
  return `${KOP}<worksheet xmlns="${HOOFD_NS}">`
    + (blad.afdrukbereik ? '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' : '')
    + `<dimension ref="A1:${laatsteKolom}${laatsteRij}"/>`
    + breedtes
    + `<sheetData>${rijen}</sheetData>`
    + samengevoegd
    + afdruk
    + '</worksheet>';
}

/**
 * De opmaak. Vier stijlen: gewoon, vet (de koprij), een bedrag met twee decimalen en een
 * datum. De lijsten fonts/fills/borders mogen niet leeg zijn en de tweede vulling moet
 * `gray125` heten — Excel rekent op die twee en klaagt anders dat het bestand stuk is.
 */
function stijlenXml(opmaak: Opmaak = new Opmaak()): string {
  return `${KOP}<styleSheet xmlns="${HOOFD_NS}">`
    + '<numFmts count="2">'
    + '<numFmt numFmtId="164" formatCode="#,##0.00"/>'
    + '<numFmt numFmtId="165" formatCode="dd/mm/yyyy"/>'
    + '</numFmts>'
    + `<fonts count="${opmaak.fonts.length}">${opmaak.fonts.join('')}</fonts>`
    + `<fills count="${opmaak.fills.length}">${opmaak.fills.join('')}</fills>`
    + `<borders count="${opmaak.borders.length}">${opmaak.borders.join('')}</borders>`
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + `<cellXfs count="${opmaak.xfs.length}">${opmaak.xfs.join('')}</cellXfs>`
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

/**
 * Twee tabbladen mogen binnen één werkmap niet dezelfde naam dragen — Excel weigert zo'n
 * bestand in zijn geheel. `bladnaam()` kijkt bewust naar één naam en niet naar zijn buren;
 * dat blijft zo. Deze helper legt de namen naast elkaar en hangt bij een botsing een
 * oplopend achtervoegsel aan, binnen de 31 tekens die een tabnaam mag zijn. De eerste houdt
 * zijn naam, want die is de naam die de aanroeper bedoelde.
 *
 * Hoofdletters tellen niet mee: voor Excel zijn "Lessen" en "lessen" dezelfde tab.
 */
function uniekeBladnamen(voorstellen: readonly string[]): string[] {
  const gezien = new Set<string>();
  return voorstellen.map((voorstel) => {
    const schoon = bladnaam(voorstel);
    let naam = schoon;
    let volgnummer = 2;
    while (gezien.has(naam.toLowerCase())) {
      const achtervoegsel = ` (${volgnummer})`;
      naam = schoon.slice(0, 31 - achtervoegsel.length) + achtervoegsel;
      volgnummer++;
    }
    gezien.add(naam.toLowerCase());
    return naam;
  });
}

/**
 * De verpakking rond meer dan één blad.
 *
 * Wat in `buildXlsx` drie vaste strings zijn, zijn hier drie lussen. De volgorde van
 * `namen` is de volgorde van de tabs onderin Excel. Het soort blad doet er niet toe: de
 * inhoud komt als tekst binnen, en of die van een tabel of van een vrij blad komt, weet
 * alleen de aanroeper.
 */
function meerBladenPakket(
  namen: readonly string[],
  inhouden: readonly string[],
  opmaak?: Opmaak,
  /** Per blad het afdrukbereik ("A1:I45"), of niets. */
  afdrukbereiken: ReadonlyArray<string | undefined> = [],
): Uint8Array {
  // Excel weigert een werkmap zonder bladen. Hem toch wegschrijven levert een bestand op
  // dat pas bij de ontvanger stukloopt, en dat is de slechtste plek om het te merken.
  if (namen.length === 0) throw new Error('Een werkmap zonder bladen bestaat niet.');

  const bladPad = (index: number) => `worksheets/sheet${index + 1}.xml`;

  const contentTypes = `${KOP}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + namen
      .map((_, i) => `<Override PartName="/xl/${bladPad(i)}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join('')
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + '</Types>';

  const rels = `${KOP}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + `<Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/>`
    + '</Relationships>';

  const workbook = `${KOP}<workbook xmlns="${HOOFD_NS}" xmlns:r="${REL_NS}">`
    + `<sheets>${namen.map((naam, i) => `<sheet name="${xml(naam)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>`
    + (afdrukbereiken.some(Boolean)
      ? `<definedNames>${afdrukbereiken
        .map((bereik, i) => (bereik
          ? `<definedName name="_xlnm.Print_Area" localSheetId="${i}">'${xml(namen[i].replace(/'/g, "''"))}'!${absoluut(bereik)}</definedName>`
          : ''))
        .join('')}</definedNames>`
      : '')
    + '</workbook>';

  const workbookRels = `${KOP}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + namen
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL_NS}/worksheet" Target="${bladPad(i)}"/>`)
      .join('')
    + `<Relationship Id="rId${namen.length + 1}" Type="${REL_NS}/styles" Target="styles.xml"/>`
    + '</Relationships>';

  return zip([
    { naam: '[Content_Types].xml', inhoud: utf8(contentTypes) },
    { naam: '_rels/.rels', inhoud: utf8(rels) },
    { naam: 'xl/workbook.xml', inhoud: utf8(workbook) },
    { naam: 'xl/_rels/workbook.xml.rels', inhoud: utf8(workbookRels) },
    { naam: 'xl/styles.xml', inhoud: utf8(stijlenXml(opmaak)) },
    ...inhouden.map((inhoud, i) => ({ naam: `xl/${bladPad(i)}`, inhoud: utf8(inhoud) })),
  ]);
}

/**
 * Hetzelfde bestand, maar met meer dan één tabblad.
 *
 * Waarom dit een nieuwe functie is en geen ruimere signatuur van `buildXlsx`: `lib/csv.ts`
 * en het historiekscherm roepen `buildXlsx` vandaag aan met één blad, en er staan tests om
 * die aanroepen heen. Die mogen niet omvallen omdat er elders vier tabbladen nodig zijn.
 * `buildXlsx` blijft daarom letterlijk zoals hij was; hier staat ernaast wat hij niet kan.
 */
export function buildWorkbook(bladen: readonly XlsxBlad[]): Uint8Array {
  const namen = uniekeBladnamen(bladen.map((b) => b.naam));
  return meerBladenPakket(
    namen,
    bladen.map((blad, i) => bladXml({ ...blad, naam: namen[i] })),
  );
}

/**
 * Meer dan één vrij blad in één werkmap.
 *
 * Dit is wat de factuur nodig heeft: blad 1 de factuur, blad 2 het overzicht van de extra
 * lessen dat Racso elke maand vraagt. `buildWorkbook` kan ook meer dan één tabblad, maar
 * alleen als tabel met een koprij — en een factuur is geen tabel.
 *
 * Er is bewust géén variant voor één vrij blad. Die zou nergens aangeroepen worden: de
 * factuur heeft er altijd twee, ook als het tweede leeg is.
 *
 * De opmaak wordt één keer geschreven en door alle bladen gedeeld, net als bij
 * `buildWorkbook`: een bedrag blijft dus ook op blad twee een getal en een datum een datum.
 */
export function buildVrijWorkbook(bladen: readonly XlsxVrijBlad[]): Uint8Array {
  const namen = uniekeBladnamen(bladen.map((b) => b.naam));
  // Eerst de bladen, dan de opmaak: welke stijlen er nodig zijn, weet je pas als elke cel
  // geschreven is.
  const opmaak = new Opmaak();
  const inhouden = bladen.map((blad, i) => vrijBladXml({ ...blad, naam: namen[i] }, opmaak));
  return meerBladenPakket(namen, inhouden, opmaak, bladen.map((b) => b.afdrukbereik));
}
