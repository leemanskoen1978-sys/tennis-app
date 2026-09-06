// De uurwisseltest heeft een tijdzone nodig die de klok écht verzet; op een machine in
// UTC zou hij groen worden zonder iets te bewijzen. Dit is de zone waarin de club staat.
process.env.TZ = 'Europe/Brussels';

import {
  lesGroepFout, lessenVanGroep, groupBookingsFrom, komendeLessen, planRosterChange,
  planGroepWijziging, groepSleutel, actieveGroepen, gearchiveerdeGroepen,
} from './lesgroepen';
import type { Booking, LesGroep, Vakantie } from './types';

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
  it('is de weekdag, het beginuur en de baan', () => {
    expect(groepSleutel({ weekday: 2, start_hour: 18, court_id: 'c-1' })).toBe('2|18|c-1');
  });

  it('geeft dezelfde sleutel of de baan nu ontbreekt of undefined is', () => {
    expect(groepSleutel({ weekday: 3, start_hour: 17 }))
      .toBe(groepSleutel({ weekday: 3, start_hour: 17, court_id: undefined }));
  });

  it('telt de naam niet mee: twee namen op hetzelfde moment zijn dezelfde groep', () => {
    // Dit is de kern van de wijziging. De kolom `Groep` uit het Tennis Vlaanderen-blad van de
    // club is een administratief label dat op drie momenten met andere mensen terugkomt; hem
    // meetellen maakte van één groep drie en van een trainerswissel een nieuwe groep.
    const acht = { name: 'Groep 8', weekday: 2, start_hour: 18 };
    const twaalf = { name: 'Groep 12', weekday: 2, start_hour: 18 };
    expect(groepSleutel(acht)).toBe(groepSleutel(twaalf));
  });

  it('scheidt twee groepen op een andere dag of een ander uur', () => {
    expect(groepSleutel({ weekday: 2, start_hour: 18 }))
      .not.toBe(groepSleutel({ weekday: 2, start_hour: 19 }));
    expect(groepSleutel({ weekday: 2, start_hour: 18 }))
      .not.toBe(groepSleutel({ weekday: 4, start_hour: 18 }));
  });

  it('scheidt hetzelfde moment op twee banen, en een baan van geen baan', () => {
    expect(groepSleutel({ weekday: 2, start_hour: 18, court_id: 'c-1' }))
      .not.toBe(groepSleutel({ weekday: 2, start_hour: 18, court_id: 'c-2' }));
    expect(groepSleutel({ weekday: 2, start_hour: 18, court_id: 'c-1' }))
      .not.toBe(groepSleutel({ weekday: 2, start_hour: 18 }));
  });

  it('telt de beginminuut niet mee', () => {
    const vol = { weekday: 2, start_hour: 18, start_minute: 0 };
    const half = { weekday: 2, start_hour: 18, start_minute: 30 };
    expect(groepSleutel(vol)).toBe(groepSleutel(half));
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

/** Een moment op een lokale dag en uur; ISO eruit, precies zoals de app zelf boekt. */
function iso(y: number, m: number, d: number, hour: number, minute = 0): string {
  return new Date(y, m, d, hour, minute, 0, 0).toISOString();
}

/** Eén les van de groep op een lokale dag, standaard van 18:00 tot 19:00. */
function lokaleLes(id: string, y: number, m: number, d: number, extra: Partial<Booking> = {}): Booking {
  return {
    ...base, id, group_id: 'g-1', participant_ids: ['oud'],
    start_time: iso(y, m, d, 18), end_time: iso(y, m, d, 19), ...extra,
  };
}

describe('planGroepWijziging', () => {
  // De groep staat op dinsdag 18:00; 1 september 2026 is een dinsdag, "nu" is zaterdag 5.
  const naarWoensdagOm19 = { weekday: 3, start_hour: 19, start_minute: 0 };

  it('raakt een les die al geweest is niet aan', () => {
    const gisteren = lokaleLes('oud', 2026, 8, 1);
    const voor = JSON.stringify(gisteren);
    const plan = planGroepWijziging(groep(), naarWoensdagOm19, [gisteren, lokaleLes('b-1', 2026, 8, 8)], nu);
    expect(plan.bookingPatches.map((p) => p.id)).toEqual(['b-1']);
    expect(JSON.stringify(gisteren)).toBe(voor);
  });

  it('zet een komende les op de nieuwe dag en het nieuwe uur, met dezelfde lesduur', () => {
    const les90 = lokaleLes('b-1', 2026, 8, 8, { end_time: iso(2026, 8, 8, 19, 30) });
    const plan = planGroepWijziging(groep(), naarWoensdagOm19, [les90], nu);
    const s = new Date(plan.bookingPatches[0].start_time);
    const e = new Date(plan.bookingPatches[0].end_time);
    expect([s.getDate(), s.getMonth() + 1, s.getHours(), s.getMinutes()]).toEqual([9, 9, 19, 0]);
    expect([e.getDate(), e.getHours(), e.getMinutes()]).toEqual([9, 20, 30]);
  });

  it('geeft elke komende les de nieuwe trainer', () => {
    const lijst = [lokaleLes('b-1', 2026, 8, 8), lokaleLes('b-2', 2026, 8, 15)];
    const plan = planGroepWijziging(groep(), { coach_id: 'sofie' }, lijst, nu);
    expect(plan.bookingPatches.map((p) => p.coach_id)).toEqual(['sofie', 'sofie']);
  });

  it('verzet de toegewezen trainer en laat de vervanger staan', () => {
    const met = lokaleLes('b-1', 2026, 8, 8, { taught_by_id: 'jan' });
    const plan = planGroepWijziging(groep(), { coach_id: 'sofie' }, [met], nu);
    expect(plan.bookingPatches[0].coach_id).toBe('sofie');
    expect('taught_by_id' in plan.bookingPatches[0]).toBe(false);
    expect(met.taught_by_id).toBe('jan');
  });

  // Een overlap blokkeert nooit en waarschuwt altijd. De twee tests hieronder bewijzen daarom
  // allebei de helften: de les verhuist mee ÉN de botsing staat gemeld. Vroeger bleef zo'n les
  // stilletjes op haar oude dag staan terwijl het scherm zei dat de groep verhuisd was.
  it('verzet een les die op een bezette trainer uitkomt, en meldt de botsing', () => {
    const bezet: Booking = {
      ...base, id: 'bezet', coach_id: 'koen', court_id: 'court-9',
      start_time: iso(2026, 8, 9, 19), end_time: iso(2026, 8, 9, 20),
    };
    const plan = planGroepWijziging(groep(), naarWoensdagOm19, [lokaleLes('b-1', 2026, 8, 8), bezet], nu);
    // De les IS verzet.
    expect(plan.bookingPatches.map((p) => [p.id, p.start_time]))
      .toEqual([['b-1', iso(2026, 8, 9, 19)]]);
    expect(plan.geblokkeerd).toEqual([]);
    // En de botsing IS gemeld, mét de les waarmee het botst.
    expect(plan.botsingen.map((b) => [b.id, b.start_time, b.conflict.id]))
      .toEqual([['b-1', iso(2026, 8, 9, 19), 'bezet']]);
  });

  it('verzet ook bij een bezette baan, ook al is de trainer vrij, en meldt het', () => {
    // Precies het kleutertennis: blauw en rood delen Terrein 7, elk een halve baan.
    const anderesTrainer: Booking = {
      ...base, id: 'baan', coach_id: 'sofie', court_id: 'court-1',
      start_time: iso(2026, 8, 9, 19), end_time: iso(2026, 8, 9, 20),
    };
    const plan = planGroepWijziging(groep(), naarWoensdagOm19, [lokaleLes('b-1', 2026, 8, 8), anderesTrainer], nu);
    expect(plan.bookingPatches.map((p) => p.id)).toEqual(['b-1']);
    expect(plan.geblokkeerd).toEqual([]);
    expect(plan.botsingen.map((b) => b.conflict.id)).toEqual(['baan']);
    // De baan van de botsende les komt mee, zodat het scherm "Terrein 7" kan zeggen.
    expect(plan.botsingen[0].conflict.court_id).toBe('court-1');
  });

  it('laat een groep niet met haar eigen lessen botsen', () => {
    // Een half uur opschuiven zet elke les bovenop haar eigen oude uur; dat is geen botsing.
    const lijst = [lokaleLes('b-1', 2026, 8, 8), lokaleLes('b-2', 2026, 8, 15)];
    const plan = planGroepWijziging(groep(), { start_minute: 30 }, lijst, nu);
    expect(plan.geblokkeerd).toEqual([]);
    expect(plan.botsingen).toEqual([]);
    expect(plan.bookingPatches.map((p) => p.id)).toEqual(['b-1', 'b-2']);
  });

  it('meldt een les die in een clubvakantie zou vallen, met de naam erbij', () => {
    const herfst: Vakantie = { id: 'v1', naam: 'Herfstvakantie', van: '2026-09-07', tot: '2026-09-13' };
    const plan = planGroepWijziging(groep(), naarWoensdagOm19, [lokaleLes('b-1', 2026, 8, 8)], nu, [herfst]);
    // DE GRENS VAN DEZE FASE: de vakantie blokkeert nog steeds wél. Alleen de overlapregel is
    // verzacht — een les op een dag dat de club dicht is hoort niet ingepland te worden.
    expect(plan.bookingPatches).toEqual([]);
    expect(plan.geblokkeerd.map((g) => [g.reden, g.vakantie])).toEqual([['vakantie', 'Herfstvakantie']]);
  });

  it('noemt een vakantiedag geen botsing, ook als de trainer dan al bezet was', () => {
    const herfst: Vakantie = { id: 'v1', naam: 'Herfstvakantie', van: '2026-09-07', tot: '2026-09-13' };
    const bezet: Booking = {
      ...base, id: 'bezet', coach_id: 'koen', court_id: 'court-1',
      start_time: iso(2026, 8, 9, 19), end_time: iso(2026, 8, 9, 20),
    };
    const plan = planGroepWijziging(groep(), naarWoensdagOm19, [lokaleLes('b-1', 2026, 8, 8), bezet], nu, [herfst]);
    expect(plan.geblokkeerd.map((g) => g.reden)).toEqual(['vakantie']);
    // De vakantie is het hele antwoord: de les verhuist niet, dus er valt ook niets te melden.
    expect(plan.bookingPatches).toEqual([]);
    expect(plan.botsingen).toEqual([]);
  });

  it('verhuist nooit een les het verleden in', () => {
    const zaterdag = groep({ weekday: 6 });
    const plan = planGroepWijziging(zaterdag, { weekday: 5 }, [lokaleLes('b-1', 2026, 8, 5)], nu);
    expect(plan.bookingPatches).toEqual([]);
    expect(plan.geblokkeerd.map((g) => g.reden)).toEqual(['verleden']);
  });

  it('laat een afgezegde komende les met rust', () => {
    const af = lokaleLes('af', 2026, 8, 8, { status: 'cancelled' });
    const plan = planGroepWijziging(groep(), naarWoensdagOm19, [af, lokaleLes('b-1', 2026, 8, 15)], nu);
    expect(plan.bookingPatches.map((p) => p.id)).toEqual(['b-1']);
    expect(plan.geblokkeerd).toEqual([]);
  });

  it('houdt over de uurwissel heen op elke lesdatum hetzelfde lokale uur', () => {
    // Eind oktober gaat de klok een uur terug; met "168 uur erbij" stond november om 20:15.
    const lijst = [lokaleLes('okt', 2026, 9, 20), lokaleLes('nov', 2026, 10, 10)];
    const plan = planGroepWijziging(groep(), { weekday: 3, start_hour: 19, start_minute: 15 }, lijst, nu);
    expect(plan.bookingPatches.map((p) => new Date(p.start_time).getDate())).toEqual([21, 11]);
    for (const p of plan.bookingPatches) {
      const s = new Date(p.start_time);
      const e = new Date(p.end_time);
      expect([s.getHours(), s.getMinutes()]).toEqual([19, 15]);
      expect([e.getHours(), e.getMinutes()]).toEqual([20, 15]);
    }
  });

  it('laat elke les met rust bij een wijziging van enkel naam, niveau of seizoen', () => {
    const plan = planGroepWijziging(
      groep(), { name: 'Groep 9', level: 'Kidstennis groen', season_end: '2027-05-01' },
      [lokaleLes('b-1', 2026, 8, 8)], nu,
    );
    expect(plan.bookingPatches).toEqual([]);
    expect(plan.geblokkeerd).toEqual([]);
    expect([plan.group.name, plan.group.season_end]).toEqual(['Groep 9', '2027-05-01']);
  });

  it('levert een nieuwe groep op en laat de meegegeven groep ongemoeid', () => {
    const g = groep();
    const plan = planGroepWijziging(g, { weekday: 3 }, [], nu);
    expect(plan.group).not.toBe(g);
    expect(plan.group.weekday).toBe(3);
    expect(g.weekday).toBe(2);
  });

  it('haalt de baan van een les niet weg als de groep er zelf geen heeft', () => {
    const zonderBaan = groep({ court_id: undefined });
    const les = lokaleLes('b-1', 2026, 8, 8, { court_id: 'court-3' });
    const plan = planGroepWijziging(zonderBaan, { start_hour: 19 }, [les], nu);
    expect(plan.bookingPatches[0].court_id).toBe('court-3');
  });

  it('zet elke komende les op de nieuwe baan van de groep', () => {
    const plan = planGroepWijziging(groep(), { court_id: 'court-2' }, [lokaleLes('b-1', 2026, 8, 8)], nu);
    expect(plan.bookingPatches[0].court_id).toBe('court-2');
  });
});
