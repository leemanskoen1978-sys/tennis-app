import {
  buildLesplan, coachesForPlayer, emptyScopeLine, lesplanSummary, nextBookingFor,
  noteCountLabel, playerCountLabel, playerListLine, playersForCoach, playersInScope,
  searchPlayers,
  type Lesplan,
} from './relations';
import { formatDayTime } from './datetime';
import type { Booking, Lesson, StudentProgress, User } from './types';

const booking = (player: string, coach: string): Booking => ({
  id: `b-${player}-${coach}`,
  player_id: player,
  coach_id: coach,
  court_id: 'court1',
  start_time: '2026-08-20T09:00:00Z',
  end_time: '2026-08-20T10:00:00Z',
  status: 'confirmed',
  payment_method: 'open',
});

const lesson = (student: string | undefined, coach: string | undefined): Lesson => ({
  id: `l-${student ?? 'none'}-${coach ?? 'none'}`,
  title: 'Forehand',
  uploaded_by: coach ?? 'x',
  student_id: student,
  coach_id: coach,
});

const note = (student: string, coach: string): StudentProgress => ({
  id: `p-${student}-${coach}`,
  student_id: student,
  coach_id: coach,
  training_type: 'techniek',
});

describe('coachesForPlayer', () => {
  it('is empty when nothing links the player to anyone', () => {
    expect(coachesForPlayer('mathis', [], [], [])).toEqual([]);
    expect(coachesForPlayer('mathis', [booking('lotte', 'koen')], [], [])).toEqual([]);
  });

  it('finds a coach through a booking, a lesson or a progress note alone', () => {
    expect(coachesForPlayer('mathis', [booking('mathis', 'koen')], [], [])).toEqual(['koen']);
    expect(coachesForPlayer('mathis', [], [lesson('mathis', 'sanne')], [])).toEqual(['sanne']);
    expect(coachesForPlayer('mathis', [], [], [note('mathis', 'ella')])).toEqual(['ella']);
  });

  it('returns every coach when a player works with more than one', () => {
    const found = coachesForPlayer(
      'mathis',
      [booking('mathis', 'koen')],
      [lesson('mathis', 'sanne')],
      [note('mathis', 'ella')],
    );
    expect(found.sort()).toEqual(['ella', 'koen', 'sanne']);
  });

  it('deduplicates a coach linked through several sources', () => {
    const found = coachesForPlayer(
      'mathis',
      [booking('mathis', 'koen'), { ...booking('mathis', 'koen'), id: 'b2' }],
      [lesson('mathis', 'koen')],
      [note('mathis', 'koen')],
    );
    expect(found).toEqual(['koen']);
  });

  it('ignores library lessons that have no coach or no student', () => {
    expect(coachesForPlayer('mathis', [], [lesson('mathis', undefined)], [])).toEqual([]);
    expect(coachesForPlayer('mathis', [], [lesson(undefined, 'koen')], [])).toEqual([]);
  });
});

describe('playersForCoach', () => {
  it('is empty when the coach has no links', () => {
    expect(playersForCoach('koen', [], [], [])).toEqual([]);
    expect(playersForCoach('koen', [booking('mathis', 'sanne')], [], [])).toEqual([]);
  });

  it('finds a player through a booking, a lesson or a progress note alone', () => {
    expect(playersForCoach('koen', [booking('mathis', 'koen')], [], [])).toEqual(['mathis']);
    expect(playersForCoach('koen', [], [lesson('lotte', 'koen')], [])).toEqual(['lotte']);
    expect(playersForCoach('koen', [], [], [note('sam', 'koen')])).toEqual(['sam']);
  });

  it('returns every player and deduplicates across sources', () => {
    const found = playersForCoach(
      'koen',
      [booking('mathis', 'koen')],
      [lesson('mathis', 'koen'), lesson('lotte', 'koen')],
      [note('sam', 'koen')],
    );
    expect(found.sort()).toEqual(['lotte', 'mathis', 'sam']);
  });

  it('is many-to-many: the same player shows up for two coaches', () => {
    const bookings = [booking('mathis', 'koen'), booking('mathis', 'sanne')];
    expect(playersForCoach('koen', bookings, [], [])).toEqual(['mathis']);
    expect(playersForCoach('sanne', bookings, [], [])).toEqual(['mathis']);
  });

  it('ignores library lessons that have no student', () => {
    expect(playersForCoach('koen', [], [lesson(undefined, 'koen')], [])).toEqual([]);
  });
});

