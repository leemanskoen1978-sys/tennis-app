import {
  bladAanwezigheid, bladGroepen, bladLessen, bladUrenPerTrainer, exportWerkmap, koppenVan,
  naarRijen, opzoektabellen,
  type ExportGegevens, type ExportKolom,
} from './export-trainingen';
import { payoutsByCoach } from './reports';
import { buildWorkbook, type XlsxBlad } from './xlsx';
import { translate } from './i18n';
import type { Booking, Court, LesGroep, User } from './types';

// ---------------------------------------------------------------------------
// Dezelfde minimale zip-lezer als in `lib/xlsx.test.ts`, hier overgenomen omdat hij daar
// niet geëxporteerd is — en dat hoort ook zo: hij is testgereedschap en geen onderdeel van
// de schrijver. De round-trip hieronder moet het geschreven bestand lezen zoals Excel dat
// doet, via de centrale map, en niet de bytes natellen die de schrijver zelf net neerzette.
// ---------------------------------------------------------------------------

function u16(b: Uint8Array, at: number): number {
  return b[at] | (b[at + 1] << 8);
}

function u32(b: Uint8Array, at: number): number {
  return (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;
}

function tekst(b: Uint8Array): string {
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

/** De inhoud van één bestand uit de zip, gevonden via de centrale map achteraan. */
function inhoudVan(bytes: Uint8Array, naam: string): string {
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
  for (let n = 0; n < aantal; n++) {
    const grootte = u32(bytes, pos + 24);
    const naamLengte = u16(bytes, pos + 28);
    const extraLengte = u16(bytes, pos + 30);
    const opmerkingLengte = u16(bytes, pos + 32);
    const lokaal = u32(bytes, pos + 42);
    const gevonden = tekst(bytes.subarray(pos + 46, pos + 46 + naamLengte));
    if (gevonden === naam) {
      const begin = lokaal + 30 + u16(bytes, lokaal + 26) + u16(bytes, lokaal + 28);
      return tekst(bytes.subarray(begin, begin + grootte));
    }
    pos += 46 + naamLengte + extraLengte + opmerkingLengte;
  }
  throw new Error(`${naam} zit niet in het bestand`);
}

// ---------------------------------------------------------------------------
// Gedeelde gegevens voor alle bladen van dit bestand.
//
// Gewone objecten, geen nagemaakte modules: dit is puur rekenwerk en het enige wat het nodig
// heeft is wat het scherm al geladen heeft. Wie hier een mock zet, test zijn eigen mock.
// ---------------------------------------------------------------------------

const users: User[] = [
  { id: 'koen', name: 'Koen', email: 'koen@club.be', role: 'coach', hourly_rate: 24 },
  { id: 'ann', name: 'Ann', email: 'ann@club.be', role: 'coach', hourly_rate: 22 },
  { id: 'p1', name: 'Mathis', email: 'mathis@x.be', role: 'player' },
  { id: 'p2', name: 'Lotte', email: 'lotte@x.be', role: 'player' },
  { id: 'p3', name: 'Jules', email: 'jules@x.be', role: 'player' },
  { id: 'p4', name: 'Fien', email: 'fien@x.be', role: 'player' },
  { id: 'p5', name: 'Wout', email: 'wout@x.be', role: 'player' },
  { id: 'p6', name: 'Nore', email: 'nore@x.be', role: 'player' },
];

const courts: Court[] = [
  { id: 'baan-1', name: 'Baan 1', number: 1, indoor: false, hourly_rate: 30 },
  { id: 'hal-1', name: 'Hal 1', number: 2, indoor: true, hourly_rate: 40 },
];

const groepen: LesGroep[] = [
  {
    id: 'g8', name: 'Groep 8', level: 'Gevorderd',
    weekday: 3, start_hour: 17, start_minute: 0,
    coach_id: 'koen', court_id: 'baan-1',
    season_start: '2026-09-01', season_end: '2027-06-30',
    roster: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'], archived: false,
  },
];

/** Een les op woensdag 19 augustus 2026 om 17:00, lokale tijd — zonder `Z`, zoals de app opslaat. */
function booking(over: Partial<Booking> = {}): Booking {
  return {
    id: 'b1', player_id: 'p1', coach_id: 'koen', court_id: 'baan-1',
    start_time: '2026-08-19T17:00:00', end_time: '2026-08-19T18:00:00',
    status: 'confirmed', payment_method: 'cash', ...over,
  };
}

// ---------------------------------------------------------------------------

interface Voorbeeldrij {
  naam: string;
  aantal: number;
  bedrag: number;
  dag: string;
}

const VOORBEELD: readonly ExportKolom<Voorbeeldrij>[] = [
  { label: 'Naam', value: (r) => r.naam, breedte: 10 },
  { label: 'Aantal', value: (r) => String(r.aantal), getal: (r) => r.aantal, breedte: 8 },
  { label: 'Bedrag', value: (r) => `${r.bedrag} EUR`, getal: (r) => r.bedrag, geld: true, breedte: 12 },
  { label: 'Dag', value: (r) => r.dag, datum: (r) => new Date(r.dag), breedte: 12 },
];

const rij: Voorbeeldrij = { naam: 'Koen', aantal: 3, bedrag: 27.5, dag: '2026-08-19T17:00:00' };

describe('naarRijen', () => {
  it('geeft per item één rij, in de volgorde van de kolomtabel', () => {
    const rijen = naarRijen(VOORBEELD, [rij, { ...rij, naam: 'Ann' }]);
    expect(rijen).toHaveLength(2);
    expect(rijen[0]).toHaveLength(4);
    expect(rijen[0][0]).toEqual({ soort: 'tekst', waarde: 'Koen' });
    expect(rijen[1][0]).toEqual({ soort: 'tekst', waarde: 'Ann' });
  });

  it('maakt van een getal een getalcel en van een bedrag een geldcel', () => {
    const [cellen] = naarRijen(VOORBEELD, [rij]);
    expect(cellen[1]).toEqual({ soort: 'getal', waarde: 3 });
    expect(cellen[2]).toEqual({ soort: 'geld', waarde: 27.5 });
  });

  it('maakt van een datum een datumcel', () => {
    const [cellen] = naarRijen(VOORBEELD, [rij]);
    expect(cellen[3].soort).toBe('datum');
    expect((cellen[3] as { waarde: Date }).waarde.getFullYear()).toBe(2026);
  });

  it('valt bij een onbruikbare datum terug op de tekst, niet op een cel met 1899 erin', () => {
    const [cellen] = naarRijen(VOORBEELD, [{ ...rij, dag: 'geen datum' }]);
    expect(cellen[3]).toEqual({ soort: 'tekst', waarde: 'geen datum' });
  });

  it('valt bij een getal dat geen getal is terug op de tekst', () => {
    const [cellen] = naarRijen(VOORBEELD, [{ ...rij, aantal: NaN }]);
    expect(cellen[1]).toEqual({ soort: 'tekst', waarde: 'NaN' });
  });

  it('geeft een lege lijst terug bij een lege lijst', () => {
    expect(naarRijen(VOORBEELD, [])).toEqual([]);
  });
});

describe('koppenVan', () => {
  it('geeft de labels letterlijk terug', () => {
    expect(koppenVan(VOORBEELD)).toEqual(['Naam', 'Aantal', 'Bedrag', 'Dag']);
  });
});

describe('opzoektabellen', () => {
  it('zet gebruikers, banen en groepen op hun id', () => {
    const tabellen = opzoektabellen(users, courts, groepen);
    expect(tabellen.gebruikerById.get('koen')?.name).toBe('Koen');
    expect(tabellen.baanById.get('hal-1')?.indoor).toBe(true);
    expect(tabellen.groepById.get('g8')?.name).toBe('Groep 8');
  });

  it('geeft undefined voor wat er niet is, in plaats van te struikelen', () => {
    const tabellen = opzoektabellen(users, courts, groepen);
    expect(tabellen.gebruikerById.get('weg')).toBeUndefined();
    expect(tabellen.baanById.get('weg')).toBeUndefined();
    expect(tabellen.groepById.get('weg')).toBeUndefined();
  });

  it('werkt met lege lijsten', () => {
    const tabellen = opzoektabellen([], [], []);
    expect(tabellen.gebruikerById.size).toBe(0);
    expect(tabellen.baanById.size).toBe(0);
    expect(tabellen.groepById.size).toBe(0);
  });
});

// Zodat de fixtures hierboven al gebruikt zijn vóór blad "Lessen" ze in de volgende taak
// oppikt; ze staan hier om gedeeld te worden.
describe('de gedeelde gegevens', () => {
  it('beschrijven een les van Koen met Mathis op Baan 1', () => {
    const b = booking();
    expect(b.coach_id).toBe('koen');
    expect(opzoektabellen(users, courts, groepen).gebruikerById.get(b.player_id)?.name).toBe('Mathis');
  });
});

// ---------------------------------------------------------------------------
// Blad "Lessen"
// ---------------------------------------------------------------------------

const tabellen = opzoektabellen(users, courts, groepen);

/** De groepsles van woensdag 17:00: zes spelers, Mathis betaalt, in de hal. */
function groepsles(over: Partial<Booking> = {}): Booking {
  return booking({
    id: 'g-les', group_id: 'g8', court_id: 'hal-1',
    participant_ids: ['p2', 'p3', 'p4', 'p5', 'p6'],
    ...over,
  });
}

function kolom(blad: XlsxBlad, kop: string): number {
  const i = blad.koppen.indexOf(kop);
  if (i < 0) throw new Error(`kolom ${kop} staat niet op het blad`);
  return i;
}

/** De cel van deze rij in deze kolom, als tekst — of hij nu tekst, getal of datum is. */
function cel(blad: XlsxBlad, rij: number, kop: string): string {
  return String((blad.rijen[rij][kolom(blad, kop)] as { waarde: unknown }).waarde);
}

/** De rij waar deze groep op staat; het blad staat op naam gesorteerd. */
function groepRij(blad: XlsxBlad, naam: string): number {
  const i = blad.rijen.findIndex((r) => (r[kolom(blad, 'Groep')] as { waarde: unknown }).waarde === naam);
  if (i < 0) throw new Error(`${naam} staat niet op het blad`);
  return i;
}

/** De rij waar deze trainer op staat; de volgorde van het blad ligt bij payoutsByCoach. */
function kolomRij(blad: XlsxBlad, naam: string): number {
  const i = blad.rijen.findIndex((r) => (r[0] as { waarde: unknown }).waarde === naam);
  if (i < 0) throw new Error(`${naam} staat niet op het blad`);
  return i;
}

describe('bladLessen', () => {
  it('heet "Lessen" en heeft de zestien vastgelegde koppen, in volgorde', () => {
    const blad = bladLessen([booking()], tabellen);
    expect(blad.naam).toBe('Lessen');
    expect(blad.koppen).toEqual([
      'Datum', 'Weekdag', 'Weeknr', 'Uur', 'Einduur', 'Type les', 'Groep', 'Groep-ID',
      'Coach', 'Gaf de les', 'Leerling', 'E-mail leerling', 'Baan', 'Indoor/Outdoor',
      'Spelers', 'Status',
    ]);
  });

  it('schrijft geen kolom Locatie: de app kent geen locatie en verzinnen is erger dan weglaten', () => {
    expect(bladLessen([booking()], tabellen).koppen).not.toContain('Locatie');
  });

  it('geeft een privéles één rij, zonder groep en met Type les = Privéles', () => {
    const blad = bladLessen([booking()], tabellen);
    expect(blad.rijen).toHaveLength(1);
    expect(cel(blad, 0, 'Groep')).toBe('');
    expect(cel(blad, 0, 'Groep-ID')).toBe('');
    expect(cel(blad, 0, 'Type les')).toBe('Privéles');
    expect(cel(blad, 0, 'Leerling')).toBe('Mathis');
    expect(cel(blad, 0, 'Spelers')).toBe('1');
  });

  it('klapt een groepsles van zes uit tot zes rijen, met de betaler vooraan', () => {
    const blad = bladLessen([groepsles()], tabellen);
    expect(blad.rijen).toHaveLength(6);
    expect(blad.rijen.map((_, i) => cel(blad, i, 'Leerling')))
      .toEqual(['Mathis', 'Lotte', 'Jules', 'Fien', 'Wout', 'Nore']);
    expect(blad.rijen.map((_, i) => cel(blad, i, 'E-mail leerling'))[1]).toBe('lotte@x.be');
  });

  it('zet op die zes rijen dezelfde datum, hetzelfde uur en hetzelfde Groep-ID', () => {
    const blad = bladLessen([groepsles()], tabellen);
    const uniek = (kop: string) => new Set(blad.rijen.map((_, i) => cel(blad, i, kop)));
    expect(uniek('Datum').size).toBe(1);
    expect(uniek('Uur').size).toBe(1);
    expect(uniek('Groep-ID')).toEqual(new Set(['g8']));
    expect(uniek('Groep')).toEqual(new Set(['Groep 8']));
    expect(uniek('Type les')).toEqual(new Set(['Gevorderd']));
  });

  it('zet Spelers op elk van die zes rijen op 6', () => {
    const blad = bladLessen([groepsles()], tabellen);
    expect(blad.rijen.map((_, i) => cel(blad, i, 'Spelers'))).toEqual(['6', '6', '6', '6', '6', '6']);
  });

  it('toont bij een vervanger de toegewezen trainer én wie de les werkelijk gaf', () => {
    const blad = bladLessen([booking({ taught_by_id: 'ann' })], tabellen);
    expect(cel(blad, 0, 'Coach')).toBe('Koen');
    expect(cel(blad, 0, 'Gaf de les')).toBe('Ann');
  });

  it('toont zonder vervanger in beide kolommen dezelfde naam', () => {
    const blad = bladLessen([booking()], tabellen);
    expect(cel(blad, 0, 'Coach')).toBe('Koen');
    expect(cel(blad, 0, 'Gaf de les')).toBe('Koen');
  });

  it('leest Indoor/Outdoor uit de baan van de les', () => {
    const binnen = bladLessen([booking({ court_id: 'hal-1' })], tabellen);
    expect(cel(binnen, 0, 'Baan')).toBe('Hal 1');
    expect(cel(binnen, 0, 'Indoor/Outdoor')).toBe('Indoor');

    const buiten = bladLessen([booking()], tabellen);
    expect(cel(buiten, 0, 'Indoor/Outdoor')).toBe('Outdoor');
  });

  it('laat Baan en Indoor/Outdoor leeg bij een les zonder baan', () => {
    const blad = bladLessen([booking({ court_id: '' })], tabellen);
    expect(cel(blad, 0, 'Baan')).toBe('');
    expect(cel(blad, 0, 'Indoor/Outdoor')).toBe('');
  });

  it('laat de rij staan als de speler, de trainer of de baan verdwenen is', () => {
    const blad = bladLessen(
      [booking({ player_id: 'weg', coach_id: 'ookweg', court_id: 'gesloopt' })],
      tabellen,
    );
    expect(blad.rijen).toHaveLength(1);
    expect(cel(blad, 0, 'Leerling')).toBe('Onbekend');
    expect(cel(blad, 0, 'Coach')).toBe('Onbekend');
    expect(cel(blad, 0, 'Gaf de les')).toBe('Onbekend');
    expect(cel(blad, 0, 'Baan')).toBe('Onbekend');
    expect(cel(blad, 0, 'E-mail leerling')).toBe('');
    expect(cel(blad, 0, 'Indoor/Outdoor')).toBe('');
  });

  it('zet de rijen op tijd oplopend, ongeacht de volgorde van binnenkomst', () => {
    const laat = booking({ id: 'b2', start_time: '2026-08-26T09:00:00', end_time: '2026-08-26T10:00:00' });
    const blad = bladLessen([laat, booking()], tabellen);
    expect(blad.rijen.map((_, i) => cel(blad, i, 'Weekdag'))).toEqual(['woensdag', 'woensdag']);
    expect(blad.rijen.map((_, i) => cel(blad, i, 'Uur'))).toEqual(['17:00', '09:00']);
    const datums = blad.rijen.map((r) => (r[kolom(blad, 'Datum')] as { waarde: Date }).waarde.getTime());
    expect(datums[0]).toBeLessThan(datums[1]);
  });

  it('laat de meegegeven lijst met rust', () => {
    const gegeven = [
      booking({ id: 'b2', start_time: '2026-08-26T09:00:00', end_time: '2026-08-26T10:00:00' }),
      booking(),
    ];
    bladLessen(gegeven, tabellen);
    expect(gegeven.map((b) => b.id)).toEqual(['b2', 'b1']);
  });

  it('vult Weekdag, Uur en Einduur uit de les zelf', () => {
    const blad = bladLessen([booking()], tabellen);
    expect(cel(blad, 0, 'Weekdag')).toBe('woensdag');
    expect(cel(blad, 0, 'Uur')).toBe('17:00');
    expect(cel(blad, 0, 'Einduur')).toBe('18:00');
    expect(cel(blad, 0, 'Status')).toBe('Bevestigd');
  });

  it('zet Weeknr van 1 januari 2027 op 53 — de week van het jaar ervoor', () => {
    const blad = bladLessen(
      [booking({ start_time: '2027-01-01T17:00:00', end_time: '2027-01-01T18:00:00' })],
      tabellen,
    );
    expect(cel(blad, 0, 'Weeknr')).toBe('53');
  });

  it('houdt de koprij Nederlands, ook al bestaat er een Engelse vertaling van die woorden', () => {
    // `translate('en', 'Datum')` is 'Date'; stond er `t()` in de koprij, dan schreef een
    // beheerder met de app op Engels een bestand dat de eigen import niet meer herkent.
    expect(translate('en', 'Datum')).toBe('Date');
    expect(bladLessen([booking()], tabellen).koppen[0]).toBe('Datum');
  });

  it('geeft een leeg blad met alleen de koprij bij nul lessen', () => {
    const blad = bladLessen([], tabellen);
    expect(blad.rijen).toEqual([]);
    expect(blad.koppen).toHaveLength(16);
    expect(blad.breedtes).toHaveLength(16);
  });

  it('zet de datum als datum en het aantal spelers als getal', () => {
    const blad = bladLessen([groepsles()], tabellen);
    expect(blad.rijen[0][kolom(blad, 'Datum')].soort).toBe('datum');
    expect(blad.rijen[0][kolom(blad, 'Spelers')]).toEqual({ soort: 'getal', waarde: 6 });
    expect(blad.rijen[0][kolom(blad, 'Weeknr')].soort).toBe('getal');
  });
});

describe('Lessen — round-trip', () => {
  // De koppen letterlijk uit `.planning/IMPORT-SJABLOON.md`: vijf verplichte en vier die de
  // import leest als ze er staan. Deze lijst staat hier apart en niet uit de code afgeleid —
  // wie een kolom hernoemt, laat hem hier omvallen en niet pas in fase 5 bij een herimport
  // die de halve club verdubbelt.
  const VERPLICHT = ['Datum', 'Uur', 'Groep', 'Coach', 'Leerling'];
  const OPTIONEEL = ['Groep-ID', 'Type les', 'E-mail leerling', 'Baan'];

  function geschrevenBlad(): string {
    const blad = bladLessen([groepsles(), booking()], tabellen);
    return inhoudVan(buildWorkbook([blad]), 'xl/worksheets/sheet1.xml');
  }

  it('schrijft alle verplichte en optionele koppen die de import leest', () => {
    const koprij = /<row r="1">(.*?)<\/row>/.exec(geschrevenBlad())?.[1] ?? '';
    const koppen = [...koprij.matchAll(/<t xml:space="preserve">(.*?)<\/t>/g)].map((m) => m[1]);
    for (const kop of [...VERPLICHT, ...OPTIONEEL]) {
      expect(koppen).toContain(kop);
    }
    expect(koppen).toHaveLength(16);
    expect(koppen).not.toContain('Locatie');
  });

  it('schrijft de Datum-cel als datumcel en niet als tekst', () => {
    const eersteRij = /<row r="2">(.*?)<\/row>/.exec(geschrevenBlad())?.[1] ?? '';
    const eersteCel = /<c r="A2"[^>]*>/.exec(eersteRij)?.[0] ?? '';
    expect(eersteCel).not.toContain('inlineStr');
    expect(eersteRij).toMatch(/<c r="A2" s="\d+"><v>\d+<\/v><\/c>/);
  });

  it('schrijft zes rijen voor de groepsles en één voor de privéles', () => {
    const rijen = [...geschrevenBlad().matchAll(/<row r="(\d+)"/g)].map((m) => m[1]);
    // De koprij plus zeven lesregels.
    expect(rijen).toHaveLength(8);
  });
});

// ---------------------------------------------------------------------------
// Blad "Uren per trainer"
// ---------------------------------------------------------------------------

/** Sam geeft les maar heeft nog geen uurtarief ingevuld — de vergeten-tarief-toestand. */
const trainers: User[] = [
  ...users,
  { id: 'sam', name: 'Sam', email: 'sam@club.be', role: 'coach' },
];

/**
 * Zes lessen die samen elk geval van het blad raken: twee gewone lessen van Koen (waarvan
 * één van anderhalf uur), een les van Ann, een les van Koen die Ann als vervangster gaf, een
 * geannuleerde les van twee uur, en een les van Sam die geen tarief heeft.
 */
const loonlessen: Booking[] = [
  booking({ id: 'l1' }),
  booking({ id: 'l2', start_time: '2026-08-20T17:00:00', end_time: '2026-08-20T18:30:00' }),
  booking({ id: 'l3', coach_id: 'ann' }),
  booking({ id: 'l4', coach_id: 'koen', taught_by_id: 'ann' }),
  booking({ id: 'l5', status: 'cancelled', start_time: '2026-08-21T17:00:00', end_time: '2026-08-21T19:00:00' }),
  booking({ id: 'l6', coach_id: 'sam' }),
];

describe('bladUrenPerTrainer', () => {
  it('heet "Uren per trainer" en heeft de vijf vastgelegde koppen, in volgorde', () => {
    const blad = bladUrenPerTrainer(loonlessen, trainers);
    expect(blad.naam).toBe('Uren per trainer');
    expect(blad.koppen).toEqual(['Trainer', 'Lessen', 'Uren', 'Loon (EUR)', 'Let op']);
  });

  it('neemt trainer, lessen en loon letterlijk over uit payoutsByCoach, in dezelfde volgorde', () => {
    // Met opzet geen met de hand herhaalde bedragen: het blad en Beheer → Rapport moeten
    // hetzelfde tonen, dus de test vergelijkt met de bron en niet met een tweede berekening.
    const blad = bladUrenPerTrainer(loonlessen, trainers);
    const verwacht = payoutsByCoach(loonlessen, trainers);

    expect(blad.rijen).toHaveLength(verwacht.length);
    verwacht.forEach((r, i) => {
      expect(cel(blad, i, 'Trainer')).toBe(r.name);
      expect(Number(cel(blad, i, 'Lessen'))).toBe(r.lessons);
      expect(Number(cel(blad, i, 'Loon (EUR)'))).toBe(r.amount);
    });
  });

  it('telt de uren van dezelfde lessen die payoutsByCoach als lessen telt', () => {
    const blad = bladUrenPerTrainer(loonlessen, trainers);
    // Koen: één les van een uur plus één van anderhalf. Zijn geannuleerde les van twee uur
    // telt niet mee, en zijn vervangen les evenmin — die staat bij Ann.
    expect(Number(cel(blad, kolomRij(blad, 'Koen'), 'Uren'))).toBe(2.5);
    // Ann: haar eigen les plus de les die ze voor Koen gaf.
    expect(Number(cel(blad, kolomRij(blad, 'Ann'), 'Uren'))).toBe(2);
  });

  it('zet de uren en het loon van een vervangen les bij de vervangster', () => {
    const blad = bladUrenPerTrainer([booking({ coach_id: 'koen', taught_by_id: 'ann' })], trainers);
    expect(blad.rijen).toHaveLength(1);
    expect(cel(blad, 0, 'Trainer')).toBe('Ann');
    expect(Number(cel(blad, 0, 'Uren'))).toBe(1);
    // Ann rekent 22 per uur, Koen 24: het bedrag bewijst dat ook het tarief mee verhuisde.
    expect(Number(cel(blad, 0, 'Loon (EUR)'))).toBe(22);
  });

  it('laat een geannuleerde les in geen enkele kolom meetellen', () => {
    const blad = bladUrenPerTrainer([
      booking({ id: 'weg', status: 'cancelled', end_time: '2026-08-19T19:00:00' }),
      booking({ id: 'blijft' }),
    ], trainers);
    expect(Number(cel(blad, 0, 'Lessen'))).toBe(1);
    expect(Number(cel(blad, 0, 'Uren'))).toBe(1);
    expect(Number(cel(blad, 0, 'Loon (EUR)'))).toBe(24);
  });

  it('markeert een trainer zonder uurtarief zichtbaar, met loon 0', () => {
    const blad = bladUrenPerTrainer(loonlessen, trainers);
    const rij = kolomRij(blad, 'Sam');
    expect(Number(cel(blad, rij, 'Loon (EUR)'))).toBe(0);
    expect(cel(blad, rij, 'Let op')).toBe('Geen uurtarief ingevuld');
    // Een trainer die zijn tarief wél invulde krijgt geen melding.
    expect(cel(blad, kolomRij(blad, 'Koen'), 'Let op')).toBe('');
  });

  it('schrijft loon als geldcel en lessen en uren als getalcellen', () => {
    const blad = bladUrenPerTrainer(loonlessen, trainers);
    expect(blad.rijen[0][kolom(blad, 'Lessen')].soort).toBe('getal');
    expect(blad.rijen[0][kolom(blad, 'Uren')].soort).toBe('getal');
    expect(blad.rijen[0][kolom(blad, 'Loon (EUR)')].soort).toBe('geld');
    expect(blad.rijen[0][kolom(blad, 'Trainer')].soort).toBe('tekst');
  });

  it('heeft geen kolom met omzet, lesprijs of wat een speler betaalt', () => {
    const blad = bladUrenPerTrainer(loonlessen, trainers);
    // Omzet loopt op het uurtarief van de baan en het loon op dat van de trainer. Naast
    // elkaar op één blad is precies hoe die twee bedragen in elkaar schuiven (D-05).
    for (const kop of blad.koppen) {
      expect(kop).not.toMatch(/omzet|prijs|betaal/i);
    }
  });

  it('geeft een leeg blad terug als er geen lessen zijn', () => {
    const blad = bladUrenPerTrainer([], trainers);
    expect(blad.rijen).toHaveLength(0);
    expect(blad.koppen).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// Blad "Groepen"
// ---------------------------------------------------------------------------

/** Een tweede actieve groep, met opzet vóór "Groep 8" in het alfabet. */
const g3: LesGroep = {
  id: 'g3', name: 'Beginners', level: 'Start',
  weekday: 0, start_hour: 9, start_minute: 30,
  coach_id: 'ann', court_id: 'baan-1',
  season_start: '2026-09-01', season_end: '2027-06-30',
  roster: ['p1', 'p2'], archived: false,
};

/** Een groep van vorig seizoen die in de geëxporteerde periode nog lessen had. */
const gOud: LesGroep = {
  ...g3, id: 'g-oud', name: 'Groep van vorig jaar', level: 'Gevorderd',
  weekday: 5, start_hour: 20, start_minute: 0, coach_id: 'koen',
  roster: ['p3'], archived: true,
};

/** Een groep van vóór dat: gearchiveerd én zonder les in de periode. */
const gWeg: LesGroep = { ...gOud, id: 'g-weg', name: 'Allang gestopt', roster: [] };

/** Een actieve groep zonder trainer — een import levert die op, en dat mag. */
const gZonderTrainer: LesGroep = {
  ...g3, id: 'g-los', name: 'Nog te koppelen', coach_id: undefined, roster: ['p4'],
  archived: false,
};

const alleGroepen: LesGroep[] = [...groepen, g3, gOud, gWeg, gZonderTrainer];
const groepstabellen = opzoektabellen(users, courts, alleGroepen);

/** Twee lessen voor Groep 8 en één voor de gearchiveerde groep. */
const groepslessen: Booking[] = [
  groepsles({ id: 'gl1' }),
  groepsles({ id: 'gl2', start_time: '2026-08-26T17:00:00', end_time: '2026-08-26T18:00:00' }),
  booking({ id: 'oud1', group_id: 'g-oud', participant_ids: ['p3'] }),
];

describe('bladGroepen', () => {
  it('heet "Groepen" en heeft de acht vastgelegde koppen, in volgorde', () => {
    const blad = bladGroepen(alleGroepen, groepslessen, groepstabellen);
    expect(blad.naam).toBe('Groepen');
    expect(blad.koppen).toEqual([
      'Groep-ID', 'Groep', 'Type les', 'Dag', 'Uur', 'Trainer', 'Spelers', 'Lessen in periode',
    ]);
  });

  it('zet het Groep-ID van de lesgroep zelf in de eerste kolom', () => {
    const blad = bladGroepen([groepen[0]], [], groepstabellen);
    expect(cel(blad, 0, 'Groep-ID')).toBe('g8');
    expect(cel(blad, 0, 'Groep')).toBe('Groep 8');
    expect(cel(blad, 0, 'Type les')).toBe('Gevorderd');
  });

  it('toont de Nederlandse weekdag met zondag = 0, en het uur als HH:MM', () => {
    const blad = bladGroepen([groepen[0], g3], [], groepstabellen);
    expect(cel(blad, groepRij(blad, 'Groep 8'), 'Dag')).toBe('woensdag');
    expect(cel(blad, groepRij(blad, 'Groep 8'), 'Uur')).toBe('17:00');
    expect(cel(blad, groepRij(blad, 'Beginners'), 'Dag')).toBe('zondag');
    expect(cel(blad, groepRij(blad, 'Beginners'), 'Uur')).toBe('09:30');
  });

  it('toont de trainer bij coach_id en laat hem leeg als de groep er nog geen heeft', () => {
    const blad = bladGroepen([groepen[0], gZonderTrainer], [], groepstabellen);
    expect(cel(blad, groepRij(blad, 'Groep 8'), 'Trainer')).toBe('Koen');
    // Een groep zonder trainer is een aanvaarde toestand, geen fout — dus geen "Onbekend".
    expect(cel(blad, groepRij(blad, 'Nog te koppelen'), 'Trainer')).toBe('');
  });

  it('telt de spelers uit het roster en de lessen uit de meegegeven boekingen', () => {
    const blad = bladGroepen(alleGroepen, groepslessen, groepstabellen);
    const rij = groepRij(blad, 'Groep 8');
    expect(Number(cel(blad, rij, 'Spelers'))).toBe(6);
    expect(Number(cel(blad, rij, 'Lessen in periode'))).toBe(2);
  });

  it('houdt een actieve groep zonder lessen op het blad, met 0 lessen', () => {
    const blad = bladGroepen(alleGroepen, groepslessen, groepstabellen);
    const rij = groepRij(blad, 'Beginners');
    expect(Number(cel(blad, rij, 'Lessen in periode'))).toBe(0);
    expect(Number(cel(blad, rij, 'Spelers'))).toBe(2);
  });

  it('neemt een gearchiveerde groep mee die in de periode nog een les had', () => {
    // Een export van vorig seizoen mist anders precies de groepen waar hij over gaat.
    const blad = bladGroepen(alleGroepen, groepslessen, groepstabellen);
    const rij = groepRij(blad, 'Groep van vorig jaar');
    expect(cel(blad, rij, 'Groep-ID')).toBe('g-oud');
    expect(Number(cel(blad, rij, 'Lessen in periode'))).toBe(1);
  });

  it('laat een gearchiveerde groep zonder lessen in de periode weg', () => {
    const blad = bladGroepen(alleGroepen, groepslessen, groepstabellen);
    expect(blad.rijen.map((r) => (r[1] as { waarde: unknown }).waarde)).not.toContain('Allang gestopt');
  });

  it('sorteert de rijen op groepsnaam, zodat twee exports naast elkaar te leggen zijn', () => {
    const blad = bladGroepen(alleGroepen, groepslessen, groepstabellen);
    expect(blad.rijen.map((r) => (r[1] as { waarde: unknown }).waarde)).toEqual([
      'Beginners', 'Groep 8', 'Groep van vorig jaar', 'Nog te koppelen',
    ]);
  });

  it('schrijft spelers en lessen als getalcellen en het Groep-ID als tekst', () => {
    const blad = bladGroepen(alleGroepen, groepslessen, groepstabellen);
    expect(blad.rijen[0][kolom(blad, 'Spelers')].soort).toBe('getal');
    expect(blad.rijen[0][kolom(blad, 'Lessen in periode')].soort).toBe('getal');
    // Een id is geen getal: als tekst blijft de laatste cijfergroep heel en gaat er niets
    // in wetenschappelijke notatie het bestand uit.
    expect(blad.rijen[0][kolom(blad, 'Groep-ID')].soort).toBe('tekst');
  });

  it('telt een geannuleerde les van de groep mee als ingeplande les', () => {
    // Dit blad beschrijft de planning van de groep, niet het loon: een afgezegde les stond
    // wel degelijk ingepland en hoort de trainer te zien.
    const blad = bladGroepen([groepen[0]], [groepsles({ status: 'cancelled' })], groepstabellen);
    expect(Number(cel(blad, 0, 'Lessen in periode'))).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Blad "Aanwezigheid"
// ---------------------------------------------------------------------------

/** De eerste les van Groep 8: Mathis betaalt, Lotte en Jules staan erbij. */
function lesA(over: Partial<Booking> = {}): Booking {
  return booking({
    id: 'a1', group_id: 'g8', court_id: 'hal-1',
    participant_ids: ['p2', 'p3'],
    // Jules is nog niet afgevinkt: dat is de derde stand, en die hoort een lege cel te worden.
    attendance: { p1: 'aanwezig', p2: 'afwezig' },
    ...over,
  });
}

/** Een week later. Jules is weg, Fien staat er nu bij — dezelfde groep, andere spelers. */
function lesB(over: Partial<Booking> = {}): Booking {
  return booking({
    id: 'a2', group_id: 'g8', court_id: 'hal-1',
    start_time: '2026-08-26T17:00:00', end_time: '2026-08-26T18:00:00',
    participant_ids: ['p2', 'p4'],
    attendance: { p4: 'aanwezig' },
    ...over,
  });
}

/** Met opzet in de verkeerde volgorde meegegeven: het blad hoort zelf chronologisch te staan. */
const aanwezigheidslessen: Booking[] = [lesB(), lesA()];

/** Groep 8 met een rooster dat precies de spelers van de twee lessen bevat. */
const groepNu: LesGroep = { ...groepen[0], roster: ['p1', 'p2', 'p3', 'p4'] };

/** De cellen van één rij als tekst; de rijen van dit blad zijn niet allemaal even lang. */
function rijTekst(blad: XlsxBlad, r: number): string[] {
  return blad.rijen[r].map((c) => String((c as { waarde: unknown }).waarde));
}

describe('bladAanwezigheid', () => {
  it('heet "Aanwezigheid" en zet de groep, de speler en daarna de lesmomenten in de koprij', () => {
    const blad = bladAanwezigheid([groepNu], aanwezigheidslessen, tabellen);
    expect(blad.naam).toBe('Aanwezigheid');
    expect(blad.koppen).toEqual(['Groep', 'Speler', 'Les 1', 'Les 2']);
  });

  it('opent elk groepsblok met een datumrij, chronologisch als dd/mm', () => {
    const blad = bladAanwezigheid([groepNu], aanwezigheidslessen, tabellen);
    expect(rijTekst(blad, 0)).toEqual(['Groep 8', 'Datum', '19/08', '26/08']);
  });

  it('zet X bij aanwezig, afw bij afwezig en laat de cel echt leeg als er niets staat', () => {
    const blad = bladAanwezigheid([groepNu], aanwezigheidslessen, tabellen);
    // Op naam gesorteerd: Fien, Jules, Lotte, Mathis.
    expect(rijTekst(blad, 1)).toEqual(['', 'Fien', '', 'X']);
    // Jules stond alleen in de eerste les en werd daar niet afgevinkt: twee lege cellen.
    expect(rijTekst(blad, 2)).toEqual(['', 'Jules', '', '']);
    expect(rijTekst(blad, 3)).toEqual(['', 'Lotte', 'afw', '']);
    expect(rijTekst(blad, 4)).toEqual(['', 'Mathis', 'X', '']);
  });

  it('schrijft de niet-ingevulde cel als lege tekstcel, zodat er met de hand in te schrijven valt', () => {
    const blad = bladAanwezigheid([groepNu], aanwezigheidslessen, tabellen);
    expect(blad.rijen[2][2]).toEqual({ soort: 'tekst', waarde: '' });
    expect(blad.rijen[2][3]).toEqual({ soort: 'tekst', waarde: '' });
  });

  it('zet één lege rij na elk groepsblok', () => {
    const blad = bladAanwezigheid([groepNu], aanwezigheidslessen, tabellen);
    expect(blad.rijen).toHaveLength(6);
    expect(blad.rijen[5]).toEqual([]);
  });

  it('verandert niet als er vandaag iemand aan het rooster van de groep bij komt', () => {
    // De val van deze fase: het rooster is wie er nú in de groep zit. Een export van augustus
    // mag niet meebewegen met een wijziging van vandaag.
    const erbij: LesGroep = { ...groepNu, roster: [...groepNu.roster, 'p5', 'p6'] };
    expect(bladAanwezigheid([erbij], aanwezigheidslessen, tabellen))
      .toEqual(bladAanwezigheid([groepNu], aanwezigheidslessen, tabellen));
    const namen = bladAanwezigheid([erbij], aanwezigheidslessen, tabellen)
      .rijen.map((r) => String((r[1] as { waarde: unknown } | undefined)?.waarde ?? ''));
    expect(namen).not.toContain('Wout');
    expect(namen).not.toContain('Nore');
  });

  it('houdt een speler op het blad die uit het rooster gehaald is maar wél in de lessen zat', () => {
    const zonderJules: LesGroep = { ...groepNu, roster: ['p1', 'p2', 'p4'] };
    const namen = bladAanwezigheid([zonderJules], aanwezigheidslessen, tabellen)
      .rijen.map((r) => String((r[1] as { waarde: unknown } | undefined)?.waarde ?? ''));
    expect(namen).toContain('Jules');
  });

  it('slaat een groep zonder lessen in de periode over', () => {
    const blad = bladAanwezigheid([groepNu, g3], aanwezigheidslessen, groepstabellen);
    const groepsnamen = blad.rijen.map((r) => String((r[0] as { waarde: unknown } | undefined)?.waarde ?? ''));
    expect(groepsnamen).not.toContain('Beginners');
    expect(groepsnamen).toContain('Groep 8');
  });

  it('noemt een speler die de app niet meer kent Onbekend, en laat hem niet vallen', () => {
    const blad = bladAanwezigheid(
      [groepNu],
      [lesA({ participant_ids: ['p2', 'weg'], attendance: { weg: 'aanwezig' } })],
      tabellen,
    );
    const namen = blad.rijen.map((r) => String((r[1] as { waarde: unknown } | undefined)?.waarde ?? ''));
    expect(namen).toContain('Onbekend');
  });

  it('geeft een geannuleerde les geen kolom: er is die dag niets gebeurd om af te vinken', () => {
    const blad = bladAanwezigheid(
      [groepNu],
      [...aanwezigheidslessen, lesA({ id: 'a3', status: 'cancelled', start_time: '2026-09-02T17:00:00' })],
      tabellen,
    );
    expect(blad.koppen).toEqual(['Groep', 'Speler', 'Les 1', 'Les 2']);
    expect(rijTekst(blad, 0)).toEqual(['Groep 8', 'Datum', '19/08', '26/08']);
  });

  it('geeft evenveel leskolommen als de groep met de meeste lessen', () => {
    const beginnersles = booking({
      id: 'c1', group_id: 'g3', participant_ids: ['p2'],
      start_time: '2026-08-23T09:30:00', end_time: '2026-08-23T10:30:00',
      attendance: { p1: 'aanwezig' },
    });
    const blad = bladAanwezigheid([groepNu, g3], [...aanwezigheidslessen, beginnersles], groepstabellen);
    expect(blad.koppen).toEqual(['Groep', 'Speler', 'Les 1', 'Les 2']);
    // Op naam gesorteerd staat Beginners voorop, met maar één lesmoment: één datumrij, twee
    // spelers en de lege rij ertussen — daarna pas het blok van Groep 8.
    expect(rijTekst(blad, 0)).toEqual(['Beginners', 'Datum', '23/08']);
    expect(blad.rijen[3]).toEqual([]);
    expect(rijTekst(blad, 4)).toEqual(['Groep 8', 'Datum', '19/08', '26/08']);
  });

  it('geeft een leeg blad terug als er geen lessen zijn', () => {
    const blad = bladAanwezigheid([groepNu], [], tabellen);
    expect(blad.rijen).toHaveLength(0);
    expect(blad.koppen).toEqual(['Groep', 'Speler']);
  });
});

// ---------------------------------------------------------------------------
// De werkmap zelf
// ---------------------------------------------------------------------------

/**
 * Alles wat het scherm zou meegeven: de lessen van de periode, de leden, de banen en de
 * groepen. Eén privéles erbij, zodat blad "Lessen" ook een regel zonder groep heeft.
 */
const gegevens: ExportGegevens = {
  bookings: [...aanwezigheidslessen, booking({ id: 'prive' })],
  users: trainers,
  courts,
  groepen: alleGroepen,
};

/** De namen van de tabbladen, in de volgorde waarin ze in het bestand staan. */
function tabnamen(bytes: Uint8Array): string[] {
  const workbook = inhoudVan(bytes, 'xl/workbook.xml');
  return [...workbook.matchAll(/<sheet name="([^"]*)"/g)].map((m) => m[1]);
}

describe('exportWerkmap', () => {
  it('levert bytes die met de zip-handtekening beginnen', () => {
    const bytes = exportWerkmap(gegevens);
    expect(bytes.length).toBeGreaterThan(0);
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('zet vier bladen in het bestand', () => {
    const bytes = exportWerkmap(gegevens);
    for (const pad of ['sheet1.xml', 'sheet2.xml', 'sheet3.xml', 'sheet4.xml']) {
      expect(inhoudVan(bytes, `xl/worksheets/${pad}`)).toContain('<worksheet');
    }
  });

  it('noemt de tabbladen Lessen, Uren per trainer, Aanwezigheid, Groepen — in die volgorde', () => {
    // De volgorde ligt vast (D-01): "Lessen" vooraan omdat dat het blad is dat de import van
    // fase 5 terugleest, en het blad waar de beheerder als eerste in kijkt.
    expect(tabnamen(exportWerkmap(gegevens)))
      .toEqual(['Lessen', 'Uren per trainer', 'Aanwezigheid', 'Groepen']);
  });

  it('zet op elk blad zijn eigen inhoud', () => {
    const bytes = exportWerkmap(gegevens);
    expect(inhoudVan(bytes, 'xl/worksheets/sheet1.xml')).toContain('>Mathis<');
    expect(inhoudVan(bytes, 'xl/worksheets/sheet2.xml')).toContain('>Koen<');
    expect(inhoudVan(bytes, 'xl/worksheets/sheet3.xml')).toMatch(/<t xml:space="preserve">X<\/t>/);
    expect(inhoudVan(bytes, 'xl/worksheets/sheet4.xml')).toContain('>Groep-ID<');
  });

  it('schrijft de datums op blad Lessen als datumcellen en niet als tekst', () => {
    const blad1 = inhoudVan(exportWerkmap(gegevens), 'xl/worksheets/sheet1.xml');
    const eersteRij = /<row r="2">(.*?)<\/row>/.exec(blad1)?.[1] ?? '';
    expect(eersteRij).toMatch(/<c r="A2" s="3"><v>\d+<\/v><\/c>/);
    expect(/<c r="A2"[^>]*>/.exec(eersteRij)?.[0]).not.toContain('inlineStr');
  });

  it('schrijft het loon op blad Uren per trainer als geldcel en niet als tekst', () => {
    const blad2 = inhoudVan(exportWerkmap(gegevens), 'xl/worksheets/sheet2.xml');
    const eersteRij = /<row r="2">(.*?)<\/row>/.exec(blad2)?.[1] ?? '';
    // Kolom D is "Loon (EUR)"; stijl 2 is het bedrag met twee decimalen.
    expect(eersteRij).toMatch(/<c r="D2" s="2"><v>[\d.]+<\/v><\/c>/);
  });

  it('levert bij lege invoer nog steeds een geldig bestand met vier bladen en alleen koprijen', () => {
    const leeg = exportWerkmap({ bookings: [], users: [], courts: [], groepen: [] });
    expect(tabnamen(leeg)).toHaveLength(4);
    for (const pad of ['sheet1.xml', 'sheet2.xml', 'sheet3.xml', 'sheet4.xml']) {
      const blad = inhoudVan(leeg, `xl/worksheets/${pad}`);
      expect([...blad.matchAll(/<row r="(\d+)"/g)]).toHaveLength(1);
    }
  });

  it('levert twee keer hetzelfde bestand bij dezelfde invoer', () => {
    // Anders kan niemand twee exports van hetzelfde seizoen naast elkaar leggen.
    expect(exportWerkmap(gegevens)).toEqual(exportWerkmap(gegevens));
  });
});
