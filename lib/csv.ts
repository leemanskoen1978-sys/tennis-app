// Het overzicht als gegevens (csvRows), als tekst (toCsv) en als werkblad (toXlsx), los van
// elkaar zodat het scherm dezelfde rijen kan tonen die het uitvoert.
//
// De kolommen staan één keer beschreven en bedienen alle drie. Een kolom zegt hoe zijn cel
// als tékst luidt (`value`, voor het scherm en de CSV) en, waar dat iets toevoegt, wat de
// onderliggende waarde is (`getal`, `datum`). Die tweede vorm is waar een xlsx zijn winst
// haalt: een bedrag is er een bedrag waarmee Excel kan rekenen, geen tekst die er als een
// bedrag uitziet.

import { groupSize, shortGroupLabel } from './groups';
import { formatEuro } from './money';
import { bookingMinutes, bookingPrice, coachPayout, PAYMENT_LABELS, splitOf } from './payments';
import { bookingStatusLabel } from './status';
import { t } from './i18n';
import { buildXlsx, type XlsxCel } from './xlsx';
import type { Booking, Court, User } from './types';

/** Eén bedrag-opmaak voor de hele app; de export houdt zijn eigen ingang. Zie lib/money. */
export { formatEuro } from './money';

export interface CsvRow {
  id: string;
  /** Het begin van de les zoals het is opgeslagen; de xlsx zet hier een echte datum van. */
  start: string;   // ISO
  date: string;    // dd/mm/jjjj
  time: string;    // HH:MM
  coach: string;
  /** De betaler, en bij een groepsles hoeveel spelers er nog bij stonden: "Mathis +2". */
  player: string;
  /** Hoeveel spelers er op de baan stonden; 1 bij een privéles. */
  players: number;
  /** Wie de factuur krijgt: "Samen" (de betaler) of "Apart" (ieder zijn deel). */
  billing: string;
  court: string;
  minutes: number;
  price: number;    // euro — de prijs van de HELE les, op het tarief van het terrein
  coachPay: number; // euro — wat de trainer krijgt, op zijn eigen uurtarief
  status: string;
  payment: string;
}



export interface CsvColumn {
  label: string;
  /** De cel als tekst — wat het scherm toont en wat in de CSV komt. */
  value: (row: CsvRow) => string;
  /** De cel als getal, voor de xlsx. Ontbreekt = het blijft tekst. */
  getal?: (row: CsvRow) => number;
  /** Zet de xlsx-cel op een bedrag met twee decimalen. Alleen zinnig samen met `getal`. */
  geld?: boolean;
  /** De cel als datum, voor de xlsx. */
  datum?: (row: CsvRow) => Date;
  /** Kolombreedte in de xlsx, in tekens. */
  breedte: number;
}

// De enige bron van waarheid voor kolommen: kop én cel staan hier naast elkaar, zodat het
// scherm en het bestand niet uit elkaar kunnen schuiven als de volgorde verandert.
export const CSV_COLUMNS: readonly CsvColumn[] = [
  { label: 'Datum', value: (r) => r.date, datum: (r) => new Date(r.start), breedte: 12 },
  { label: 'Uur', value: (r) => r.time, breedte: 8 },
  { label: 'Trainer', value: (r) => r.coach, breedte: 18 },
  { label: 'Speler', value: (r) => r.player, breedte: 18 },
  // Eén regel per LES, ook bij een groepsles die apart gefactureerd wordt. Een export is een
  // lijst lessen — zo telt een trainer zijn maand, en zo sluit hij aan op de omzetkaart. Wie
  // welk deel krijgt, is een zaak van de facturatie en staat in de app bij de les zelf; hier
  // zeggen deze twee kolommen wat er te verdelen valt en of dat gebeurt.
  { label: 'Spelers', value: (r) => String(r.players), getal: (r) => r.players, breedte: 9 },
  { label: 'Facturatie', value: (r) => r.billing, breedte: 12 },
  { label: 'Terrein', value: (r) => r.court, breedte: 14 },
  { label: 'Duur (min)', value: (r) => String(r.minutes), getal: (r) => r.minutes, breedte: 11 },
  // Twee bedragen naast elkaar, en de kop zegt van wie ze zijn: de spelers betalen samen de
  // baan, de trainer krijgt zijn eigen uurtarief. Wat de club overhoudt is het verschil.
  {
    label: 'Prijs les (EUR)', value: (r) => formatEuro(r.price),
    getal: (r) => r.price, geld: true, breedte: 15,
  },
  {
    label: 'Loon trainer (EUR)', value: (r) => formatEuro(r.coachPay),
    getal: (r) => r.coachPay, geld: true, breedte: 18,
  },
  { label: 'Status', value: (r) => r.status, breedte: 20 },
  { label: 'Betaalwijze', value: (r) => r.payment, breedte: 16 },
];