describe('buildLesplan', () => {
  const les = (id: string, student: string | undefined, status?: 'gepland' | 'gegeven'): Lesson => ({
    id, title: `Les ${id}`, uploaded_by: 'koen', coach_id: 'koen', student_id: student, status,
  });
  const entry = (id: string, student: string, lessonId?: string, createdAt?: string): StudentProgress => ({
    id, student_id: student, coach_id: 'koen', training_type: 'techniek',
    lesson_id: lessonId, created_at: createdAt,
  });

  it('hangs a note under the lesson it points at', () => {
    const plan = buildLesplan('mathis', [les('l1', 'mathis')], [entry('p1', 'mathis', 'l1')]);
    expect(plan.planned).toHaveLength(1);
    expect(plan.planned[0].entries.map((e) => e.id)).toEqual(['p1']);
    expect(plan.loose).toEqual([]);
  });

  it('splits planned from given', () => {
    const plan = buildLesplan(
      'mathis',
      [les('l1', 'mathis'), les('l2', 'mathis', 'gegeven'), les('l3', 'mathis', 'gepland')],
      [],
    );
    expect(plan.planned.map((p) => p.lesson.id)).toEqual(['l1', 'l3']);
    expect(plan.given.map((p) => p.lesson.id)).toEqual(['l2']);
  });

  it('keeps a note without a lesson as a loose note', () => {
    const plan = buildLesplan('mathis', [les('l1', 'mathis')], [entry('p1', 'mathis')]);
    expect(plan.planned[0].entries).toEqual([]);
    expect(plan.loose.map((e) => e.id)).toEqual(['p1']);
  });

  it('keeps a note pointing at a lesson outside this plan as a loose note', () => {
    // De les is aan iemand anders toegewezen (of uit het plan gehaald): de notitie mag
    // daardoor niet van het scherm vallen.
    const plan = buildLesplan('mathis', [les('l1', 'lotte')], [entry('p1', 'mathis', 'l1')]);
    expect(plan.planned).toEqual([]);
    expect(plan.loose.map((e) => e.id)).toEqual(['p1']);
  });

  it('sorts several notes on the same lesson newest first', () => {
    const plan = buildLesplan(
      'mathis',
      [les('l1', 'mathis')],
      [
        entry('oud', 'mathis', 'l1', '2026-01-01T10:00:00Z'),
        entry('nieuw', 'mathis', 'l1', '2026-03-01T10:00:00Z'),
        entry('midden', 'mathis', 'l1', '2026-02-01T10:00:00Z'),
      ],
    );
    expect(plan.planned[0].entries.map((e) => e.id)).toEqual(['nieuw', 'midden', 'oud']);
  });

  it('leaves another player out of it', () => {
    const plan = buildLesplan(
      'mathis',
      [les('l1', 'mathis'), les('l2', 'lotte')],
      [entry('p1', 'lotte', 'l2'), entry('p2', 'mathis')],
    );
    expect(plan.planned.map((p) => p.lesson.id)).toEqual(['l1']);
    expect(plan.entryCount).toBe(1);
    expect(plan.loose.map((e) => e.id)).toEqual(['p2']);
  });

  it('counts every note of this player, loose ones included', () => {
    const plan = buildLesplan(
      'mathis',
      [les('l1', 'mathis')],
      [entry('p1', 'mathis', 'l1'), entry('p2', 'mathis')],
    );
    expect(plan.entryCount).toBe(2);
  });
});

