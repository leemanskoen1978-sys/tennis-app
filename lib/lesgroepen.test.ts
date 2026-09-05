import {
  lesGroepFout, lessenVanGroep, groupBookingsFrom, komendeLessen, planRosterChange,
  groepSleutel, actieveGroepen, gearchiveerdeGroepen,
} from './lesgroepen';
import type { Booking, LesGroep } from './types';

const base: Booking = {
  id: 'b1', player_id: 'p1', coach_id: 'koen', court_id: 'court-1',
  start_time: '2026-09-01T10:00:00.000Z', end_time: '2026-09-01T11:00:00.000Z',
  status: 'confirmed', payment_method: 'open',
};

/** Eén les van een groep, op een gekozen dag. */
const les = (id: string, dag: string, extra: Partial<Booking> = {}): Booking => ({
  ...base,
  id,
  start_time: `${dag}T10:00:00.000Z`,
  end_time: `${dag}T11:00:00.000Z`,
  group_id: 'g-1',
  participant_ids: ['oud'],
  ...extra,
});

/** Een groep die deugt; elke test die een fout wil, sloopt er één ding aan. */
const groep = (extra: Partial<LesGroep> = {}): LesGroep => ({
  id: 'g-1',
  name: 'Groep 8',
  level: 'Kidstennis oranje',
  weekday: 2,
  start_hour: 18,
  start_minute: 0,
  coach_id: 'koen',
  court_id: 'court-1',
  season_start: '2026-09-01',
  season_end: '2027-06-30',
  roster: ['oud'],
  archived: false,
  ...extra,
});

/** Woensdag 5 september 2026, 10:00 — het "nu" van elke test hieronder. */
const nu = new Date('2026-09-05T10:00:00.000Z');

const { id: _weg, ...geldig } = groep();

describe('lesGroepFout', () => {
  it('laat een groep die deugt door', () => {
    expect(lesGroepFout(geldig)).toBeNull();
  });

  it('weigert een lege naam', () => {
    expect(lesGroepFout({ ...geldig, name: '   ' })).toBe('Geef de lesgroep een naam.');
  });

  it('weigert een leeg niveau', () => {
    expect(lesGroepFout({ ...geldig, level: '' })).toBe('Geef de lesgroep een niveau.');
  });

  it('weigert een lesdag buiten de week', () => {
    expect(lesGroepFout({ ...geldig, weekday: 7 })).toBe('Kies een lesdag van de week.');
    expect(lesGroepFout({ ...geldig, weekday: -1 })).toBe('Kies een lesdag van de week.');
  });

  it('weigert een beginuur buiten de dag', () => {
    expect(lesGroepFout({ ...geldig, start_hour: 24 })).toBe('Kies een beginuur tussen 0 en 23.');
    expect(lesGroepFout({ ...geldig, start_hour: -1 })).toBe('Kies een beginuur tussen 0 en 23.');
  });

  it('weigert een beginminuut buiten het uur', () => {
    expect(lesGroepFout({ ...geldig, start_minute: 60 }))
      .toBe('Kies een beginminuut tussen 0 en 59.');
  });

  it('weigert een groep zonder trainer', () => {
    expect(lesGroepFout({ ...geldig, coach_id: undefined }))
      .toBe('Kies een trainer voor de lesgroep.');
  });

  it('weigert een seizoen dat eindigt voor het begint', () => {
    expect(lesGroepFout({ ...geldig, season_start: '2027-06-30', season_end: '2026-09-01' }))
      .toBe('Het seizoen eindigt voor het begint.');
  });

  it('laat een seizoen van één dag toe', () => {
    expect(lesGroepFout({ ...geldig, season_start: '2026-09-01', season_end: '2026-09-01' }))
      .toBeNull();
  });
});

describe('lessenVanGroep', () => {
  it('neemt elke les van de groep mee, ook die al geweest zijn', () => {
    const lijst = [les('b-1', '2026-09-01'), les('b-2', '2026-09-10'), les('b-3', '2026-08-01')];
    expect(lessenVanGroep(lijst, 'g-1').map((b) => b.id)).toEqual(['b-3', 'b-1', 'b-2']);
  });

  it('laat de lessen van een andere groep en de losse lessen liggen', () => {
    const anders = les('x', '2026-09-10', { group_id: 'g-2' });
    const los = les('los', '2026-09-10', { group_id: undefined });
    expect(lessenVanGroep([les('b-1', '2026-09-10'), anders, los], 'g-1').map((b) => b.id))
      .toEqual(['b-1']);
  });
});

describe('groupBookingsFrom — vanaf vandaag vooruit', () => {
  it('geeft de lessen van vandaag en later, op tijd gesorteerd', () => {
    const lijst = [les('b-3', '2026-09-20'), les('b-1', '2026-09-06'), les('b-2', '2026-09-13')];
    expect(groupBookingsFrom(lijst, 'g-1', nu).map((b) => b.id)).toEqual(['b-1', 'b-2', 'b-3']);
  });

  it('telt een les die precies op nu begint wel mee', () => {
    const stipt = les('stipt', '2026-09-05');
    expect(groupBookingsFrom([stipt], 'g-1', nu).map((b) => b.id)).toEqual(['stipt']);
  });

  it('laat een les van gisteren buiten beschouwing', () => {
    const lijst = [les('gisteren', '2026-09-04'), les('morgen', '2026-09-06')];
    expect(groupBookingsFrom(lijst, 'g-1', nu).map((b) => b.id)).toEqual(['morgen']);
  });

  it('geeft een lege lijst bij een onbekende groep, en geen fout', () => {
    expect(groupBookingsFrom([les('b-1', '2026-09-10')], 'bestaat-niet', nu)).toEqual([]);
  });

  it('filtert afgezegde lessen niet weg — tellen en tonen mogen ze wel', () => {
    const af = les('af', '2026-09-10', { status: 'cancelled' });
    expect(groupBookingsFrom([af, les('b-1', '2026-09-06')], 'g-1', nu).map((b) => b.id))
      .toEqual(['b-1', 'af']);
  });
});

