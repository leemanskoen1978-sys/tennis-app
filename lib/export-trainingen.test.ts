import {
  bladLessen, bladUrenPerTrainer, koppenVan, naarRijen, opzoektabellen, type ExportKolom,
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