describe('lesplanSummary', () => {
  const plan = (planned: number, entries: number): Lesplan => ({
    planned: Array.from({ length: planned }, (_, i) => ({
      lesson: { id: `l${i}`, title: 'x', uploaded_by: 'koen' },
      entries: [],
    })),
    given: [],
    loose: [],
    entryCount: entries,
  });

  it('covers both sides of the sheet', () => {
    expect(lesplanSummary(plan(2, 3))).toBe('2 te doen · 3 notities');
  });

  it('speaks singular and says so when there is nothing', () => {
    expect(lesplanSummary(plan(1, 1))).toBe('1 te doen · 1 notitie');
    expect(lesplanSummary(plan(0, 0))).toBe('niets te doen · geen notities');
  });
});

describe('nextBookingFor', () => {
  const at = (id: string, player: string, start: string, status: Booking['status'] = 'confirmed'): Booking => ({
    ...booking(player, 'koen'),
    id,
    start_time: start,
    end_time: start,
    status,
  });
  const now = new Date('2026-08-20T09:00:00Z');

  it('has no answer when nothing is planned', () => {
    expect(nextBookingFor('mathis', [], now)).toBeNull();
  });

  it('takes the earliest lesson that is still to come', () => {
    const list = [
      at('later', 'mathis', '2026-08-25T09:00:00Z'),
      at('soon', 'mathis', '2026-08-21T09:00:00Z'),
    ];
    expect(nextBookingFor('mathis', list, now)?.id).toBe('soon');
  });

  it('skips the past, other players and cancelled lessons', () => {
    const list = [
      at('past', 'mathis', '2026-08-01T09:00:00Z'),
      at('someone-else', 'lotte', '2026-08-21T09:00:00Z'),
      at('cancelled', 'mathis', '2026-08-22T09:00:00Z', 'cancelled'),
      at('good', 'mathis', '2026-08-23T09:00:00Z'),
    ];
    expect(nextBookingFor('mathis', list, now)?.id).toBe('good');
  });

  it('still counts a lesson that starts exactly now', () => {
    expect(nextBookingFor('mathis', [at('nu', 'mathis', '2026-08-20T09:00:00Z')], now)?.id).toBe('nu');
  });
});

describe('noteCountLabel', () => {
  it('speaks singular, plural and nothing', () => {
    expect(noteCountLabel(0)).toBe('geen notities');
    expect(noteCountLabel(1)).toBe('1 notitie');
    expect(noteCountLabel(4)).toBe('4 notities');
  });
});

describe('playerListLine', () => {
  it('says when the next lesson is, with the note count behind it', () => {
    const next = { ...booking('mathis', 'koen'), start_time: '2026-08-21T09:00:00Z' };
    expect(playerListLine(next, 2)).toBe(`Volgende les ${formatDayTime(next.start_time)} · 2 notities`);
  });

  it('says plainly that nothing is planned', () => {
    expect(playerListLine(null, 0)).toBe('Geen les gepland · geen notities');
  });
});

// ---------------------------------------------------------------------------
// De drie stapels van de spelerslijst
// ---------------------------------------------------------------------------

const player = (id: string): User => ({ id, email: `${id}@kdt.be`, name: id, role: 'player' });

/** Een les op een gekozen dag, met eventueel meespelers erbij. */
const at = (start: string, payer: string, coach: string, others: string[] = []): Booking => ({
  ...booking(payer, coach),
  id: `b-${start}-${payer}`,
  start_time: start,
  end_time: start,
  participant_ids: others,
});

const NOW = new Date('2026-08-20T12:00:00');
const TODAY = '2026-08-20T09:00:00';
const TOMORROW = '2026-08-21T09:00:00';

const players = [player('mathis'), player('lotte'), player('sam')];

const scope = (
  which: Parameters<typeof playersInScope>[0],
  extra: Partial<Parameters<typeof playersInScope>[1]> = {},
): string[] =>
  playersInScope(which, {
    players,
    coachId: 'koen',
    bookings: [],
    lessons: [],
    progress: [],
    now: NOW,
    ...extra,
  }).map((p) => p.id);