export const CSV_HEADER: readonly string[] = CSV_COLUMNS.map((c) => c.label);

/**
 * De koppenrij zoals hij in het bestand komt, in de gekozen taal.
 *
 * Een functie en geen constante: `CSV_COLUMNS` staat op het hoogste niveau van deze module
 * en wordt dus één keer gemaakt, bij het opstarten. Had de vertaling daar gestaan, dan was
 * de taal van dat ene moment voor de rest van de sessie vastgelegd.
 */
export function csvHeader(): string[] {
  return CSV_COLUMNS.map((c) => t(c.label));
}

function two(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * De lessen die je meekrijgt, op tijd gesorteerd en met de namen al opgezocht. Wélke lessen
 * dat zijn beslist het scherm (periode, trainer) — de selectie stond hier eerst vast op één
 * kalendermaand, en dat maakte elke andere periode onmogelijk. Filteren doe je met
 * `bookingsInPeriod` uit lib/period; dit blijft de vertaling naar rijen.
 */
export function csvRows(bookings: Booking[], users: User[], courts: Court[]): CsvRow[] {
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  const rateById = new Map(users.map((u) => [u.id, u.hourly_rate]));
  const courtById = new Map(courts.map((c) => [c.id, c]));

  return [...bookings]
    // Het bestand staat altijd op tijd oplopend, ook als het scherm anders sorteert.
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .map((b) => {
      const start = new Date(b.start_time);
      // Duur en prijs komen uit `payments`, zodat het maandoverzicht en de omzet op het
      // exportscherm hetzelfde bedrag tonen. Een kapotte of omgekeerde eindtijd geeft daar
      // 0: de les blijft zichtbaar staan, maar met duur en prijs op nul.
      const minutes = bookingMinutes(b);
      const court = courtById.get(b.court_id);
      const size = groupSize(b);
      return {
        id: b.id,
        start: b.start_time,
        date: `${two(start.getDate())}/${two(start.getMonth() + 1)}/${start.getFullYear()}`,
        time: `${two(start.getHours())}:${two(start.getMinutes())}`,
        coach: nameById.get(b.coach_id) ?? t('Onbekend'),
        player: shortGroupLabel(nameById.get(b.player_id) ?? t('Onbekend'), size),
        players: size,
        billing: splitOf(b) === 'separate' ? t('Apart') : t('Samen'),
        court: court?.name ?? t('Onbekend terrein'),
        minutes,
        price: bookingPrice(b, court),
        // Wat de trainer krijgt, op zijn eigen uurtarief. Nog geen tarief ingevuld (of een
        // trainer die niet meer bestaat) geeft 0 — zichtbaar nul in plaats van een leeg vak.
        coachPay: coachPayout(b, rateById.get(b.coach_id)),
        status: bookingStatusLabel(b.status),
        payment: t(PAYMENT_LABELS[b.payment_method]),
      };
    });
}

/** Excel hier leest puntkomma's en een komma als decimaalteken. */
function cell(value: string): string {
  return /[;"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: CsvRow[]): string {
  const lines = [csvHeader().map(cell).join(';')];
  for (const r of rows) {
    lines.push(CSV_COLUMNS.map((c) => cell(c.value(r))).join(';'));
  }
  return lines.join('\n');
}

/**
 * Dezelfde rijen als een Excel-werkblad.
 *
 * Waar de CSV alles als tekst neerzet, krijgt Excel hier de waarde zelf: het aantal spelers
 * en de duur als geheel getal, de twee bedragen als bedrag, en de datum als datum. Daarmee
 * kan een trainer een kolom optellen en op datum sorteren zonder er eerst iets aan te moeten
 * veranderen — precies het werk dat de CSV hem elke maand opnieuw gaf.
 *
 * Een onbruikbare datum (een boeking met een kapotte begintijd) blijft de tekst uit de CSV.
 * Beter een leesbare cel die niet meesorteert dan een cel met 1899 erin.
 */
export function toXlsx(rows: CsvRow[]): Uint8Array {
  return buildXlsx({
    naam: t('Lessen'),
    koppen: csvHeader(),
    breedtes: CSV_COLUMNS.map((c) => c.breedte),
    rijen: rows.map((r) => CSV_COLUMNS.map((c): XlsxCel => {
      if (c.datum) {
        const d = c.datum(r);
        if (!Number.isNaN(d.getTime())) return { soort: 'datum', waarde: d };
      }
      if (c.getal) {
        const n = c.getal(r);
        if (Number.isFinite(n)) return { soort: c.geld ? 'geld' : 'getal', waarde: n };
      }
      return { soort: 'tekst', waarde: c.value(r) };
    })),
  });
}

// ---------------------------------------------------------------------------
// Een CSV lezen
//
// De schrijfkant hierboven bepaalt zelf hoe zijn bestand eruitziet; de leeskant krijgt wat
// een trainer aanlevert en moet dus raden. Drie dingen doet Excel die een `split(';')`
// meteen laten omvallen: Nederlandse Excel scheidt met een puntkomma en Engelse met een
// komma, het zet een BOM vooraan, en een cel met een scheidingsteken erin komt tussen
// aanhalingstekens te staan. Kopiëren-en-plakken uit een blad geeft nog een vierde vorm:
// tabs. Alle vier worden ze hier herkend.
// ---------------------------------------------------------------------------

type Scheidingsteken = ';' | ',' | '\t';

/**
 * Hoeveel kolommen zou deze ene regel geven bij dit scheidingsteken? Aanhalingstekens
 * tellen niet mee: een naam als "De Vries, Jan" mag de telling niet laten kantelen.
 */
function kolomAantalVoor(regel: string, kandidaat: Scheidingsteken): number {
  let aantal = 1;
  let inAanhaling = false;
  for (const teken of regel) {
    if (teken === '"') inAanhaling = !inAanhaling;
    else if (!inAanhaling && teken === kandidaat) aantal++;
  }
  return aantal;
}

/**
 * Welk scheidingsteken gebruikt dit bestand? Niet simpelweg het teken dat op de eerste
 * regel het vaakst voorkomt — staat daar een titel met toevallig zelf een komma in
 * ("Ledenlijst, seizoen 2026"), dan wijst dat de verkeerde kant op. In plaats daarvan: van
 * de eerste vijf niet-lege regels (of minder, bij een korter bestand) telt elk kandidaat-
 * scheidingsteken hoeveel kolommen iedere regel zou geven; het kandidaat waarbij de meeste
 * regels het eens zijn over hetzelfde (meer dan 1) aantal kolommen wint. Een titel zonder
 * scheidingsteken erin haalt dan nooit de overhand, en een titel mét een scheidingsteken
 * verliest het van de regels die wél consequent in kolommen uiteenvallen.
 * Gelijkspel, of geen enkel kandidaat dat ergens op uitkomt: puntkomma, wat de club aanlevert.
 */
function scheidingstekenVan(text: string): Scheidingsteken {
  const regels = text.split(/\r\n|\r|\n/).filter((r) => r.trim() !== '').slice(0, 5);
  const kandidaten: Scheidingsteken[] = [';', ',', '\t'];

  let beste: Scheidingsteken = ';';
  let besteScore = 0;
  for (const kandidaat of kandidaten) {
    const perAantal = new Map<number, number>();
    for (const regel of regels) {
      const aantal = kolomAantalVoor(regel, kandidaat);
      if (aantal > 1) perAantal.set(aantal, (perAantal.get(aantal) ?? 0) + 1);
    }
    const score = Math.max(0, ...perAantal.values());
    if (score > besteScore) { besteScore = score; beste = kandidaat; }
  }
  return beste;
}

/**
 * Een CSV-tekst als rijen cellen. Een lege cel blijft staan — die betekent "hier staat niets
 * ingevuld" en dat is iets anders dan een kolom die er niet is. Om diezelfde reden blijft ook
 * een lege regel middenin het bestand staan (een trainer zet weleens een lege scheidingsregel
 * tussen twee groepen): schrapte je die stil weg, dan zou de index in dit array niet meer
 * overeenkomen met het regelnummer dat een trainer in Excel ziet, en zou een latere melding
 * ("regel 4") naar de verkeerde regel wijzen. Alleen een lege staart — de spookrij die een
 * regeleinde aan het eind van het bestand oplevert — hoort bij geen enkele echte regel en
 * valt daarom wél weg. Elke cel wordt getrimd: een trainer typt weleens een spatie na een
 * scheidingsteken, en die hoort niet mee in een naam of een e-mailadres.
 */
export function parseCsv(text: string): string[][] {
  // De BOM als escape geschreven, net als in lib/share.ts: zo blijft het in elke editor één
  // onzichtbaar teken en eindigt hij niet per ongeluk als tekst.
  const schoon = text.replace(/^\uFEFF/, '');
  const scheiding = scheidingstekenVan(schoon);
  const rijen: string[][] = [];
  let rij: string[] = [];
  let cel = '';
  let inAanhaling = false;

  for (let i = 0; i < schoon.length; i++) {
    const teken = schoon[i];
    if (inAanhaling) {
      if (teken !== '"') {
        // Ook een '\r' blijft hier gewoon onderdeel van de cel: wat tussen
        // aanhalingstekens staat is precies wat de schrijfkant er ook weer in zet
        // (zie de toCsv-test die een kale '\r' bewust bewaart).
        cel += teken;
      } else if (schoon[i + 1] === '"') {
        // Twee aanhalingstekens op rij zijn er samen één, letterlijk in de cel.
        cel += '"';
        i++;
      } else {
        inAanhaling = false;
      }
      continue;
    }
    if (teken === '"') {
      // Een aanhalingsteken heeft alleen aan het begin van een cel zijn betekenis (RFC
      // 4180, en zo schrijft Excel het ook); midden in een cel is het gewoon tekst. Op een
      // spatie na leeg telt nog als "begin", want de cel wordt toch getrimd. De ruil: een
      // strikte `cel === ''` zou een geciteerde cel met een spatie ervoor (`; "De Vries;
      // Jan"`) in twee stukken breken — en een cel met een puntkomma erin komt vaker voor
      // dan een aanhalingsteken vlak na een spatie, dus valt de keuze naar `trim()` uit.
      if (cel.trim() === '') { inAanhaling = true; } else { cel += teken; }
      continue;
    }
    if (teken === scheiding) { rij.push(cel); cel = ''; continue; }
    if (teken === '\r' || teken === '\n') {
      // Buiten aanhalingstekens is elke regeleinde-vorm een rijeinde; '\r\n' telt als één.
      if (teken === '\r' && schoon[i + 1] === '\n') i++;
      rij.push(cel); rijen.push(rij); rij = []; cel = '';
      continue;
    }
    cel += teken;
  }
  rij.push(cel);
  rijen.push(rij);

  const getrimd = rijen.map((r) => r.map((c) => c.trim()));
  // Alleen de staart van louter lege rijen valt weg — de rest blijft staan, zie de reden
  // hierboven bij de commentaar van deze functie.
  let eind = getrimd.length;
  while (eind > 0 && getrimd[eind - 1].every((c) => c.length === 0)) eind--;
  return getrimd.slice(0, eind);
}
