import { koppenVan, naarRijen, opzoektabellen, type ExportKolom } from './export-trainingen';
import type { Booking, Court, LesGroep, User } from './types';

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