describe('playersInScope', () => {
  it('geeft bij "iedereen" de hele lijst terug, in dezelfde volgorde', () => {
    expect(scope('all')).toEqual(['mathis', 'lotte', 'sam']);
  });

  it('rekent bij "mijn spelers" iedereen mee waar deze trainer al mee werkte', () => {
    expect(scope('mine', {
      bookings: [booking('mathis', 'koen'), booking('sam', 'sanne')],
      lessons: [lesson('lotte', 'koen')],
    })).toEqual(['mathis', 'lotte']);
  });

  it('telt bij "mijn spelers" ook een speler die alleen een notitie heeft', () => {
    expect(scope('mine', { progress: [note('sam', 'koen')] })).toEqual(['sam']);
  });

  it('houdt bij "vandaag" alleen de lessen van vandaag over', () => {
    expect(scope('today', {
      bookings: [at(TODAY, 'mathis', 'koen'), at(TOMORROW, 'lotte', 'koen')],
    })).toEqual(['mathis']);
  });

  it('rekent bij "vandaag" de meespelers van een groepsles mee', () => {
    expect(scope('today', {
      bookings: [at(TODAY, 'mathis', 'koen', ['sam'])],
    })).toEqual(['mathis', 'sam']);
  });

  it('laat bij "vandaag" de lessen van een andere trainer buiten beschouwing', () => {
    expect(scope('today', { bookings: [at(TODAY, 'lotte', 'sanne')] })).toEqual([]);
  });

  it('laat een geannuleerde les van vandaag niet meetellen', () => {
    expect(scope('today', {
      bookings: [{ ...at(TODAY, 'mathis', 'koen'), status: 'cancelled' }],
    })).toEqual([]);
  });

  it('geeft zonder trainer wel iedereen, maar geen eigen of huidige stapel', () => {
    const noCoach = { coachId: null, bookings: [booking('mathis', 'koen')] };
    expect(scope('all', noCoach)).toEqual(['mathis', 'lotte', 'sam']);
    expect(scope('mine', noCoach)).toEqual([]);
    expect(scope('today', noCoach)).toEqual([]);
  });
});

describe('playerCountLabel', () => {
  it('zegt het in woorden, ook bij geen en bij één', () => {
    expect(playerCountLabel(0)).toBe('geen spelers');
    expect(playerCountLabel(1)).toBe('1 speler');
    expect(playerCountLabel(12)).toBe('12 spelers');
  });
});

describe('emptyScopeLine', () => {
  it('geeft per stapel de reden waarom hij leeg is', () => {
    expect(emptyScopeLine('all')).toBe('Nog geen spelers.');
    expect(emptyScopeLine('mine')).not.toBe(emptyScopeLine('all'));
    expect(emptyScopeLine('today')).not.toBe(emptyScopeLine('mine'));
  });
});

describe('searchPlayers', () => {
  const named = (id: string, name: string, email = `${id}@kdt.be`): User =>
    ({ ...player(id), name, email });
  const lijst = [named('1', 'Mathis De Vos'), named('2', 'Noë Peeters'), named('3', 'Lotte Jans', 'lotte@club.be')];
  const found = (q: string): string[] => searchPlayers(lijst, q).map((p) => p.name);

  it('geeft de hele lijst terug bij een lege zoekregel', () => {
    expect(found('')).toHaveLength(3);
    expect(found('   ')).toHaveLength(3);
  });

  it('vindt op een stuk van de naam, ongeacht hoofdletters', () => {
    expect(found('mat')).toEqual(['Mathis De Vos']);
    expect(found('JANS')).toEqual(['Lotte Jans']);
  });

  it('trekt zich niets aan van accenten', () => {
    expect(found('noe')).toEqual(['Noë Peeters']);
    expect(found('Noë')).toEqual(['Noë Peeters']);
  });

  it('vindt ook op het e-mailadres', () => {
    expect(found('club.be')).toEqual(['Lotte Jans']);
  });

  it('laat de woorden in elke volgorde staan', () => {
    expect(found('vos mathis')).toEqual(['Mathis De Vos']);
    expect(found('mathis vos')).toEqual(['Mathis De Vos']);
  });

  it('geeft niets terug als er niets past', () => {
    expect(found('zzz')).toEqual([]);
  });
});