describe('komendeLessen', () => {
  it('is groupBookingsFrom zonder de afgezegde lessen', () => {
    const af = les('af', '2026-09-10', { status: 'cancelled' });
    const lijst = [af, les('b-1', '2026-09-06'), les('oud', '2026-09-01')];
    expect(komendeLessen(lijst, 'g-1', nu).map((b) => b.id)).toEqual(['b-1']);
  });
});

describe('planRosterChange', () => {
  it('geeft het nieuwe rooster aan precies de komende lessen en aan geen enkele andere', () => {
    const lijst = [les('b-1', '2026-09-06'), les('b-2', '2026-09-13')];
    const plan = planRosterChange(groep(), ['nieuw', 'erbij'], lijst, nu);
    expect(plan.bookingPatches).toEqual([
      { id: 'b-1', participant_ids: ['nieuw', 'erbij'] },
      { id: 'b-2', participant_ids: ['nieuw', 'erbij'] },
    ]);
  });

  it('raakt nooit een les die al geweest is', () => {
    const gisteren = les('b-1', '2026-09-01');
    const morgen = les('b-2', '2026-09-10');
    const plan = planRosterChange(groep(), ['nieuw'], [gisteren, morgen], nu);
    expect(plan.bookingPatches.map((p) => p.id)).toEqual(['b-2']);
  });

  it('laat de deelnemers van een les die al geweest is ongemoeid', () => {
    // De prijs en de aanwezigheid van die les hangen aan participant_ids (zie lib/groups);
    // blijft die lijst staan, dan blijven prijs en aanwezigheid vanzelf ook staan.
    const gisteren = les('b-1', '2026-09-01');
    planRosterChange(groep(), ['nieuw'], [gisteren, les('b-2', '2026-09-10')], nu);
    expect(gisteren.participant_ids).toEqual(['oud']);
  });

  it('geeft een afgezegde les van later geen nieuw rooster', () => {
    const af = les('af', '2026-09-10', { status: 'cancelled' });
    const plan = planRosterChange(groep(), ['nieuw'], [af, les('b-1', '2026-09-06')], nu);
    expect(plan.bookingPatches.map((p) => p.id)).toEqual(['b-1']);
  });

  it('muteert geen enkele meegegeven boeking', () => {
    const morgen = les('b-2', '2026-09-10');
    const voor = JSON.stringify(morgen);
    planRosterChange(groep(), ['nieuw'], [morgen], nu);
    expect(JSON.stringify(morgen)).toBe(voor);
  });

  it('levert een nieuwe groep op en laat de meegegeven groep ongemoeid', () => {
    const g = groep();
    const plan = planRosterChange(g, ['nieuw'], [], nu);
    expect(plan.group).not.toBe(g);
    expect(plan.group.roster).toEqual(['nieuw']);
    expect(g.roster).toEqual(['oud']);
  });
});

describe('groepSleutel', () => {
  it('is de naam in kleine letters, de weekdag en het beginuur', () => {
    expect(groepSleutel({ name: 'Groep 8', weekday: 2, start_hour: 18 })).toBe('groep 8|2|18');
  });

  it('negeert spaties aan de randen van de naam', () => {
    expect(groepSleutel({ name: '  Groep 8 ', weekday: 2, start_hour: 18 }))
      .toBe(groepSleutel({ name: 'groep 8', weekday: 2, start_hour: 18 }));
  });

  it('scheidt twee groepen met dezelfde naam op een ander uur', () => {
    expect(groepSleutel({ name: 'Groep 8', weekday: 2, start_hour: 18 }))
      .not.toBe(groepSleutel({ name: 'Groep 8', weekday: 2, start_hour: 19 }));
  });
});

describe('actieveGroepen en gearchiveerdeGroepen', () => {
  const lopend = groep({ id: 'g-1' });
  const weg = groep({ id: 'g-2', archived: true });

  it('houdt de lopende groepen over bij het archiveren van een andere', () => {
    expect(actieveGroepen([lopend, weg]).map((g) => g.id)).toEqual(['g-1']);
  });

  it('toont de gearchiveerde groepen apart, zodat er niets verdwijnt', () => {
    expect(gearchiveerdeGroepen([lopend, weg]).map((g) => g.id)).toEqual(['g-2']);
  });

  it('is samen de hele lijst — een groep valt nooit tussen wal en schip', () => {
    const alles = [lopend, weg, groep({ id: 'g-3' })];
    expect(actieveGroepen(alles).length + gearchiveerdeGroepen(alles).length).toBe(alles.length);
  });
});
